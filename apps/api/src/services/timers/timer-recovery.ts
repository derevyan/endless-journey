/**
 * Timer Recovery Service
 *
 * Recovers timers on API startup by reconciling PostgreSQL state with BullMQ.
 * Uses PostgreSQL advisory lock to prevent concurrent recovery across instances.
 *
 * Determines adapter type from session mode:
 * - session.mode === 'simulation' → adapterType: 'simulator'
 * - session.mode === 'test' → adapterType: 'telegram' (test mode uses Telegram adapter)
 * - session.mode === 'live' → adapterType: 'telegram'
 *
 * @module services/timers/timer-recovery
 */

import { createLogger, serializeError } from "@journey/logger";
import { eq } from "drizzle-orm";
import { db, durableTimers, journeySessions, queryClient } from "@journey/db";

import { getTimerQueue, createTimerJobData, type TimerJobData } from "./bull-timer-service";
import { handleTimerFired } from "./timer-handler";

const log = createLogger("timer-recovery");

// Advisory lock ID for timer recovery (arbitrary unique number)
const RECOVERY_LOCK_ID = 12345;

/**
 * Recover timers on API startup
 *
 * 1. Acquires PostgreSQL advisory lock (prevents concurrent recovery)
 * 2. Gets all active timers from PostgreSQL
 * 3. Gets all delayed jobs from BullMQ
 * 4. Fires missed timers (fires_at < now)
 * 5. Reschedules missing BullMQ jobs
 * 6. Releases lock
 */
export async function recoverTimers(): Promise<void> {
  log.info({}, "timerRecovery:starting");

  // 1. Try to acquire advisory lock
  const lockResult = await queryClient`SELECT pg_try_advisory_lock(${RECOVERY_LOCK_ID}) as acquired`;

  const acquired = lockResult[0]?.acquired;
  if (!acquired) {
    log.info({}, "timerRecovery:skipped:anotherInstanceRunning");
    return;
  }

  try {
    // 2. Get all active timers from PostgreSQL
    const activeTimers = await db.query.durableTimers.findMany({
      where: eq(durableTimers.status, "active"),
    });

    if (activeTimers.length === 0) {
      log.info({}, "timerRecovery:noActiveTimers");
      return;
    }

    // 3. Get all delayed jobs from BullMQ
    const queue = getTimerQueue();
    if (!queue) {
      log.warn({}, "timerRecovery:queueNotInitialized");
      return;
    }

    const delayedJobs = await queue.getJobs(["delayed", "waiting"]);
    const existingJobIds = new Set(delayedJobs.map((j) => j.id));

    let missedCount = 0;
    let rescheduledCount = 0;
    let skippedCount = 0;

    // 4. Process each timer
    for (const timer of activeTimers) {
      const remaining = timer.firesAt.getTime() - Date.now();

      // Fetch session to determine adapter type from mode
      const session = await db.query.journeySessions.findFirst({
        where: eq(journeySessions.id, timer.sessionId),
        columns: { mode: true },
      });

      // Derive adapterType from session mode (simulation → simulator, otherwise telegram)
      const adapterType: "telegram" | "simulator" =
        session?.mode === "simulation" ? "simulator" : "telegram";

      if (remaining <= 0) {
        // Timer should have fired - fire it now
        log.warn({ timerId: timer.id, edgeId: timer.edgeId, adapterType }, "timerRecovery:missedTimer:firingNow");

        try {
          await handleTimerFired({
            sessionId: timer.sessionId,
            telegramUserId: "", // Will be resolved by handler
            channelId: timer.channelId,
            edgeId: timer.edgeId,
            scheduledAt: timer.createdAt?.toISOString() ?? new Date().toISOString(),
            adapterType,
            timerId: timer.bullmqJobId ?? undefined,
          });
          missedCount++;
        } catch (error) {
          log.error({ timerId: timer.id, err: serializeError(error) }, "timerRecovery:missedTimer:error");
        }
      } else if (!timer.bullmqJobId || !existingJobIds.has(timer.bullmqJobId)) {
        // BullMQ job is missing - reschedule it
        log.info({ timerId: timer.id, remaining, adapterType }, "timerRecovery:rescheduling");

        try {
          const jobData = createTimerJobData({
            sessionId: timer.sessionId,
            edgeId: timer.edgeId,
            channelId: timer.channelId,
            adapterType,
          });

          const job = await queue.add(
            `timer-${timer.sessionId}-${timer.edgeId}`,
            jobData,
            { delay: remaining }
          );

          // Update PostgreSQL with new job ID
          await db
            .update(durableTimers)
            .set({ bullmqJobId: job.id })
            .where(eq(durableTimers.id, timer.id));

          rescheduledCount++;
        } catch (error) {
          log.error({ timerId: timer.id, err: serializeError(error) }, "timerRecovery:reschedule:error");
        }
      } else {
        // Job exists and hasn't fired yet - nothing to do
        skippedCount++;
      }
    }

    log.info(
      {
        total: activeTimers.length,
        missed: missedCount,
        rescheduled: rescheduledCount,
        skipped: skippedCount,
      },
      "timerRecovery:complete"
    );
  } finally {
    // 6. Release advisory lock
    await queryClient`SELECT pg_advisory_unlock(${RECOVERY_LOCK_ID})`;
    log.debug({}, "timerRecovery:lockReleased");
  }
}
