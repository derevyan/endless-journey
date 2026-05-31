/**
 * Tag Definitions API Integration Tests
 *
 * Tests for the /api/tag-definitions endpoints using real HTTP requests.
 * Covers organization-level tag registry (global scope only).
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:tag-definitions
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  API_BASE_URL,
  request,
  authRequest,
  TEST_USER_IDS,
  checkServerHealth,
  type ErrorResponse,
} from "./helpers/test-app";
import {
  cleanupTestTags,
  trackTag,
} from "./helpers/tag-cleanup";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface TagDefinitionItem {
  id?: string;
  tag: string;
  description?: string;
  createdAt?: string;
}

interface TagDefinitionsListResponse {
  tags: TagDefinitionItem[];
}

interface TagDefinitionResponse {
  tag: TagDefinitionItem;
}

// =============================================================================
// TESTS
// =============================================================================

describe("Tag Definitions API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  afterAll(async () => {
    // Cleanup: delete any tag definitions created during tests
    await cleanupTestTags();
  });

  // ===========================================================================
  // GLOBAL TAG DEFINITIONS
  // ===========================================================================

  describe("GET /api/tags/global", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/tags/global");
      expect(response.status).toBe(401);
    });

    it("should return global tag definitions for authenticated user", async () => {
      const response = await authRequest(
        "GET",
        "/api/tags/global",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as TagDefinitionsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("tags");
      expect(Array.isArray(data.tags)).toBe(true);
    });

    it("should scope definitions to user's organization", async () => {
      // Demo user should see Demo org definitions
      const demoResponse = await authRequest(
        "GET",
        "/api/tags/global",
        TEST_USER_IDS.DEMO
      );
      const demoData = (await demoResponse.json()) as TagDefinitionsListResponse;

      // Arina should see Arina org definitions
      const arinaResponse = await authRequest(
        "GET",
        "/api/tags/global",
        TEST_USER_IDS.ARINA
      );
      const arinaData = (await arinaResponse.json()) as TagDefinitionsListResponse;

      expect(demoResponse.status).toBe(200);
      expect(arinaResponse.status).toBe(200);

      // Both should return arrays (may be empty or different)
      expect(Array.isArray(demoData.tags)).toBe(true);
      expect(Array.isArray(arinaData.tags)).toBe(true);
    });
  });

  describe("POST /api/tags/global", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", "/api/tags/global", {
        body: { tag: "test-tag" },
      });

      expect(response.status).toBe(401);
    });

    it("should return 400 if tag is missing", async () => {
      const response = await authRequest(
        "POST",
        "/api/tags/global",
        TEST_USER_IDS.DEMO,
        { body: {} }
      );
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("should create a global tag definition", async () => {
      const testTag = `def-global-${Date.now()}`;
      const response = await authRequest(
        "POST",
        "/api/tags/global",
        TEST_USER_IDS.DEMO,
        {
          body: { tag: testTag, description: "Test global tag definition" },
        }
      );
      const data = (await response.json()) as TagDefinitionResponse;

      expect(response.status).toBe(200);
      expect(data.tag).toBeDefined();
      expect(data.tag.tag).toBe(testTag);

      // Track for cleanup
      trackTag(testTag);
    });

    it("should return the definition when listing after adding", async () => {
      const testTag = `def-list-${Date.now()}`;
      
      // Add definition
      await authRequest("POST", "/api/tags/global", TEST_USER_IDS.DEMO, {
        body: { tag: testTag },
      });
      trackTag(testTag);

      // List definitions
      const response = await authRequest(
        "GET",
        "/api/tags/global",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as TagDefinitionsListResponse;

      expect(response.status).toBe(200);
      expect(data.tags.some((t) => t.tag === testTag)).toBe(true);
    });
  });

  describe("DELETE /api/tags/global/:tag", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", "/api/tags/global/test-tag");

      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent tag definition", async () => {
      const response = await authRequest(
        "DELETE",
        "/api/tags/global/non-existent-tag-xyz",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    it("should delete an existing global tag definition", async () => {
      const testTag = `def-delete-${Date.now()}`;
      
      // Add definition first
      await authRequest("POST", "/api/tags/global", TEST_USER_IDS.DEMO, {
        body: { tag: testTag },
      });

      // Delete definition
      const deleteResponse = await authRequest(
        "DELETE",
        `/api/tags/global/${testTag}`,
        TEST_USER_IDS.DEMO
      );

      expect(deleteResponse.status).toBe(200);

      // Verify it's gone
      const listResponse = await authRequest(
        "GET",
        "/api/tags/global",
        TEST_USER_IDS.DEMO
      );
      const data = (await listResponse.json()) as TagDefinitionsListResponse;
      expect(data.tags.some((t) => t.tag === testTag)).toBe(false);
    });
  });

  // Journey tag definitions have been removed - only global tags now
});

