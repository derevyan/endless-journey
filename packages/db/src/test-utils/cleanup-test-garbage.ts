/**
 * Cleanup Test Garbage Script
 *
 * Removes orphaned test data created by E2E tests that follow timestamp patterns:
 * - Pipelines: test-pipeline-${timestamp}
 * - Tags: test-tag-${timestamp}
 * - Variables: test-var-${timestamp}
 * - Organizations: test-org-${timestamp}
 *
 * Run with: NODE_ENV=test pnpm db:test:cleanup
 *
 * This is safe to run manually or automatically after test failures.
 */

import { createLogger, serializeError } from "@journey/logger";
import "dotenv/config";

const log = createLogger("db:test:cleanup");

// Force test environment
if (process.env.NODE_ENV !== "test") {
  log.error("This script can only run in test environment.");
  log.error("Set NODE_ENV=test before running.");
  process.exit(1);
}

// Import cleanup functions from shared helpers (DRY principle)
import {
  cleanupTestPipelines,
  cleanupTestTags,
  cleanupTestVariables,
  cleanupTestOrganizations,
} from "./cleanup-helpers";

// Import database client for shutdown
import { closeDatabaseConnection } from "../client";

interface CleanupStats {
  pipelines: number;
  tags: number;
  variables: number;
  organizations: number;
}

/**
 * Main cleanup function
 */
async function main() {
  log.info("🧹 Starting test database cleanup...");
  log.info({ database: "TEST" }, "Cleaning up test garbage data");

  const stats: CleanupStats = {
    pipelines: 0,
    tags: 0,
    variables: 0,
    organizations: 0,
  };

  try {
    // Run all cleanup operations using shared helpers
    log.info("Cleaning up test pipelines...");
    stats.pipelines = await cleanupTestPipelines();

    log.info("Cleaning up test tags...");
    stats.tags = await cleanupTestTags();

    log.info("Cleaning up test variables...");
    stats.variables = await cleanupTestVariables();

    log.info("Cleaning up test organizations...");
    stats.organizations = await cleanupTestOrganizations();

    // Summary
    const totalRemoved = Object.values(stats).reduce((sum, count) => sum + count, 0);

    log.info({ ...stats } as Record<string, unknown>, "✅ Cleanup completed");
    log.info({ totalRemoved }, `Removed ${totalRemoved} test records`);

    if (totalRemoved === 0) {
      log.info("No test garbage data found. Database is clean! 🎉");
    }
  } catch (error) {
    log.error({ err: serializeError(error) }, "cleanup:error");
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

main();
