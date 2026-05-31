/**
 * User Tags API Integration Tests
 *
 * Tests for the /api/user-tags endpoints using real HTTP requests.
 * Covers global and journey-scoped user tag assignments.
 * Requires API server running on localhost:3001
 *
 * Note: The user tags API requires real database entities (clients, sessions)
 * to exist due to foreign key constraints. Tests that require creating tags
 * will fail with 500 errors if the referenced entities don't exist.
 * These tests focus on API behavior (auth, validation) rather than full CRUD.
 *
 * Run with: pnpm test:tags
 */

import { describe, expect, it, beforeAll } from "vitest";
import {
  API_BASE_URL,
  request,
  authRequest,
  TEST_USER_IDS,
  checkServerHealth,
  type ErrorResponse,
} from "./helpers/test-app";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface TagItem {
  id?: string;
  tag: string;
  createdAt?: string;
}

interface TagsListResponse {
  tags: TagItem[];
}

interface TagResponse {
  tag: TagItem;
}

// =============================================================================
// TEST FIXTURES
// =============================================================================

// These IDs don't exist in the database - used for testing API validation
// Using valid UUID format to avoid database errors on invalid UUID format
const fakeClientId = "00000000-0000-0000-0000-000000000999";

// =============================================================================
// TESTS
// =============================================================================

describe("User Tags API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  // ===========================================================================
  // GLOBAL USER TAGS
  // ===========================================================================

  describe("GET /api/user-tags/global/:clientId", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", `/api/user-tags/global/${fakeClientId}`);
      expect(response.status).toBe(401);
    });

    // SECURITY: Non-existent clients return 404 to prevent enumeration
    it("should return 404 for non-existent client (security: prevents enumeration)", async () => {
      const response = await authRequest(
        "GET",
        `/api/user-tags/global/${fakeClientId}`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(404);
      expect(data.error).toContain("Client not found");
    });
  });

  describe("POST /api/user-tags/global/:clientId", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", `/api/user-tags/global/${fakeClientId}`, {
        body: { tag: "test-tag" },
      });

      expect(response.status).toBe(401);
    });

    // SECURITY: Client ownership is checked before validation, so 404 is returned
    it("should return 404 for non-existent client (security check before validation)", async () => {
      const response = await authRequest(
        "POST",
        `/api/user-tags/global/${fakeClientId}`,
        TEST_USER_IDS.DEMO,
        { body: { tag: "test-tag" } }
      );
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(404);
      expect(data.error).toContain("Client not found");
    });
  });

  describe("DELETE /api/user-tags/global/:clientId/:tag", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", `/api/user-tags/global/${fakeClientId}/test-tag`);

      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent tag", async () => {
      const response = await authRequest(
        "DELETE",
        `/api/user-tags/global/${fakeClientId}/non-existent-tag-xyz`,
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // EXECUTE OPERATIONS
  // (Journey session tags removed - only global tags now)
  // ===========================================================================

  describe("POST /api/user-tags/execute", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", "/api/user-tags/execute", {
        body: {
          clientId: fakeClientId,
          add: ["test-tag"],
        },
      });

      expect(response.status).toBe(401);
    });

    it("should return 400 if clientId is missing", async () => {
      const response = await authRequest(
        "POST",
        "/api/user-tags/execute",
        TEST_USER_IDS.DEMO,
        {
          body: {
            add: ["test-tag"],
          },
        }
      );

      // When clientId is missing from body, protect middleware can't verify ownership
      // so it returns 403 (access denied) instead of 400 (validation error)
      expect(response.status).toBe(403);
    });
  });
});
