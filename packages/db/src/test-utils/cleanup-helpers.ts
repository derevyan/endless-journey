/**
 * Test Cleanup Helper Utilities
 *
 * Provides reusable cleanup functions for E2E tests.
 * Use these in afterAll hooks to clean up test data.
 *
 * Example:
 * ```typescript
 * import { cleanupTestPipelines, cleanupTestTags } from '@journey/db/test-utils';
 *
 * afterAll(async () => {
 *   await cleanupTestPipelines();
 *   await cleanupTestTags();
 * });
 * ```
 */

import { createLogger, serializeError } from "@journey/logger";
import { and, like, lte } from "drizzle-orm";
import { db } from "../client";
import { crmPipelines, organization, tagDefinitions, variables } from "../schema";

const log = createLogger("db:test:cleanup-helpers");

/**
 * Cleanup test pipelines matching a pattern
 * @param pattern SQL LIKE pattern (default: 'test-pipeline-%')
 */
export async function cleanupTestPipelines(pattern: string = "test-pipeline-%"): Promise<number> {
  try {
    const result = await db.delete(crmPipelines).where(like(crmPipelines.name, pattern)).returning({ id: crmPipelines.id });

    const count = result.length;
    if (count > 0) {
      log.debug({ count, pattern }, "Cleaned up test pipelines");
    }
    return count;
  } catch (error) {
    log.error({ err: serializeError(error), pattern }, "cleanupTestPipelines:error");
    return 0;
  }
}

/**
 * Cleanup test tags matching a pattern
 * @param pattern SQL LIKE pattern (default: 'test-tag-%')
 */
export async function cleanupTestTags(pattern: string = "test-tag-%"): Promise<number> {
  try {
    const result = await db.delete(tagDefinitions).where(like(tagDefinitions.name, pattern)).returning({ id: tagDefinitions.id });

    const count = result.length;
    if (count > 0) {
      log.debug({ count, pattern }, "Cleaned up test tags");
    }
    return count;
  } catch (error) {
    log.error({ err: serializeError(error), pattern }, "cleanupTestTags:error");
    return 0;
  }
}

/**
 * Cleanup test variables matching a pattern
 * @param pattern SQL LIKE pattern (default: 'test-var-%')
 */
export async function cleanupTestVariables(pattern: string = "test-var-%"): Promise<number> {
  try {
    const result = await db.delete(variables).where(like(variables.key, pattern)).returning({ key: variables.key });

    const count = result.length;
    if (count > 0) {
      log.debug({ count, pattern }, "Cleaned up test variables");
    }
    return count;
  } catch (error) {
    log.error({ err: serializeError(error), pattern }, "cleanupTestVariables:error");
    return 0;
  }
}

/**
 * Cleanup test organizations matching a pattern
 * @param pattern SQL LIKE pattern (default: 'test-org-%')
 */
export async function cleanupTestOrganizations(pattern: string = "test-org-%"): Promise<number> {
  try {
    const result = await db.delete(organization).where(like(organization.name, pattern)).returning({ id: organization.id });

    const count = result.length;
    if (count > 0) {
      log.debug({ count, pattern }, "Cleaned up test organizations");
    }
    return count;
  } catch (error) {
    log.error({ err: serializeError(error), pattern }, "cleanupTestOrganizations:error");
    return 0;
  }
}

/**
 * Cleanup all test data older than specified hours
 * @param hoursOld Minimum age in hours (default: 24)
 */
export async function cleanupOldTestData(hoursOld: number = 24): Promise<{
  pipelines: number;
  tags: number;
  variables: number;
  orgs: number;
}> {
  const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

  log.info({ cutoffDate, hoursOld }, "Cleaning up test data older than specified hours");

  const stats = {
    pipelines: 0,
    tags: 0,
    variables: 0,
    orgs: 0,
  };

  try {
    // Cleanup pipelines
    const pipelines = await db
      .delete(crmPipelines)
      .where(and(like(crmPipelines.name, "test-pipeline-%"), lte(crmPipelines.createdAt, cutoffDate)))
      .returning({ id: crmPipelines.id });
    stats.pipelines = pipelines.length;

    // Cleanup tags
    const tags = await db
      .delete(tagDefinitions)
      .where(and(like(tagDefinitions.name, "test-tag-%"), lte(tagDefinitions.createdAt, cutoffDate)))
      .returning({ id: tagDefinitions.id });
    stats.tags = tags.length;

    // Cleanup variables
    const scopedVars = await db
      .delete(variables)
      .where(and(like(variables.key, "test-var-%"), lte(variables.createdAt, cutoffDate)))
      .returning({ key: variables.key });
    stats.variables = scopedVars.length;

    // Cleanup organizations
    const orgs = await db
      .delete(organization)
      .where(and(like(organization.name, "test-org-%"), lte(organization.createdAt, cutoffDate)))
      .returning({ id: organization.id });
    stats.orgs = orgs.length;

    const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
    log.info({ ...stats, total }, "Cleanup completed");

    return stats;
  } catch (error) {
    log.error({ err: serializeError(error) }, "cleanupOldTestData:error");
    return stats;
  }
}

/**
 * Register process exit handler to cleanup test data on crash
 * Call this in test setup files
 */
export function registerCleanupOnExit(): void {
  const cleanup = async () => {
    log.warn("Process exiting - running cleanup...");
    await cleanupTestPipelines();
    await cleanupTestTags();
    await cleanupTestVariables();
    await cleanupTestOrganizations();
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
  process.once("exit", cleanup);
}
