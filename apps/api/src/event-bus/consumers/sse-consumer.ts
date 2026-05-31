/**
 * SSE Consumer
 *
 * Publishes events to Redis pub/sub for real-time streaming to frontend clients.
 *
 * @module events/consumers/sse-consumer
 */

import { createLogger, serializeError } from "@journey/logger";
import { EventTypes, type BaseEvent } from "@journey/schemas";
import type { EventConsumerHandler } from "../event-bus";
import { getRedisConnection } from "../../lib/redis";
import { createServicesForSystem } from "../../services";

const log = createLogger("sse-consumer");

// =============================================================================
// ENRICHMENT
// =============================================================================

/**
 * Enrich event with additional data for SSE streaming
 * - Adds journeyName for session events
 */
async function enrichEvent(event: BaseEvent): Promise<{ journeyName: string | null }> {
  let journeyName: string | null = null;

  // Enrich session events with journey name
  if (event.journeyId) {
    try {
      const services = createServicesForSystem();
      journeyName = (await services.channel.getJourneyName(event.journeyId)) || null;
    } catch (error) {
      log.debug({ journeyId: event.journeyId }, "sseConsumer:enrichment:journeyNameFailed");
    }
  }

  return { journeyName };
}

// =============================================================================
// CONSUMER
// =============================================================================

/**
 * SSE Consumer - publishes events to Redis pub/sub for SSE streaming
 */
export const sseConsumer: EventConsumerHandler = {
  name: "sse",

  async handle(event: BaseEvent): Promise<void> {
    if (!event.organizationId) {
      log.warn({ eventType: event.type }, "sseConsumer:missingOrgId");
      return;
    }

    const channel = `events:${event.organizationId}`;

    try {
      const redis = getRedisConnection();

      // Enrich event with additional data
      const enrichment = await enrichEvent(event);

      // Transform to SSE-compatible format
      // Use null instead of empty strings/fabricated IDs for proper frontend handling
      const sseEvent = {
        id: event.id,
        sessionId: event.sessionId ?? null,
        type: event.type,
        payload: event.payload,
        metadata: {
          source: event.source,
          performedBy: event.performedBy,
          timestamp: event.timestamp,
        },
        timestamp: event.timestamp,
        journeyId: event.journeyId ?? null,
        journeyName: enrichment.journeyName,
        clientId: event.clientId ?? null,
        // Sequence number for ordering and detecting missed events
        sequence: event.sequence ?? null,
        // Flag to indicate if event has full session context
        hasFullContext: !!(event.sessionId && event.journeyId && event.clientId),
      };

      const message = JSON.stringify(sseEvent);
      const subscriberCount = await redis.publish(channel, message);

      log.debug(
        {
          eventType: event.type,
          organizationId: event.organizationId,
          subscriberCount,
        },
        "sseConsumer:published"
      );
    } catch (error) {
      // Log the error
      log.warn(
        {
          eventType: event.type,
          organizationId: event.organizationId,
          err: serializeError(error),
        },
        "sseConsumer:publishFailed"
      );

      // Try to notify connected clients about the failure
      // This may also fail if Redis is the root cause, but we try anyway
      await publishErrorEvent(event, error, channel);
    }
  },
};

/**
 * Publish an error event to notify connected clients of SSE failures
 *
 * This allows the frontend to show appropriate error states or retry logic
 */
async function publishErrorEvent(
  originalEvent: BaseEvent,
  error: unknown,
  channel: string
): Promise<void> {
  try {
    const redis = getRedisConnection();

    const errorEvent = {
      id: crypto.randomUUID(),
      type: EventTypes.SYSTEM_SSE_ERROR,
      payload: {
        originalEventType: originalEvent.type,
        originalEventId: originalEvent.id,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorCode: error instanceof Error && "code" in error ? (error as Error & { code: string }).code : undefined,
      },
      timestamp: new Date().toISOString(),
      metadata: {
        source: "system",
        failedPublish: true,
      },
    };

    await redis.publish(channel, JSON.stringify(errorEvent));

    log.debug(
      { originalEventType: originalEvent.type },
      "sseConsumer:errorEventPublished"
    );
  } catch (retryError) {
    // Last resort - just log, can't notify frontend
    log.error(
      {
        originalEventType: originalEvent.type,
        err: serializeError(retryError),
      },
      "sseConsumer:errorEventFailed"
    );
  }
}
