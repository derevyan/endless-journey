/**
 * Queue Configuration
 *
 * Centralized configuration for BullMQ queues.
 * Provides shared settings for event processing queues.
 *
 * @module lib/queue-config
 */

// =============================================================================
// AUTOMATION QUEUE CONFIG
// =============================================================================

/**
 * Configuration for the automation events queue
 * Used by both producer (automation-consumer) and worker (automation-event-service)
 */
export const automationQueueConfig = {
  /** Queue name in Redis */
  name: "journey-events",

  /** Default job options for all jobs added to the queue */
  defaultJobOptions: {
    /** Keep last N completed jobs for debugging */
    removeOnComplete: 100,
    /** Keep last N failed jobs for debugging */
    removeOnFail: 500,
    /** Number of retry attempts on failure */
    attempts: 3,
    /** Exponential backoff configuration */
    backoff: {
      type: "exponential" as const,
      delay: 1000,
    },
  },

  /** Worker concurrency (number of jobs processed in parallel) */
  workerConcurrency: 10,
};

// =============================================================================
// TIMER QUEUE CONFIG
// =============================================================================

/**
 * Configuration for the timer queue (delayed jobs)
 * Used by bull-timer-service for scheduling delayed transitions
 */
export const timerQueueConfig = {
  /** Queue name in Redis */
  name: "journey-timers",

  /** Default job options */
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 1000,
    },
  },
};

// =============================================================================
// DATA RETENTION QUEUE CONFIG
// =============================================================================

/**
 * Configuration for the data retention queue
 * Used by data-retention-service for cleaning up old data from multiple tables
 */
export const dataRetentionQueueConfig = {
  /** Queue name in Redis */
  name: "data-retention",

  /** Default job options */
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 5000,
    },
  },

  /** Batch size for deletion (to avoid long locks) */
  batchSize: 1000,

  /** Cron schedule for daily retention job (3 AM UTC) */
  schedule: "0 3 * * *",
};

// =============================================================================
// SSE CONFIG
// =============================================================================

/**
 * Configuration for Server-Sent Events streaming
 */
export const sseConfig = {
  /** Timeout for SSE connections (ms) */
  timeout: 5000,
  /** Heartbeat interval to keep connections alive (ms) */
  heartbeatInterval: 30000,
};
