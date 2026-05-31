/**
 * Automation Event Service
 *
 * BullMQ-based event bus for automation triggers.
 * Publishes events when tags/variables change, journeys complete, etc.
 * Workers process events and start matching automation journeys.
 *
 * @module events/automation/service
 */

import { createLogger, serializeError } from "@journey/logger";
import type { BaseEvent } from "@journey/schemas";
import { Job, Queue, Worker } from "bullmq";

import { automationQueueConfig } from "../../lib/queue-config";
import { getRedisConnection } from "../../lib/redis";

const log = createLogger("automation-event-service");

// =============================================================================
// TYPES
// =============================================================================

export type AutomationEventCallback = (event: BaseEvent) => Promise<void>;

// =============================================================================
// SERVICE STATE
// =============================================================================

let queue: Queue<BaseEvent> | null = null;
let worker: Worker<BaseEvent> | null = null;
let isInitialized = false;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the automation event service
 *
 * Sets up the BullMQ queue and worker for processing automation events.
 *
 * @param onEvent - Callback function to handle incoming events
 */
export async function initAutomationEventService(onEvent: AutomationEventCallback): Promise<void> {
  if (isInitialized) {
    log.warn({}, "automationEventService:alreadyInitialized");
    return;
  }

  const connection = getRedisConnection();

  // Create queue for publishing events
  queue = new Queue<BaseEvent>(automationQueueConfig.name, {
    connection,
    defaultJobOptions: automationQueueConfig.defaultJobOptions,
  });

  // Create worker for processing events
  worker = new Worker<BaseEvent>(
    automationQueueConfig.name,
    async (job: Job<BaseEvent>) => {
      const event = job.data;
      log.info(
        {
          jobId: job.id,
          eventType: event.type,
          organizationId: event.organizationId,
        },
        "automationEventService:processingEvent"
      );

      try {
        await onEvent(event);
        log.debug({ jobId: job.id, eventType: event.type }, "automationEventService:eventProcessed");
      } catch (error) {
        log.error({ jobId: job.id, eventType: event.type, err: serializeError(error) }, "automationEventService:eventFailed");
        throw error; // Re-throw to trigger retry
      }
    },
    {
      connection,
      concurrency: automationQueueConfig.workerConcurrency,
    }
  );

  // Event handlers for monitoring
  worker.on("completed", (job) => {
    log.debug({ jobId: job?.id }, "automationEventService:worker:completed");
  });

  worker.on("failed", (job, error) => {
    log.error({ jobId: job?.id, err: serializeError(error) }, "automationEventService:worker:failed");
  });

  worker.on("error", (error) => {
    log.error({ err: serializeError(error) }, "automationEventService:worker:error");
  });

  isInitialized = true;
  log.info({ queueName: automationQueueConfig.name }, "automationEventService:initialized");
}

// =============================================================================
// QUEUE ACCESS
// =============================================================================

/**
 * Get the automation queue instance (for Bull Board)
 */
export function getAutomationQueue(): Queue<BaseEvent> | null {
  return queue;
}

// =============================================================================
// STATUS
// =============================================================================

/**
 * Check if the automation event service is initialized
 */
export function isAutomationEventServiceInitialized(): boolean {
  return isInitialized;
}

/**
 * Get queue statistics
 */
export async function getAutomationEventQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  if (!queue) {
    return null;
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// =============================================================================
// SHUTDOWN
// =============================================================================

/**
 * Gracefully shutdown the automation event service
 *
 * Note: Does NOT close the shared Redis connection.
 * Call closeRedisConnection() separately during app shutdown.
 */
export async function shutdownAutomationEventService(): Promise<void> {
  log.info({}, "automationEventService:shuttingDown");

  if (worker) {
    await worker.close();
    worker = null;
  }

  if (queue) {
    await queue.close();
    queue = null;
  }

  isInitialized = false;
  log.info({}, "automationEventService:shutdown");
}
