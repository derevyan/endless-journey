/**
 * Workflow Approval Timer Service
 *
 * BullMQ-based timer for handling approval timeouts.
 * When an approval times out, it automatically applies the configured
 * timeout action (approve, reject, or skip).
 *
 * @module services/timers/approval-timer-service
 */

import { Queue, Worker, Job } from "bullmq";
import { createLogger, serializeError } from "@journey/logger";
import { ServiceUnavailableError } from "@journey/schemas";

import { getRedisConnection } from "../../lib/redis";
import { getQueueStats as getQueueStatsUtil, type QueueStats } from "./queue-utils";

const log = createLogger("workflow-approval-timer");

// =============================================================================
// TYPES
// =============================================================================

export interface ApprovalTimeoutJobData {
  approvalId: string;
  workflowId: string;
  nodeId: string;
  timeoutAction: "approve" | "reject" | "skip";
  scheduledAt: string;
}

export interface ApprovalTimeoutCallback {
  (data: ApprovalTimeoutJobData): Promise<void>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const queueName = "workflow-approval-timeouts";

// =============================================================================
// SERVICE
// =============================================================================

let queue: Queue<ApprovalTimeoutJobData> | null = null;
let worker: Worker<ApprovalTimeoutJobData> | null = null;

/**
 * Get the initialized queue or throw if not initialized.
 * Provides a type-safe way to access the queue.
 */
function getQueue(): Queue<ApprovalTimeoutJobData> {
  if (!queue) {
    throw new ServiceUnavailableError("Approval timer service not initialized");
  }
  return queue;
}

/**
 * Initialize the approval timer service.
 *
 * @param onTimeout - Callback when an approval times out
 */
export async function initApprovalTimerService(onTimeout: ApprovalTimeoutCallback): Promise<void> {
  const connection = getRedisConnection();

  // Create queue
  queue = new Queue<ApprovalTimeoutJobData>(queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 50, // Keep last 50 failed jobs for debugging
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  });

  // Create worker
  worker = new Worker<ApprovalTimeoutJobData>(
    queueName,
    async (job: Job<ApprovalTimeoutJobData>) => {
      log.info(
        { jobId: job.id, approvalId: job.data.approvalId, action: job.data.timeoutAction },
        "approvalTimer:jobProcessing"
      );

      try {
        await onTimeout(job.data);
        log.info({ jobId: job.id, approvalId: job.data.approvalId }, "approvalTimer:jobCompleted");
      } catch (error) {
        log.error({ jobId: job.id, err: serializeError(error) }, "approvalTimer:jobFailed");
        throw error; // Re-throw to trigger retry
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 timeouts concurrently
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    log.debug({ jobId: job?.id }, "approvalTimer:worker:completed");
  });

  worker.on("failed", (job, error) => {
    log.error({ jobId: job?.id, err: serializeError(error) }, "approvalTimer:worker:failed");
  });

  worker.on("error", (error) => {
    log.error({ err: serializeError(error) }, "approvalTimer:worker:error");
  });

  log.info({ queueName }, "approvalTimer:initialized");
}

/**
 * Schedule a timeout for an approval.
 *
 * @param approvalId - The approval record ID
 * @param workflowId - The workflow ID
 * @param nodeId - The user_approval node ID
 * @param timeoutAction - Action to take on timeout
 * @param delayMs - Delay in milliseconds before the timeout fires
 * @returns Job ID for cancellation
 */
export async function scheduleApprovalTimeout(
  approvalId: string,
  workflowId: string,
  nodeId: string,
  timeoutAction: "approve" | "reject" | "skip",
  delayMs: number
): Promise<string> {
  const q = getQueue();

  const jobData: ApprovalTimeoutJobData = {
    approvalId,
    workflowId,
    nodeId,
    timeoutAction,
    scheduledAt: new Date().toISOString(),
  };

  const job = await q.add(`approval-timeout-${approvalId}`, jobData, {
    delay: delayMs,
  });

  // Verify job.id exists (BullMQ should always provide one, but let's be safe)
  if (!job.id) {
    log.error({ approvalId, workflowId }, "approvalTimer:schedule:noJobId");
    throw new Error("BullMQ job created without ID");
  }

  log.info(
    {
      jobId: job.id,
      approvalId,
      workflowId,
      nodeId,
      timeoutAction,
      delayMs,
      firesAt: new Date(Date.now() + delayMs).toISOString(),
    },
    "approvalTimer:scheduled"
  );

  return job.id;
}

/**
 * Cancel a scheduled approval timeout.
 *
 * @param jobId - The BullMQ job ID returned from scheduleApprovalTimeout
 * @returns Whether the cancellation succeeded
 */
export async function cancelApprovalTimeout(jobId: string): Promise<boolean> {
  const q = getQueue();

  try {
    const job = await q.getJob(jobId);
    if (job) {
      await job.remove();
      log.info({ jobId }, "approvalTimer:cancelled");
      return true;
    }
    log.debug({ jobId }, "approvalTimer:notFound");
    return false;
  } catch (error) {
    log.error({ jobId, err: serializeError(error) }, "approvalTimer:cancelError");
    return false;
  }
}

/**
 * Get queue statistics
 */
export async function getApprovalTimerStats(): Promise<QueueStats> {
  const q = getQueue();
  return getQueueStatsUtil(q);
}

/**
 * Gracefully shutdown the approval timer service
 */
export async function shutdownApprovalTimerService(): Promise<void> {
  log.info({}, "approvalTimer:shuttingDown");

  if (worker) {
    await worker.close();
    worker = null;
  }

  if (queue) {
    await queue.close();
    queue = null;
  }

  log.info({}, "approvalTimer:shutdown");
}
