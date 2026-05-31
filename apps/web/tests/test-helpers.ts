/**
 * E2E Test Cleanup Utilities
 *
 * Helper functions for cleaning up test data in E2E tests
 */

import { test as base } from "@playwright/test";

/**
 * Extended test with automatic cleanup after all tests
 * Import and use this instead of the default test from @playwright/test
 */
export const test = base.extend({
  // Add any custom fixtures here if needed
});

/**
 * Register cleanup for test suites that create test data
 * Call this in your test file to enable automatic cleanup
 *
 * Example:
 * ```typescript
 * import { test, registerCleanup } from "./test-helpers";
 *
 * registerCleanup(test, {
 *   pipelines: true,
 *   tags: true,
 *   variables: true,
 * });
 * ```
 */
export function registerCleanup(
  testInstance: typeof test,
  options: {
    pipelines?: boolean;
    tags?: boolean;
    variables?: boolean;
    organizations?: boolean;
  } = {}
) {
  testInstance.afterAll(async () => {
    // Dynamic import to ensure NODE_ENV is set
    // @ts-ignore - Playwright handles TypeScript imports at runtime
    const { cleanupTestPipelines, cleanupTestTags, cleanupTestVariables, cleanupTestOrganizations } = await import(
      "../../../packages/db/src/test-utils/index.ts"
    );

    const cleanupPromises: Promise<number>[] = [];

    if (options.pipelines) {
      cleanupPromises.push(cleanupTestPipelines());
    }

    if (options.tags) {
      cleanupPromises.push(cleanupTestTags());
    }

    if (options.variables) {
      cleanupPromises.push(cleanupTestVariables());
    }

    if (options.organizations) {
      cleanupPromises.push(cleanupTestOrganizations());
    }

    await Promise.all(cleanupPromises);
  });
}

// Re-export expect for convenience
export { expect } from "@playwright/test";
