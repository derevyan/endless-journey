/**
 * Vitest Global Teardown for API Tests
 *
 * Runs after all tests to clean up if tests failed
 */

import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("vitest:api:global-teardown");

let cleanupRan = false;

export default async function teardown() {
  log.info("🧹 Running API test global teardown...");

  // Set NODE_ENV for database client
  process.env.NODE_ENV = "test";

  try {
    // Check if tests failed
    const testsFailed = process.exitCode !== 0;

    if (testsFailed && !cleanupRan) {
      log.warn("Tests failed - running automatic cleanup...");

      // Dynamic import to ensure NODE_ENV is set
      const { cleanupTestPipelines, cleanupTestTags, cleanupTestVariables, cleanupTestOrganizations } = await import(
        "@journey/db/test-utils"
      );

      // Run cleanup
      const stats = {
        pipelines: await cleanupTestPipelines(),
        tags: await cleanupTestTags(),
        variables: await cleanupTestVariables(),
        orgs: await cleanupTestOrganizations(),
      };

      const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
      log.info({ ...stats, total }, "Cleanup completed");

      cleanupRan = true;
    } else if (!testsFailed) {
      log.info("✅ Tests passed - skipping automatic cleanup");
      log.info("💡 Run 'pnpm db:test:cleanup' to manually clean test data");
    }

    log.info("✅ API test global teardown complete");
  } catch (error) {
    log.error({ err: serializeError(error) }, "Global teardown failed");
    // Don't throw - teardown failures shouldn't fail the test run
  } finally {
    // Always close database connections to prevent hanging
    try {
      const { closeDatabaseConnection } = await import("@journey/db");
      await closeDatabaseConnection();
      log.info("Database connection closed");
    } catch (err) {
      log.error({ err: serializeError(err) }, "Failed to close database connection");
    }
  }
}
