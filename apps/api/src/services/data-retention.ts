/**
 * Data Retention Service
 *
 * BullMQ-based background job that periodically deletes old data from multiple tables.
 * Supports configurable retention per table, with 0 = forever (no retention).
 * Runs daily at 3 AM UTC.
 *
 * Tables processed:
 * - events (default: 90 days)
 * - interactions (default: 90 days)
 * - sent_messages (default: 90 days)
 * - conversations (default: forever - never deleted)
 * - llm_usage_events (default: 90 days)
 * - mindstate_analysis_log (default: 60 days)
 * - failed_events (default: 30 days)
 * - crm_stage_history (default: 365 days)
 *
 * @see docs/db/retention.md for policy documentation
 * @module services/data-retention
 */

import { db } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import { ServiceUnavailableError } from "@journey/schemas";
import { Job, Queue, Worker } from "bullmq";
import { sql } from "drizzle-orm";

import { appConfig } from "../config";
import { dataRetentionQueueConfig } from "../lib/queue-config";
import { getRedisConnection } from "../lib/redis";

const log = createLogger("data-retention");

// =============================================================================
// SERVICE STATE
// =============================================================================

let queue: Queue | null = null;
let worker: Worker | null = null;
let isInitialized = false;

// =============================================================================
// TABLE CONFIGURATION
// =============================================================================

interface TableRetentionConfig {
  /** Table name in PostgreSQL */
  tableName: string;
  /** Timestamp column to use for retention cutoff */
  timestampColumn: string;
  /** Retention period in days (0 = forever) */
  retentionDays: number;
}

/**
 * Get table configurations with current retention settings
 */
function getTableConfigs(): TableRetentionConfig[] {
  return [
    {
      tableName: "events",
      timestampColumn: "created_at",
      retentionDays: appConfig.retention.events,
    },
    {
      tableName: "interactions",
      timestampColumn: "timestamp",
      retentionDays: appConfig.retention.interactions,
    },
    {
      tableName: "sent_messages",
      timestampColumn: "sent_at",
      retentionDays: appConfig.retention.sentMessages,
    },
    {
      tableName: "conversations",
      timestampColumn: "created_at",
      retentionDays: appConfig.retention.conversations,
    },
    {
      tableName: "llm_usage_events",
      timestampColumn: "created_at",
      retentionDays: appConfig.retention.llmUsageEvents,
    },
    {
      tableName: "mindstate_analysis_log",
      timestampColumn: "created_at",
      retentionDays: appConfig.retention.mindstateAnalysisLog,
    },
    {
      tableName: "failed_events",
      timestampColumn: "created_at",
      retentionDays: appConfig.retention.failedEvents,
    },
    {
      tableName: "crm_stage_history",
      timestampColumn: "changed_at",
      retentionDays: appConfig.retention.crmStageHistory,
    },
  ];
}

// =============================================================================
// RETENTION LOGIC
// =============================================================================

interface TableDeletionResult {
  tableName: string;
  deleted: number;
  skipped: boolean;
}

/**
 * Delete old records from a single table in batches
 */
async function deleteOldRecordsFromTable(config: TableRetentionConfig): Promise<TableDeletionResult> {
  // Skip tables with 0 retention (forever)
  if (config.retentionDays <= 0) {
    log.debug({ tableName: config.tableName }, "dataRetention:skipped:forever");
    return { tableName: config.tableName, deleted: 0, skipped: true };
  }

  const { tableName, timestampColumn, retentionDays } = config;
  const batchSize = dataRetentionQueueConfig.batchSize;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let totalDeleted = 0;
  let batchDeleted = 0;

  log.debug(
    {
      tableName,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    },
    "dataRetention:table:starting"
  );

  do {
    // Delete in batches using a subquery
    // Using raw SQL with sql.raw for table/column names (safe since they come from config)
    const result = await db.execute(sql`
      DELETE FROM ${sql.raw(tableName)}
      WHERE id IN (
        SELECT id FROM ${sql.raw(tableName)}
        WHERE ${sql.raw(timestampColumn)} < ${cutoffDate.toISOString()}
        LIMIT ${batchSize}
      )
    `);

    batchDeleted = (result as { rowCount?: number }).rowCount || 0;
    totalDeleted += batchDeleted;

    if (batchDeleted > 0) {
      log.debug({ tableName, batchDeleted, totalDeleted }, "dataRetention:table:batch");
    }
  } while (batchDeleted === batchSize);

  log.info(
    {
      tableName,
      totalDeleted,
      cutoffDate: cutoffDate.toISOString(),
    },
    "dataRetention:table:completed"
  );

  return { tableName, deleted: totalDeleted, skipped: false };
}

/**
 * Delete old data from all configured tables
 */
async function deleteOldData(): Promise<{ results: TableDeletionResult[]; totalDeleted: number }> {
  const configs = getTableConfigs();
  const results: TableDeletionResult[] = [];
  let totalDeleted = 0;

  log.info(
    {
      tableCount: configs.length,
      tables: configs.map((c) => ({ name: c.tableName, retentionDays: c.retentionDays })),
    },
    "dataRetention:starting"
  );

  for (const config of configs) {
    const result = await deleteOldRecordsFromTable(config);
    results.push(result);
    totalDeleted += result.deleted;
  }

  log.info(
    {
      totalDeleted,
      results: results.map((r) => ({
        table: r.tableName,
        deleted: r.deleted,
        skipped: r.skipped,
      })),
    },
    "dataRetention:completed"
  );

  return { results, totalDeleted };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the data retention service
 *
 * Sets up the BullMQ queue and worker for processing retention jobs.
 * Schedules a daily job at 3 AM UTC.
 */
export async function initDataRetentionService(): Promise<void> {
  if (isInitialized) {
    log.warn({}, "dataRetention:alreadyInitialized");
    return;
  }

  const connection = getRedisConnection();

  // Create queue
  queue = new Queue(dataRetentionQueueConfig.name, {
    connection,
    defaultJobOptions: dataRetentionQueueConfig.defaultJobOptions,
  });

  // Create worker
  worker = new Worker(
    dataRetentionQueueConfig.name,
    async (job: Job) => {
      log.info({ jobId: job.id }, "dataRetention:processing");

      try {
        const result = await deleteOldData();
        return result;
      } catch (error) {
        log.error({ jobId: job.id, err: serializeError(error) }, "dataRetention:failed");
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Only one retention job at a time
    }
  );

  // Worker event handlers
  worker.on("completed", (job, result) => {
    const typedResult = result as { totalDeleted: number; results: TableDeletionResult[] };
    log.info(
      {
        jobId: job.id,
        totalDeleted: typedResult?.totalDeleted,
        tables: typedResult?.results?.length,
      },
      "dataRetention:job:completed"
    );
  });

  worker.on("failed", (job, error) => {
    log.error({ jobId: job?.id, err: serializeError(error) }, "dataRetention:job:failed");
  });

  // Schedule daily retention job
  await scheduleRetentionJob();

  isInitialized = true;
  log.info({}, "dataRetention:initialized");
}

/**
 * Get the data retention queue instance (for Bull Board)
 */
export function getDataRetentionQueue(): Queue | null {
  return queue;
}

/**
 * Schedule the daily retention job
 */
async function scheduleRetentionJob(): Promise<void> {
  if (!queue) {
    throw new ServiceUnavailableError("Data retention queue not initialized");
  }

  // Remove any existing repeatable jobs
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Schedule new daily job
  await queue.add(
    "daily-retention",
    {},
    {
      repeat: {
        pattern: dataRetentionQueueConfig.schedule,
      },
    }
  );

  const configs = getTableConfigs();
  log.info(
    {
      schedule: dataRetentionQueueConfig.schedule,
      tables: configs.map((c) => ({ name: c.tableName, retentionDays: c.retentionDays })),
    },
    "dataRetention:scheduled"
  );
}

// =============================================================================
// SHUTDOWN
// =============================================================================

/**
 * Shutdown the data retention service
 */
export async function shutdownDataRetentionService(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  isInitialized = false;
  log.info({}, "dataRetention:shutdown");
}

// =============================================================================
// MANUAL TRIGGER
// =============================================================================

/**
 * Run retention job manually (for testing or on-demand cleanup)
 */
export async function runRetentionNow(): Promise<{ results: TableDeletionResult[]; totalDeleted: number }> {
  if (!queue) {
    throw new ServiceUnavailableError("Data retention queue not initialized");
  }

  log.info({}, "dataRetention:manualRun:starting");
  const result = await deleteOldData();
  log.info({ totalDeleted: result.totalDeleted }, "dataRetention:manualRun:completed");
  return result;
}
