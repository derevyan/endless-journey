/**
 * Log Consumer
 *
 * Persists events to the database for history and audit purposes.
 * Routes events to appropriate tables based on event type and context:
 * - All events → events table (universal log)
 * - Session events → interactions table (for session timeline)
 *
 * Note: CRM activities are now read directly from the events table.
 *
 * @module events/consumers/log-consumer
 */

import { db } from "@journey/db";
import { events } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { InteractionEventTypeSchema } from "@journey/schemas";
import type { BaseEvent } from "@journey/schemas";
import { trackInteractionPersistenceAttempt } from "@journey/engine";
import { appendToConversation } from "@journey/engine-integrations";
import { createServicesForSystem } from "../../services";
import type { EventConsumerHandler } from "../event-bus";
import { isRecord } from "../../lib/type-guards";

// =============================================================================
// UNIVERSAL EVENT PERSISTENCE
// =============================================================================

/**
 * Save event to universal events table for replay and audit
 * All events are persisted here, regardless of type or context
 */
async function saveToEventsTable(event: BaseEvent): Promise<void> {
  const payload = isRecord(event.payload) ? event.payload : {};
  await db.insert(events).values({
    id: event.id,
    type: event.type,
    timestamp: new Date(event.timestamp),
    version: event.version,
    organizationId: event.organizationId,
    clientId: event.clientId || null,
    sessionId: event.sessionId || null,
    journeyId: event.journeyId || null,
    source: event.source,
    performedBy: event.performedBy && event.performedBy !== "system" ? event.performedBy : null,
    sequence: event.sequence || 0,
    correlationId: event.correlationId || null,
    causedBy: event.causedBy || null,
    payload,
    metadata: event.metadata || {},
  });
}

const log = createLogger("log-consumer");

// =============================================================================
// LOG CONSUMER
// =============================================================================

/**
 * Log Consumer - persists events to database
 *
 * Write strategy:
 * 1. ALL events → universal events table (for replay/audit/CRM activity)
 * 2. Session events (with sessionId) → interactions table (for session timeline)
 *
 * Note: CRM activities are read directly from events table at query time.
 */
export const logConsumer: EventConsumerHandler = {
  name: "log",

  async handle(event: BaseEvent): Promise<void> {
    try {
      // 1. Save ALL events to universal events table for replay/audit
      await saveToEventsTable(event);
      log.debug(
        {
          eventId: event.id,
          eventType: event.type,
          sequence: event.sequence,
        },
        "logConsumer:events:saved"
      );

      // 2. Route session events to interactions table for session timeline
      // Skip workflow events - they're execution details, not user-facing interactions
      if (event.sessionId && !event.type.startsWith("workflow.")) {
        const payload = isRecord(event.payload) ? event.payload : {};
        const services = createServicesForSystem();
        const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "unknown";

        // ✅ FIX: Handle duplicate saves (from parallel onEventCallback)
        // The session engine now saves to interactions table synchronously before publishing
        // This consumer runs as background task and may encounter duplicates
        try {
          // Save to interactions table (event sourcing - source of truth)
          const interactionId = await services.channel.saveInteraction({
            id: event.id,
            sessionId: event.sessionId,
            type: event.type,
            nodeId,
            payload,
            metadata: {
              source: event.source,
              performedBy: event.performedBy,
              timestamp: event.timestamp,
              eventId: event.id,
            },
          });

          log.debug(
            {
              eventType: event.type,
              interactionId,
              sessionId: event.sessionId,
            },
            "logConsumer:interaction:saved"
          );
        } catch (error) {
          // If duplicate already exists (from onEventCallback save), that's OK
          // Use Postgres error code 23505 (unique_violation) instead of string matching
          const errorCode = isRecord(error) && typeof error.code === "string" ? error.code : undefined;
          const isDuplicateKey = errorCode === "23505";

          if (isDuplicateKey) {
            log.debug(
              {
                eventType: event.type,
                eventId: event.id,
                sessionId: event.sessionId,
              },
              "logConsumer:interaction:alreadyExists"
            );
          } else {
            // Re-throw if it's a different error
            throw error;
          }
        }

        // PHASE 2: Dual-write to conversations table (JSONB document model)
        // This enables fast cache recovery and full-text search
        // Errors are caught and logged but don't fail the request
        // Fallback reads use interactions table if conversation document missing
        try {
          const startDualWrite = performance.now();

          const parsedType = InteractionEventTypeSchema.safeParse(event.type);
          if (!parsedType.success) {
            log.warn({ eventType: event.type, sessionId: event.sessionId }, "logConsumer:interaction:invalidType");
            return;
          }

          const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "unknown";

          await appendToConversation(event.sessionId, {
            id: event.id,
            type: parsedType.data,
            nodeId,
            timestamp: event.timestamp,
            payload,
            metadata: {
              source: event.source,
              performedBy: event.performedBy,
            },
          });

          const dualWriteDuration = performance.now() - startDualWrite;

          // Log with performance metrics (for monitoring dual-write overhead)
          if (dualWriteDuration > 10) {
            // Slow dual-write (>10ms) - alert for investigation
            log.warn(
              {
                eventType: event.type,
                sessionId: event.sessionId,
                durationMs: dualWriteDuration,
              },
              "logConsumer:conversation:slow"
            );
          } else {
            log.debug(
              {
                eventType: event.type,
                sessionId: event.sessionId,
                durationMs: dualWriteDuration,
              },
              "logConsumer:conversation:appended"
            );
          }
        } catch (dualWriteError) {
          // Dual-write failure - log for monitoring (even if expected for tests)
          // interactions table is source of truth - fallback reads will use it if conversation missing
          log.warn(
            {
              err: serializeError(dualWriteError),
              sessionId: event.sessionId,
              eventType: event.type,
              eventId: event.id,
            },
            "logConsumer:conversation:append:failed"
          );
          // Don't re-throw - interactions table write succeeded, that's what matters
        }

        return;
      }

      // Org-level and CRM events are now persisted to events table (above)
      // CRM activities are read from events table via activity-service

      // Track successful interaction persistence
      if (event.sessionId) {
        trackInteractionPersistenceAttempt(true);
      }
    } catch (error) {
      // Track failed interaction persistence (critical for monitoring)
      if (event.sessionId) {
        trackInteractionPersistenceAttempt(false);
      }

      log.warn(
        {
          eventType: event.type,
          eventId: event.id,
          clientId: event.clientId,
          sessionId: event.sessionId,
          err: serializeError(error),
        },
        "logConsumer:saveFailed"
      );
    }
  },
};
