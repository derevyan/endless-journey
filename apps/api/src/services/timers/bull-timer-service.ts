/**
 * BullMQ Timer Service
 *
 * Production-grade timer service using BullMQ and Redis.
 * Timers survive server restarts and can be distributed across multiple workers.
 *
 * @module services/timers/bull-timer-service
 */

import { Queue, Worker, Job } from "bullmq";
import { createLogger, serializeError } from "@journey/logger";
import { ServiceUnavailableError } from "@journey/schemas";
import { eq, and } from "drizzle-orm";
import { db, durableTimers, withTransaction } from "@journey/db";

import { getRedisConnection } from "../../lib/redis";
import { getQueueStats as getQueueStatsUtil, type QueueStats } from "./queue-utils";

const log = createLogger("bull-timer-service");

export function isJobLockedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  return message.includes("locked by another worker");
}

// =============================================================================
// TYPES
// =============================================================================

export interface TimerJobData {
  sessionId: string;
  telegramUserId: string;
  channelId: string | null; // Nullable for simulator sessions
  edgeId: string;
  scheduledAt: string;
  adapterType?: "telegram" | "simulator" | "mock"; // Optional adapter type for routing timer callbacks
  /** The actual BullMQ job ID - used for follow-up timer lookup when skipping timers */
  timerId?: string;
}

export interface TimerCallback {
  (data: TimerJobData): Promise<void>;
}

/**
 * Factory function to create TimerJobData with consistent defaults.
 *
 * Ensures all timer job data is constructed uniformly across:
 * - TelegramAdapter.scheduleTimer()
 * - SimulatorAdapter.scheduleTimer()
 * - resumeSessionTimers()
 * - timer-recovery.ts
 *
 * @param params - Required and optional timer parameters
 * @returns Complete TimerJobData object
 */
export function createTimerJobData(params: {
  sessionId: string;
  edgeId: string;
  channelId: string | null;
  telegramUserId?: string;
  adapterType?: "telegram" | "simulator" | "mock";
}): TimerJobData {
  return {
    sessionId: params.sessionId,
    telegramUserId: params.telegramUserId ?? "",
    channelId: params.channelId,
    edgeId: params.edgeId,
    scheduledAt: new Date().toISOString(),
    adapterType: params.adapterType,
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const queueName = "journey-timers";

// =============================================================================
// SERVICE
// =============================================================================

let queue: Queue<TimerJobData> | null = null;
let worker: Worker<TimerJobData> | null = null;

/**
 * Get the initialized queue or throw if not initialized.
 * Provides a type-safe way to access the queue.
 */
function getQueue(): Queue<TimerJobData> {
  if (!queue) {
    throw new ServiceUnavailableError("Timer service not initialized");
  }
  return queue;
}

/**
 * Initialize the timer service
 */
export async function initTimerService(onTimerFired: TimerCallback): Promise<void> {
  const connection = getRedisConnection();

  // Create queue
  queue = new Queue<TimerJobData>(queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100, // Keep last 100 failed jobs for debugging
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  });

  // Create worker
  worker = new Worker<TimerJobData>(
    queueName,
    async (job: Job<TimerJobData>) => {
      log.info(
        { jobId: job.id, sessionId: job.data.sessionId, edgeId: job.data.edgeId },
        "timerService:jobProcessing"
      );

      try {
        // Pass job.id as timerId so follow-up timer lookup works
        // (followUpMap is keyed by the BullMQ job ID returned from scheduleTimer)
        const dataWithTimerId: TimerJobData = { ...job.data, timerId: job.id };
        await onTimerFired(dataWithTimerId);
        log.info({ jobId: job.id }, "timerService:jobCompleted");
      } catch (error) {
        log.error({ jobId: job.id, err: serializeError(error) }, "timerService:jobFailed");
        throw error; // Re-throw to trigger retry
      }
    },
    {
      connection,
      concurrency: 10, // Process up to 10 jobs concurrently
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    log.debug({ jobId: job?.id }, "timerService:worker:completed");
  });

  worker.on("failed", (job, error) => {
    log.error({ jobId: job?.id, err: serializeError(error) }, "timerService:worker:failed");
  });

  worker.on("error", (error) => {
    log.error({ err: serializeError(error) }, "timerService:worker:error");
  });

  log.info({ queueName }, "timerService:initialized");
}

/**
 * Schedule a timer
 *
 * Writes to PostgreSQL first (source of truth), then schedules BullMQ job.
 * Uses a transaction to ensure DB operations are atomic.
 *
 * Note: BullMQ job scheduling is NOT transactional with DB. If BullMQ fails
 * after DB insert, the transaction rolls back. If DB update fails after
 * BullMQ add, job exists but DB record is rolled back - the recovery
 * mechanism handles orphaned jobs via timer-recovery.ts.
 *
 * @param data - Timer job data
 * @param delayMs - Delay in milliseconds before the timer fires
 * @returns Job ID for cancellation
 */
export async function scheduleTimer(data: TimerJobData, delayMs: number): Promise<string> {
  const q = getQueue();
  const firesAt = new Date(Date.now() + delayMs);

  try {
    const result = await withTransaction(async (tx) => {
      // 1. Write to PostgreSQL (source of truth)
      const [timer] = await tx
        .insert(durableTimers)
        .values({
          sessionId: data.sessionId,
          channelId: data.channelId,
          edgeId: data.edgeId,
          firesAt,
          status: "active",
        })
        .returning();

      // 2. Schedule BullMQ job (outside transaction, but if this fails, transaction rolls back)
      const job = await q.add(`timer-${data.sessionId}-${data.edgeId}`, data, {
        delay: delayMs,
      });

      // 3. Verify job.id exists (BullMQ should always provide one, but let's be safe)
      if (!job.id) {
        log.error({ timerId: timer.id, sessionId: data.sessionId }, "timerService:schedule:noJobId");
        throw new Error("BullMQ job created without ID");
      }

      // 4. Update with BullMQ job ID (within transaction)
      await tx
        .update(durableTimers)
        .set({ bullmqJobId: job.id })
        .where(eq(durableTimers.id, timer.id));

      return { timerId: timer.id, jobId: job.id };
    });

    log.info(
      {
        timerId: result.timerId,
        jobId: result.jobId,
        sessionId: data.sessionId,
        edgeId: data.edgeId,
        delayMs,
        firesAt: firesAt.toISOString(),
      },
      "timerService:timerScheduled"
    );

    return result.jobId;
  } catch (error) {
    log.error(
      {
        sessionId: data.sessionId,
        edgeId: data.edgeId,
        delayMs,
        err: serializeError(error),
      },
      "timerService:scheduleTimer:failed"
    );
    throw error;
  }
}

/**
 * Cancel a timer by job ID
 *
 * Updates PostgreSQL status to 'cancelled', then removes BullMQ job.
 */
export async function cancelTimer(jobId: string): Promise<boolean> {
  const q = getQueue();

  try {
    // 1. Update PostgreSQL status
    await db
      .update(durableTimers)
      .set({ status: "cancelled" })
      .where(eq(durableTimers.bullmqJobId, jobId));

    // 2. Remove BullMQ job
    const job = await q.getJob(jobId);
    if (job) {
      try {
        await job.remove();
      } catch (error) {
        if (isJobLockedError(error)) {
          log.debug({ jobId }, "timerService:timerCancelSkipped:jobLocked");
          return true;
        }
        throw error;
      }
      log.info({ jobId }, "timerService:timerCancelled");
      return true;
    }
    log.debug({ jobId }, "timerService:timerNotFound");
    return false;
  } catch (error) {
    log.error({ jobId, err: serializeError(error) }, "timerService:cancelError");
    return false;
  }
}

/**
 * Find an active timer by session ID and edge ID
 *
 * Used for robust timer cancellation when in-memory state is lost (e.g., after server restart).
 *
 * @param sessionId - Session ID
 * @param edgeId - Edge ID
 * @returns Timer record with bullmqJobId, or null if not found
 */
export async function getActiveTimerBySessionAndEdge(
  sessionId: string,
  edgeId: string
): Promise<{ id: string; bullmqJobId: string | null } | null> {
  try {
    const result = await db
      .select({
        id: durableTimers.id,
        bullmqJobId: durableTimers.bullmqJobId,
      })
      .from(durableTimers)
      .where(
        and(
          eq(durableTimers.sessionId, sessionId),
          eq(durableTimers.edgeId, edgeId),
          eq(durableTimers.status, "active")
        )
      )
      .limit(1);

    return result[0] ?? null;
  } catch (error) {
    log.error({ sessionId, edgeId, err: serializeError(error) }, "timerService:getActiveTimerBySessionAndEdge:error");
    return null;
  }
}

/**
 * Cancel all timers for a session
 *
 * Updates PostgreSQL status to 'cancelled', then removes BullMQ jobs.
 */
export async function cancelSessionTimers(sessionId: string): Promise<number> {
  const q = getQueue();

  let cancelledCount = 0;

  try {
    // 1. Get active timers from PostgreSQL
    const timers = await db.query.durableTimers.findMany({
      where: and(eq(durableTimers.sessionId, sessionId), eq(durableTimers.status, "active")),
    });

    // 2. Remove BullMQ jobs
    for (const timer of timers) {
      if (timer.bullmqJobId) {
        const job = await q.getJob(timer.bullmqJobId);
        if (job) {
          try {
            await job.remove();
          } catch (error) {
            if (!isJobLockedError(error)) {
              throw error;
            }
            log.debug({ jobId: timer.bullmqJobId }, "timerService:sessionTimerCancelSkipped:jobLocked");
          }
        }
      }
      cancelledCount++;
    }

    // 3. Update PostgreSQL status
    await db
      .update(durableTimers)
      .set({ status: "cancelled" })
      .where(and(eq(durableTimers.sessionId, sessionId), eq(durableTimers.status, "active")));

    log.info({ sessionId, cancelledCount }, "timerService:sessionTimersCancelled");
    return cancelledCount;
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "timerService:cancelSessionError");
    return cancelledCount;
  }
}

/**
 * Pause all timers for a session
 *
 * Stores pausedAt timestamp in PostgreSQL, cancels BullMQ jobs.
 * Timer can be resumed later with remaining time.
 */
export async function pauseSessionTimers(
  sessionId: string,
  options: { preserveJobId?: boolean } = {}
): Promise<number> {
  const q = getQueue();

  let pausedCount = 0;
  const { preserveJobId = false } = options;

  try {
    // 1. Get active timers from PostgreSQL
    const timers = await db.query.durableTimers.findMany({
      where: and(eq(durableTimers.sessionId, sessionId), eq(durableTimers.status, "active")),
    });

    // 2. Cancel BullMQ jobs
    for (const timer of timers) {
      if (timer.bullmqJobId) {
        const job = await q.getJob(timer.bullmqJobId);
        if (job) {
          try {
            await job.remove();
          } catch (error) {
            if (!isJobLockedError(error)) {
              throw error;
            }
            log.debug({ jobId: timer.bullmqJobId }, "timerService:sessionTimerPauseSkipped:jobLocked");
          }
        }
      }
      pausedCount++;
    }

    // 3. Update PostgreSQL: set status to paused, store pausedAt
    const updateData: Partial<typeof durableTimers.$inferInsert> = {
      status: "paused",
      pausedAt: new Date(),
    };
    if (!preserveJobId) {
      updateData.bullmqJobId = null;
    }

    await db
      .update(durableTimers)
      .set(updateData)
      .where(and(eq(durableTimers.sessionId, sessionId), eq(durableTimers.status, "active")));

    log.info({ sessionId, pausedCount }, "timerService:sessionTimersPaused");
    return pausedCount;
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "timerService:pauseSessionError");
    return pausedCount;
  }
}

/**
 * Resume all paused timers for a session
 *
 * Calculates remaining time from firesAt - pausedAt, reschedules BullMQ jobs.
 */
export async function resumeSessionTimers(sessionId: string): Promise<number> {
  const q = getQueue();

  let resumedCount = 0;

  try {
    // 1. Get paused timers from PostgreSQL
    const timers = await db.query.durableTimers.findMany({
      where: and(eq(durableTimers.sessionId, sessionId), eq(durableTimers.status, "paused")),
    });

    // 2. Reschedule each timer
    for (const timer of timers) {
      // Calculate remaining time (firesAt - pausedAt = original remaining duration)
      const remainingMs = timer.firesAt.getTime() - (timer.pausedAt?.getTime() ?? Date.now());
      const newFiresAt = new Date(Date.now() + Math.max(remainingMs, 0));

      // Schedule new BullMQ job using factory
      const jobData = createTimerJobData({
        sessionId: timer.sessionId,
        edgeId: timer.edgeId,
        channelId: timer.channelId,
      });

      const job = await q.add(
        `timer-${timer.sessionId}-${timer.edgeId}`,
        jobData,
        { delay: Math.max(remainingMs, 1000) }
      );

      // Update PostgreSQL
      await db
        .update(durableTimers)
        .set({
          status: "active",
          firesAt: newFiresAt,
          pausedAt: null,
          bullmqJobId: job.id,
        })
        .where(eq(durableTimers.id, timer.id));

      resumedCount++;
    }

    log.info({ sessionId, resumedCount }, "timerService:sessionTimersResumed");
    return resumedCount;
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "timerService:resumeSessionError");
    return resumedCount;
  }
}

/**
 * Delete all timers for a session (for terminate mode)
 *
 * Removes from both PostgreSQL and BullMQ.
 */
export async function deleteSessionTimers(sessionId: string): Promise<number> {
  const q = getQueue();

  let deletedCount = 0;

  try {
    // 1. Get all timers from PostgreSQL
    const timers = await db.query.durableTimers.findMany({
      where: eq(durableTimers.sessionId, sessionId),
    });

    // 2. Remove BullMQ jobs
    for (const timer of timers) {
      if (timer.bullmqJobId) {
        const job = await q.getJob(timer.bullmqJobId);
        await job?.remove();
      }
      deletedCount++;
    }

    // 3. Delete from PostgreSQL
    await db.delete(durableTimers).where(eq(durableTimers.sessionId, sessionId));

    log.info({ sessionId, deletedCount }, "timerService:sessionTimersDeleted");
    return deletedCount;
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "timerService:deleteSessionError");
    return deletedCount;
  }
}

/**
 * Get the timer queue (for recovery service)
 */
export function getTimerQueue(): Queue<TimerJobData> | null {
  return queue;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const q = getQueue();
  return getQueueStatsUtil(q);
}

/**
 * Gracefully shutdown the timer service
 *
 * Note: Does NOT close the shared Redis connection.
 * Call closeRedisConnection() separately during app shutdown.
 */
export async function shutdownTimerService(): Promise<void> {
  log.info({}, "timerService:shuttingDown");

  if (worker) {
    await worker.close();
    worker = null;
  }

  if (queue) {
    await queue.close();
    queue = null;
  }

  log.info({}, "timerService:shutdown");
}
