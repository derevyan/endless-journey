/**
 * Playwright Global Teardown
 *
 * Runs after all tests to clean up:
 * 1. Run cleanup if tests failed (detected via process.exitCode)
 * 2. Log cleanup summary
 */

import { createLogger } from "@journey/logger";
import { FullConfig } from "@playwright/test";

const log = createLogger("playwright:global-teardown");

// Track if we've already run cleanup
let cleanupRan = false;

export default async function globalTeardown(config: FullConfig) {
  log.info("🧹 Running Playwright global teardown...");

  // Set NODE_ENV for database client
  process.env.NODE_ENV = "test";

  try {
    // Check if tests failed
    const testsFailed = process.exitCode !== 0;

    if (testsFailed && !cleanupRan) {
      log.warn("Tests failed - running automatic cleanup...");

      // Dynamic import to avoid loading DB before NODE_ENV is set
      // @ts-ignore - Playwright handles TypeScript imports at runtime
      const { cleanupTestPipelines, cleanupTestTags, cleanupTestVariables, cleanupTestOrganizations } = await import(
        "../../../packages/db/src/test-utils/index.ts"
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

    log.info("✅ Global teardown complete");
  } catch (error) {
    log.error({ error }, "Global teardown failed");
    // Don't throw - teardown failures shouldn't fail the test run
  }
}
