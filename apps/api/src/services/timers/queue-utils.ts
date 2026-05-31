/**
 * Timer Queue Utilities
 *
 * Shared utilities for BullMQ queue operations across timer services.
 *
 * @module services/timers/queue-utils
 */

import type { Queue } from "bullmq";

/**
 * Queue statistics for monitoring and debugging.
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Get statistics for a BullMQ queue.
 *
 * @example
 * ```ts
 * const stats = await getQueueStats(timerQueue);
 * log.info({ stats }, "timer:queueStats");
 * ```
 */
export async function getQueueStats(queue: Queue): Promise<QueueStats> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
