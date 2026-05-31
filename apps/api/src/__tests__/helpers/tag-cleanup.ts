/**
 * Tag Cleanup Helper
 *
 * Provides utilities to clean up tags created during integration tests.
 * Call cleanupTestTags() in afterAll() to ensure test tags are removed.
 *
 * Note: Tags are now global only (organization-wide).
 *
 * @module __tests__/helpers/tag-cleanup
 */

import { createLogger, serializeError } from "@journey/logger";
import { authRequest, TEST_USER_IDS } from "./test-app";

const log = createLogger("tag-cleanup");

// =============================================================================
// TAG TRACKER
// =============================================================================

interface TagTracker {
  tags: string[];
}

const tagTracker: TagTracker = {
  tags: [],
};

// =============================================================================
// TRACKING FUNCTIONS
// =============================================================================

/**
 * Track a tag for cleanup
 * @param tag Tag name to track
 */
export function trackTag(tag: string): void {
  if (!tagTracker.tags.includes(tag)) {
    tagTracker.tags.push(tag);
  }
}

/**
 * Get all tracked tags (useful for debugging)
 */
export function getTrackedTags(): TagTracker {
  return {
    tags: [...tagTracker.tags],
  };
}

/**
 * Clear all tracked tags (usually not needed, but available for manual control)
 */
export function clearTrackedTags(): void {
  tagTracker.tags = [];
}

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

/**
 * Clean up all tracked tags
 * Attempts to delete each tracked tag and ignores failures
 */
export async function cleanupTags(): Promise<void> {
  const results = {
    deleted: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const tag of tagTracker.tags) {
    try {
      const response = await authRequest("DELETE", `/api/tags/global/${encodeURIComponent(tag)}`, TEST_USER_IDS.DEMO);

      if (response.ok) {
        results.deleted++;
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${tag}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Clear the tracker after cleanup
  tagTracker.tags = [];

  // Log summary if there were any issues
  if (results.failed > 0) {
    log.warn({ deleted: results.deleted, failed: results.failed, errors: results.errors }, "tagCleanup:tags:partialFailure");
  }
}

/**
 * Clean up ALL tracked tags
 * This is the main cleanup function to call in afterAll()
 *
 * @example
 * ```typescript
 * import { cleanupTestTags, trackTag } from "./helpers/tag-cleanup";
 *
 * describe("My Test Suite", () => {
 *   afterAll(async () => {
 *     await cleanupTestTags();
 *   });
 *
 *   test("should create a tag", async () => {
 *     const tag = `test-${Date.now()}`;
 *     await createTag(tag);
 *     trackTag(tag); // Track for cleanup
 *   });
 * });
 * ```
 */
export async function cleanupTestTags(): Promise<void> {
  await cleanupTags();
}

// =============================================================================
// BULK CLEANUP (for cleaning up tags by pattern)
// =============================================================================

/**
 * Clean up tags matching a pattern (prefix)
 * Useful for cleaning up leftover test tags from previous runs
 *
 * @param prefix Tag prefix to match (e.g., "test-", "def-")
 * @param userId User ID to authenticate as (defaults to DEMO user)
 *
 * @example
 * ```typescript
 * // Clean up all tags starting with "test-"
 * await cleanupTagsByPrefix("test-");
 * ```
 */
export async function cleanupTagsByPrefix(prefix: string, userId: string = TEST_USER_IDS.DEMO): Promise<void> {
  try {
    // Get all global tags
    const globalResponse = await authRequest("GET", "/api/tags/global", userId);
    if (globalResponse.ok) {
      const data = (await globalResponse.json()) as { tags: Array<{ tag: string }> };
      const tagsToDelete = data.tags.filter((t) => t.tag.startsWith(prefix));

      for (const { tag } of tagsToDelete) {
        try {
          await authRequest("DELETE", `/api/tags/global/${encodeURIComponent(tag)}`, userId);
        } catch {
          // Ignore individual failures
        }
      }
    }
  } catch (error) {
    log.warn({ prefix, err: serializeError(error as Error) }, "tagCleanup:byPrefix:failed");
  }
}
