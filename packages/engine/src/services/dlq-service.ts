/**
 * Dead Letter Queue Service
 *
 * Persists failed events for later retry or analysis.
 * Used by EventQueue to record events that failed during processing.
 */

import { createLogger, serializeError } from "@journey/logger";
import type { JourneyEvent } from "../types";

const log = createLogger("dlq-service");

/**
 * Record of a failed event for persistence
 */
export interface FailedEventRecord {
  sessionId: string;
  journeyId?: string;
  organizationId?: string;
  eventType: string;
  eventPayload: JourneyEvent;
  sessionContext?: Record<string, unknown>;
  currentNodeId?: string;
  errorMessage: string;
  errorStack?: string;
}

/**
 * Context for recording a failed event
 */
export interface FailedEventContext {
  sessionId: string;
  journeyId?: string;
  organizationId?: string;
  currentNodeId?: string;
  sessionContext?: Record<string, unknown>;
}

/**
 * Configuration for the DLQ service
 */
export interface DlqServiceConfig {
  /**
   * Callback to persist failed event to database
   * If not provided, events are logged but not persisted
   */
  onPersist?: (record: FailedEventRecord) => Promise<void>;

  /** Custom logger */
  logger?: ReturnType<typeof createLogger>;
}

/**
 * Dead Letter Queue service interface
 */
export interface DlqService {
  /**
   * Record a failed event for later processing
   *
   * @param event - The event that failed
   * @param error - The error that occurred
   * @param context - Context about the session/journey
   */
  recordFailure(event: JourneyEvent, error: Error, context: FailedEventContext): Promise<void>;
}

/**
 * Create a DLQ service instance
 *
 * The service always logs failed events via @journey/logger.
 * If an onPersist callback is provided, it also persists to database.
 *
 * @example
 * ```ts
 * const dlq = createDlqService({
 *   onPersist: async (record) => {
 *     await db.insert(failedEvents).values({
 *       sessionId: record.sessionId,
 *       eventType: record.eventType,
 *       // ...
 *     });
 *   },
 * });
 * ```
 */
export function createDlqService(config: DlqServiceConfig = {}): DlqService {
  const logger = config.logger ?? log;

  return {
    async recordFailure(event, error, context) {
      const record: FailedEventRecord = {
        sessionId: context.sessionId,
        journeyId: context.journeyId,
        organizationId: context.organizationId,
        eventType: event.type,
        eventPayload: event,
        sessionContext: context.sessionContext,
        currentNodeId: context.currentNodeId,
        errorMessage: error.message,
        errorStack: error.stack,
      };

      // Always log the failure with full context
      logger.error(
        {
          eventType: event.type,
          sessionId: context.sessionId,
          journeyId: context.journeyId,
          nodeId: context.currentNodeId,
          err: serializeError(error),
        },
        "dlq:eventFailed"
      );

      // Persist if callback provided
      if (config.onPersist) {
        try {
          await config.onPersist(record);
          logger.info({ eventType: event.type, sessionId: context.sessionId }, "dlq:eventPersisted");
        } catch (persistError) {
          // DLQ persistence failed - log but don't throw
          // The original error is more important than persistence failure
          logger.error({ err: serializeError(persistError) }, "dlq:persistFailed");
        }
      }
    },
  };
}
