/**
 * Usage Tracking Service
 *
 * Centralized service for tracking LLM token usage and costs.
 * Uses a buffer + batch insert pattern for high-frequency tracking.
 *
 * Features:
 * - Buffer with configurable size (default: 100 events)
 * - Periodic flush (default: every 5 seconds)
 * - Non-blocking recordUsage() method
 * - Graceful shutdown with flush
 * - Pluggable adapter support for custom storage backends
 *
 * @example
 * ```typescript
 * // Initialize on server startup
 * usageTrackingService.initialize();
 *
 * // Record usage (non-blocking)
 * usageTrackingService.recordUsage(tokenUsage, {
 *   organizationId: "org_123",
 *   service: "agent-workflow", // Use LLM_SERVICE_NAMES constants
 *   model: "gpt-4o-mini",
 *   provider: "openai",
 * });
 *
 * // Shutdown gracefully
 * await usageTrackingService.shutdown();
 * ```
 *
 * @example
 * ```typescript
 * // Use custom adapter (e.g., for testing)
 * import { NoopUsageAdapter } from "./usage-tracking-adapter";
 * usageTrackingService.setAdapter(new NoopUsageAdapter());
 * ```
 */

import { createLogger, serializeError } from "@journey/logger";
import type { TokenUsage, UsageContext } from "@journey/schemas";
import { validateUuidOrNull } from "@journey/schemas";
import { db, llmUsageEvents } from "@journey/db";
import type { UsageTrackingAdapter } from "./usage-tracking-adapter";
import { classifyUsageTrackingError } from "./usage-tracking-error-classifier";

const log = createLogger("llm:usage-tracking");

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determines if a journey session ID should be tracked
 *
 * Only returns the sessionId if there's a real journey context.
 * Workflow tests and agent-only calls should NOT populate journeySessionId.
 *
 * @param sessionId - The session UUID (may or may not be a real journey session)
 * @param hasJourneyContext - Whether this call is part of a real journey execution
 * @returns sessionId if real journey, undefined otherwise
 */
function resolveJourneySessionId(
  sessionId: string | undefined,
  hasJourneyContext: boolean
): string | undefined {
  return hasJourneyContext && sessionId ? sessionId : undefined;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

interface UsageTrackingConfig {
  /** Maximum events in buffer before force flush (default: 100) */
  bufferSize: number;
  /** Flush interval in milliseconds (default: 5000ms) */
  flushIntervalMs: number;
  /** Enable/disable tracking (default: true) */
  enabled: boolean;
}

const DEFAULT_CONFIG: UsageTrackingConfig = {
  bufferSize: 100,
  flushIntervalMs: 5000,
  enabled: true,
};

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Usage event ready for database insertion
 */
type UsageEventInsert = typeof llmUsageEvents.$inferInsert;

class UsageTrackingService implements UsageTrackingAdapter {
  private config: UsageTrackingConfig;
  private buffer: UsageEventInsert[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private initialized = false;
  private flushing = false;
  private customAdapter: UsageTrackingAdapter | null = null;

  constructor(config: Partial<UsageTrackingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // ADAPTER INJECTION
  // ===========================================================================

  /**
   * Set a custom adapter for usage tracking
   *
   * When set, all recordUsage() calls are forwarded to the custom adapter
   * instead of the database. Useful for testing or alternative storage.
   *
   * @param adapter - Custom adapter or null to use default DB storage
   */
  setAdapter(adapter: UsageTrackingAdapter | null): void {
    this.customAdapter = adapter;
    if (adapter) {
      log.info("usageTracking:customAdapterSet");
    } else {
      log.info("usageTracking:usingDefaultAdapter");
    }
  }

  /**
   * Check if a custom adapter is set
   */
  hasCustomAdapter(): boolean {
    return this.customAdapter !== null;
  }

  /**
   * Check if the service is ready to record usage
   */
  isReady(): boolean {
    if (this.customAdapter) {
      return this.customAdapter.isReady?.() ?? true;
    }
    return this.initialized && this.config.enabled;
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Initialize the service (start background flush)
   * Call this on server startup
   */
  initialize(): void {
    if (this.initialized) {
      log.debug("usageTracking:alreadyInitialized");
      return;
    }

    if (!this.config.enabled) {
      log.info("usageTracking:disabled");
      return;
    }

    // Initialize custom adapter if configured
    this.customAdapter?.initialize?.();

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => {
        log.error({ err: serializeError(err) }, "usageTracking:flushError");
      });
    }, this.config.flushIntervalMs);

    this.initialized = true;
    log.info(
      { bufferSize: this.config.bufferSize, flushIntervalMs: this.config.flushIntervalMs },
      "usageTracking:initialized"
    );
  }

  /**
   * Force flush and cleanup (for graceful shutdown)
   * Call this on server shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();

    // Shutdown custom adapter if configured
    await this.customAdapter?.shutdown?.();

    this.initialized = false;
    log.info("usageTracking:shutdown");
  }

  /**
   * Disable tracking entirely
   * Useful for tests
   */
  disable(): void {
    this.config.enabled = false;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    log.info("usageTracking:disabled");
  }

  /**
   * Enable tracking
   */
  enable(): void {
    this.config.enabled = true;
    if (!this.flushInterval && this.initialized) {
      this.flushInterval = setInterval(() => {
        this.flush().catch((err) => {
          log.error({ err: serializeError(err) }, "usageTracking:flushError");
        });
      }, this.config.flushIntervalMs);
    }
    log.info("usageTracking:enabled");
  }

  // ===========================================================================
  // MAIN API
  // ===========================================================================

  /**
   * Record LLM usage event
   *
   * Non-blocking - adds to buffer for batch insert.
   * Call this after every LLM API response.
   *
   * If a custom adapter is set, forwards the call to it instead.
   *
   * @param usage - Token usage from LLM response
   * @param context - Context dimensions (org, journey, service, etc.)
   */
  recordUsage(usage: TokenUsage, context: UsageContext): void {
    if (!this.config.enabled) return;

    // Forward to custom adapter if set
    if (this.customAdapter) {
      this.customAdapter.recordUsage(usage, context);
      return;
    }

    // Require organizationId for multi-tenant isolation (DB adapter only)
    if (!context.organizationId) {
      log.warn({ service: context.service, model: context.model }, "usageTracking:missingOrgId");
      return;
    }

    // Validate journeyId is a real UUID (not empty string from workflow tests)
    const validJourneyId = validateUuidOrNull(context.journeyId);

    const event: UsageEventInsert = {
      // Dimensions
      organizationId: context.organizationId,
      userId: context.userId ?? null,
      journeyId: validJourneyId,
      journeySessionId: resolveJourneySessionId(
        context.journeySessionId,
        !!validJourneyId
      ) ?? null,
      clientId: context.clientId ?? null,

      // Service context
      service: context.service,
      module: context.module ?? null,
      tool: context.tool ?? null,

      // Model info
      model: context.model,
      provider: context.provider ?? "unknown",

      // Usage metrics
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costUSD: String(usage.costUSD ?? 0),
      durationMs: context.durationMs ?? null,

      // I/O Content (for debugging)
      systemPrompt: context.systemPrompt ?? null,
      inputMessages: context.inputMessages ?? null,
      outputContent: context.outputContent ?? null,
      outputToolCalls: context.outputToolCalls ?? null,
      finishReason: context.finishReason ?? null,
      errorMessage: context.errorMessage ?? null,

      // Metadata
      metadata: context.metadata ?? null,
    };

    this.buffer.push(event);

    log.debug(
      { service: context.service, model: context.model, tokens: usage.totalTokens },
      "usageTracking:recorded"
    );

    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush().catch((err) => {
        log.error({ err: serializeError(err) }, "usageTracking:flushError");
      });
    }
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  /**
   * Flush buffer to database
   *
   * Classifies errors as permanent (data/constraint violations) or transient (network/temporary).
   * - Permanent errors: Events are dropped and logged for audit
   * - Transient errors: Events are re-added to buffer and retried on next flush
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.flushing) return;

    this.flushing = true;
    const events = [...this.buffer];
    this.buffer = [];

    try {
      await db.insert(llmUsageEvents).values(events);
      log.debug({ count: events.length }, "usageTracking:flushed");
    } catch (error) {
      const classification = classifyUsageTrackingError(error);

      if (classification.retryable) {
        // Transient error - retry with buffer limit to prevent memory explosion
        if (this.buffer.length + events.length <= this.config.bufferSize * 3) {
          this.buffer.unshift(...events);
          log.warn(
            {
              count: events.length,
              err: serializeError(error),
              errorType: classification.type,
            },
            "usageTracking:flushFailed:willRetry"
          );
        } else {
          // Buffer overflow - drop events to prevent memory issues
          log.error(
            {
              count: events.length,
              err: serializeError(error),
              errorType: classification.type,
              bufferSize: this.buffer.length,
            },
            "usageTracking:flushFailed:bufferOverflow:dropped"
          );
        }
      } else {
        // Permanent error (FK violation, constraint violation) - drop events
        // Log dropped event with context for debugging
        log.error(
          {
            count: events.length,
            err: serializeError(error),
            errorType: classification.type,
            errorMessage: classification.message,
            sampleEvent: {
              organizationId: events[0]?.organizationId,
              service: events[0]?.service,
              model: events[0]?.model,
              timestamp: events[0]?.createdAt,
            },
            hint: "Events reference non-existent entities (org/user/journey). Database may have been reset.",
          },
          "usageTracking:flushFailed:permanent:dropped"
        );
      }
    } finally {
      this.flushing = false;
    }
  }

  // ===========================================================================
  // STATS (for debugging/monitoring)
  // ===========================================================================

  /**
   * Get current buffer size (for monitoring)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const usageTrackingService = new UsageTrackingService();
