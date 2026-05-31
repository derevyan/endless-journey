/**
 * Automation Consumer
 *
 * Publishes events to BullMQ queue for automation trigger processing.
 * Only events with clientId are processed (automations need a target client).
 *
 * @module events/consumers/automation-consumer
 */

import { Queue } from "bullmq";
import { createLogger, serializeError } from "@journey/logger";
import type { BaseEvent } from "@journey/schemas";
import type { EventConsumerHandler } from "../event-bus";
import { getRedisConnection } from "../../lib/redis";
import { automationQueueConfig } from "../../lib/queue-config";
import { simpleHash } from "../../lib/utils";

const log = createLogger("automation-consumer");

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a deterministic job ID for deduplication
 * Jobs with the same ID won't be added if one already exists in the queue
 * Note: BullMQ doesn't allow colons in job IDs, so we use underscores and hashes
 */
function generateJobId(event: BaseEvent): string {
  // Use event content to create unique key
  // This prevents exact duplicate events from creating duplicate jobs
  // Hash the payload to avoid special characters (colons, quotes, etc.)
  const payloadHash = simpleHash(JSON.stringify(event.payload));
  // Replace dots in event type with underscores (crm.pipeline.entered -> crm_pipeline_entered)
  const safeEventType = event.type.replace(/\./g, "_");
  return `${safeEventType}_${event.organizationId}_${event.clientId || "org"}_${payloadHash}`;
}

// =============================================================================
// STATE
// =============================================================================

let queue: Queue | null = null;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the automation consumer queue
 * Must be called before consumer can process events
 */
export function initAutomationConsumerQueue(): void {
  if (queue) {
    log.warn({}, "automationConsumer:queueAlreadyInitialized");
    return;
  }

  const connection = getRedisConnection();

  queue = new Queue(automationQueueConfig.name, {
    connection,
    defaultJobOptions: automationQueueConfig.defaultJobOptions,
  });

  log.info({}, "automationConsumer:queueInitialized");
}

/**
 * Get the automation queue instance
 */
export function getAutomationQueue(): Queue | null {
  return queue;
}

// =============================================================================
// CONSUMER
// =============================================================================

/**
 * Get the group key for client-based partitioning
 *
 * Events for the same client should ideally be processed in order.
 * This group key enables FIFO processing per client if using BullMQ Pro.
 *
 * For BullMQ open-source, the sequence number in the event data can be used
 * by the handler to detect out-of-order processing and handle accordingly.
 */
function getEventGroupKey(event: BaseEvent): string {
  // Events for the same client should be processed in order
  if (event.clientId) {
    return `client:${event.organizationId}:${event.clientId}`;
  }
  // Org-level events can be processed in parallel
  return `org:${event.organizationId}`;
}

/**
 * Automation Consumer - publishes events to BullMQ for automation processing
 *
 * Note: We allow ALL events through to the queue, including org-level events
 * that don't have a clientId. The automation-matcher and automation-handler
 * will filter appropriately based on event type and trigger requirements.
 *
 * This enables future support for org-level automations (e.g., pipeline created
 * triggers organizational workflows).
 *
 * Ordering: Events include a sequence number for ordering within an organization.
 * With BullMQ Pro, use the groupKey for FIFO processing per client.
 * With BullMQ OSS, the handler should use the sequence to detect missed/reordered events.
 */
export const automationConsumer: EventConsumerHandler = {
  name: "automation",

  async handle(event: BaseEvent): Promise<void> {
    if (!queue) {
      log.warn(
        { eventType: event.type },
        "automationConsumer:queueNotInitialized"
      );
      return;
    }

    try {
      const jobId = generateJobId(event);
      const groupKey = getEventGroupKey(event);

      // Add job with group information for potential FIFO processing
      // Note: BullMQ Pro supports job groups natively for FIFO per group
      // For OSS, the groupKey is included in data for manual handling if needed
      const job = await queue.add(
        event.type,
        { ...event, groupKey },
        { jobId }
      );

      log.debug(
        {
          eventType: event.type,
          jobId: job.id,
          clientId: event.clientId,
          sequence: event.sequence,
          groupKey,
          dedupKey: jobId,
        },
        "automationConsumer:queued"
      );
    } catch (error) {
      // Log and continue - don't throw to allow other consumers to process
      log.warn(
        { eventType: event.type, err: serializeError(error) },
        "automationConsumer:queueFailed"
      );
    }
  },
};

// =============================================================================
// SHUTDOWN
// =============================================================================

/**
 * Shutdown the automation consumer queue
 */
export async function shutdownAutomationConsumerQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
    log.info({}, "automationConsumer:queueShutdown");
  }
}
