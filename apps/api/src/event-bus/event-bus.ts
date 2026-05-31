/**
 * Unified Event Bus
 *
 * Central event publishing system that routes events to registered consumers.
 * Provides a single API for all modules to publish events.
 *
 * @module events/event-bus
 */

import { createLogger, serializeError } from "@journey/logger";
import type { BaseEvent, EventConsumer, EventMetadata, EventRegistryEntry } from "@journey/schemas";
import { EVENT_REGISTRY, EventConsumerSchema, getEventRegistration, type AnyEvent } from "@journey/schemas";
import { checkEventRateLimit } from "../lib/rate-limiter";
import { getCorrelationId, getCausedBy, getTracingContext } from "../lib/event-tracing";
import { getRedisConnection } from "../lib/redis";

const log = createLogger("event-bus");

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Maximum time (in ms) a consumer can take to process an event.
 * Prevents hanging consumers from blocking event processing.
 */
const CONSUMER_TIMEOUT_MS = 30_000; // 30 seconds

// =============================================================================
// TYPES
// =============================================================================

/**
 * Event consumer interface
 * Consumers receive events and process them (SSE, automation, logging, etc.)
 */
export interface EventConsumerHandler {
  name: EventConsumer;
  handle(event: BaseEvent): Promise<void>;
}

/**
 * Options for publishing events
 */
export interface PublishOptions {
  /** Skip validation (use with caution) */
  skipValidation?: boolean;
  /** Throw on consumer errors instead of continuing */
  throwOnError?: boolean;
  /** Skip rate limiting (for internal system events) */
  skipRateLimit?: boolean;
}

// =============================================================================
// STATE
// =============================================================================

const consumers: Map<EventConsumer, EventConsumerHandler> = new Map();
let isInitialized = false;

/**
 * Helper to wrap a promise with a timeout
 *
 * Uses Promise.race for cleaner implementation. The timeout is always
 * cleared when the wrapped promise settles, preventing timer leaks.
 *
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param label - Label for error message
 * @returns Promise that rejects with timeout error if timeout is exceeded
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Get the next sequence number for an organization using Redis INCR.
 *
 * Uses Redis INCR for atomic sequence generation across all API instances.
 * This ensures unique, monotonically increasing sequence numbers even in
 * distributed deployments with multiple API pods.
 *
 * Falls back to timestamp-based sequence when Redis is unavailable.
 * While not guaranteed unique across instances, timestamps ensure monotonic
 * ordering within a single request and are better than failing completely.
 *
 * @param organizationId - Organization to get sequence for
 * @returns Next sequence number (starts at 1, or timestamp-based fallback)
 */
async function getNextSequence(organizationId: string): Promise<number> {
  try {
    const redis = getRedisConnection();
    const key = `sequence:org:${organizationId}`;
    return await redis.incr(key);
  } catch (error) {
    // Fallback to timestamp-based sequence when Redis is unavailable
    // This provides monotonic ordering per-instance, though not globally unique
    log.warn({ organizationId, err: serializeError(error) }, "eventBus:sequence:redisFallback");
    return Date.now();
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Register an event consumer
 *
 * @param consumer - Consumer handler to register
 * @throws Error if consumer name is not valid
 */
export function registerEventConsumer(consumer: EventConsumerHandler): void {
  // Validate consumer name at runtime
  const nameResult = EventConsumerSchema.safeParse(consumer.name);
  if (!nameResult.success) {
    throw new Error(`Invalid consumer name: ${consumer.name}. Valid names: ${EventConsumerSchema.options.join(", ")}`);
  }

  if (consumers.has(consumer.name)) {
    log.warn({ consumer: consumer.name }, "eventBus:consumer:replacing");
  }
  consumers.set(consumer.name, consumer);
  log.debug({ consumer: consumer.name }, "eventBus:consumer:registered");
}

/**
 * Initialize the event bus
 * Call this after registering all consumers
 */
export function initEventBus(): void {
  if (isInitialized) {
    log.warn({}, "eventBus:alreadyInitialized");
    return;
  }

  const consumerNames = Array.from(consumers.keys());
  log.info({ consumers: consumerNames }, "eventBus:initialized");
  isInitialized = true;
}

/**
 * Check if event bus is initialized
 */
export function isEventBusInitialized(): boolean {
  return isInitialized;
}

// =============================================================================
// PUBLISHING
// =============================================================================

/**
 * Publish an event to the event bus
 *
 * The event bus will:
 * 1. Look up the event type in the registry
 * 2. Validate the payload against the schema (optional)
 * 3. Route the event to all configured consumers
 *
 * @param event - Event to publish
 * @param options - Publishing options
 */
export async function publishEvent<P = unknown>(
  event: BaseEvent<string, P>,
  options: PublishOptions = {}
): Promise<void> {
  const { skipValidation = false, throwOnError = false, skipRateLimit = false } = options;

  // 0. Check rate limit (unless skipped for system events)
  if (!skipRateLimit) {
    const rateLimit = await checkEventRateLimit(event.organizationId);
    if (!rateLimit.allowed) {
      log.warn(
        {
          eventType: event.type,
          organizationId: event.organizationId,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        "eventBus:rateLimited"
      );

      if (throwOnError) {
        throw new Error(`Rate limit exceeded. Reset at ${new Date(rateLimit.resetAt).toISOString()}`);
      }
      return;
    }
  }

  // 1. Look up event in registry
  const registration = getEventRegistration(event.type);

  if (!registration) {
    log.warn({ eventType: event.type }, "eventBus:unknownEventType");
    // Still publish to consumers that are listening
    // This allows forward compatibility for new event types
  }

  // 2. Validate payload (optional)
  if (!skipValidation && registration?.payloadSchema) {
    try {
      registration.payloadSchema.parse(event.payload);
    } catch (error) {
      log.error(
        { eventType: event.type, err: serializeError(error) },
        "eventBus:payloadValidationFailed"
      );
      if (throwOnError) throw error;
      return;
    }
  }

  // 3. Route to consumers
  const targetConsumers = registration?.consumers ?? [];

  log.debug(
    {
      eventType: event.type,
      organizationId: event.organizationId,
      clientId: event.clientId,
      consumers: targetConsumers,
    },
    "eventBus:publishing"
  );

  const results = await Promise.allSettled(
    targetConsumers.map(async (consumerName) => {
      const consumer = consumers.get(consumerName);
      if (!consumer) {
        log.debug({ consumer: consumerName }, "eventBus:consumer:notRegistered");
        return;
      }

      try {
        // Wrap consumer.handle with timeout to prevent hanging consumers
        await withTimeout(
          consumer.handle(event),
          CONSUMER_TIMEOUT_MS,
          `Consumer ${consumerName}`
        );
        log.debug(
          { eventType: event.type, consumer: consumerName },
          "eventBus:consumer:success"
        );
      } catch (error) {
        // Check if it was a timeout error
        const isTimeout = error instanceof Error && error.message.includes("timed out");
        if (isTimeout) {
          log.error(
            { eventType: event.type, consumer: consumerName, timeoutMs: CONSUMER_TIMEOUT_MS },
            "eventBus:consumer:timeout"
          );
        } else {
          log.error(
            { eventType: event.type, consumer: consumerName, err: serializeError(error) },
            "eventBus:consumer:error"
          );
        }
        if (throwOnError) throw error;
      }
    })
  );

  // Check for any failures
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    log.warn(
      { eventType: event.type, failureCount: failures.length },
      "eventBus:partialFailure"
    );
  }
}

/**
 * Publish multiple events in batch
 *
 * @param events - Events to publish
 * @param options - Publishing options
 */
export async function publishEvents<P = unknown>(
  events: BaseEvent<string, P>[],
  options: PublishOptions = {}
): Promise<void> {
  // Process events in parallel
  await Promise.allSettled(
    events.map((event) => publishEvent(event, options))
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a new event with standard fields populated
 *
 * Automatically populates correlationId and causedBy from the current
 * tracing context if available. This enables event correlation without
 * explicitly passing context through every function call.
 *
 * Uses Redis for distributed sequence number generation to support
 * horizontal scaling across multiple API instances.
 *
 * @param type - Event type
 * @param organizationId - Organization ID
 * @param payload - Event payload
 * @param options - Additional event options
 */
export async function createEvent<P>(
  type: string,
  organizationId: string,
  payload: P,
  options: Partial<BaseEvent<string, P>> = {}
): Promise<BaseEvent<string, P>> {
  // Get tracing context for automatic correlation
  const tracingContext = getTracingContext();

  // Build metadata from tracing context if available
  const metadata: EventMetadata = {
    ...options.metadata,
    requestId: tracingContext?.requestId ?? options.metadata?.requestId,
    ipAddress: tracingContext?.ipAddress ?? options.metadata?.ipAddress,
    userAgent: tracingContext?.userAgent ?? options.metadata?.userAgent,
  };

  // Merge options first, then apply computed values
  // This ensures tracing context values are used unless explicitly overridden
  const correlationId = options.correlationId ?? getCorrelationId();
  const causedBy = options.causedBy ?? getCausedBy();

  // Get sequence from Redis (atomic across all API instances)
  const sequence = options.sequence ?? await getNextSequence(organizationId);

  return {
    ...options, // Spread options first
    id: options.id ?? crypto.randomUUID(),
    type,
    timestamp: options.timestamp ?? new Date().toISOString(),
    version: options.version ?? 1,
    organizationId,
    source: options.source ?? "system",
    sequence,
    correlationId,
    causedBy,
    payload,
    metadata,
  };
}

// =============================================================================
// SHUTDOWN
// =============================================================================

/**
 * Shutdown the event bus
 */
export function shutdownEventBus(): void {
  consumers.clear();
  isInitialized = false;
  log.info({}, "eventBus:shutdown");
}
