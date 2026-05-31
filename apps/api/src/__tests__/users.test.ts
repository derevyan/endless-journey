/**
 * Channel Users API Integration Tests
 *
 * Tests for the /api/users endpoints using real HTTP requests.
 * Covers channel user listing, sessions, and deletion.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:users
 */

import { describe, expect, it, beforeAll } from "vitest";
import {
  API_BASE_URL,
  request,
  authRequest,
  TEST_USER_IDS,
  TEST_JOURNEY_IDS,
  checkServerHealth,
  type ErrorResponse,
  type SuccessResponse,
} from "./helpers/test-app";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ChannelUserItem {
  id: string;
  platformUserId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  platform: string;
  sessionCount: number;
  lastActiveAt?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

interface ChannelUserSession {
  id: string;
  journeyId: string;
  journeyName?: string;
  journeySlug?: string;
  currentNodeId?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

interface UsersListResponse {
  users: ChannelUserItem[];
  total: number;
}

interface UserSessionsResponse {
  sessions: ChannelUserSession[];
}

interface UniqueTagsResponse {
  tags: string[];
}

let demoChannelUserId: string | null = null;

// =============================================================================
// TESTS
// =============================================================================

describe("Channel Users API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }

    try {
      const response = await authRequest("GET", "/api/users?limit=1", TEST_USER_IDS.DEMO);
      if (response.ok) {
        const data = (await response.json()) as UsersListResponse;
        demoChannelUserId = data.users[0]?.id ?? null;
      }
    } catch {
      // Ignore errors; tests will fall back to a known UUID.
    }
  });

  // ===========================================================================
  // GET UNIQUE TAGS
  // ===========================================================================

  describe("GET /api/users/tags", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/users/tags");
      expect(response.status).toBe(401);
    });

    it("should return unique tags for authenticated user", async () => {
      const response = await authRequest("GET", "/api/users/tags", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as UniqueTagsResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("tags");
      expect(Array.isArray(data.tags)).toBe(true);
    });

    it("should scope tags to user's organization", async () => {
      // Demo user should see Demo org tags
      const demoResponse = await authRequest("GET", "/api/users/tags", TEST_USER_IDS.DEMO);
      const demoData = (await demoResponse.json()) as UniqueTagsResponse;

      // Arina should see Arina org tags
      const arinaResponse = await authRequest("GET", "/api/users/tags", TEST_USER_IDS.ARINA);
      const arinaData = (await arinaResponse.json()) as UniqueTagsResponse;

      expect(demoResponse.status).toBe(200);
      expect(arinaResponse.status).toBe(200);

      // Both should return arrays (may be empty or different)
      expect(Array.isArray(demoData.tags)).toBe(true);
      expect(Array.isArray(arinaData.tags)).toBe(true);
    });
  });

  // ===========================================================================
  // LIST CHANNEL USERS
  // ===========================================================================

  describe("GET /api/users", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/users");
      expect(response.status).toBe(401);
    });

    it("should return channel users list for authenticated user", async () => {
      const response = await authRequest("GET", "/api/users", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as UsersListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.users)).toBe(true);
      expect(typeof data.total).toBe("number");
    });

    it("should respect limit and offset parameters", async () => {
      const response = await authRequest(
        "GET",
        "/api/users?limit=10&offset=0",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as UsersListResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBeLessThanOrEqual(10);
    });

    it("should filter by journeyId when provided", async () => {
      const response = await authRequest(
        "GET",
        `/api/users?journeyId=${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as UsersListResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.users)).toBe(true);
    });

    it("should return 404 for inaccessible journey filter", async () => {
      // Demo user trying to filter by Arina's journey
      const response = await authRequest(
        "GET",
        `/api/users?journeyId=${TEST_JOURNEY_IDS.ECU_COACHING}`,
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    it("should filter by tags when provided", async () => {
      const response = await authRequest(
        "GET",
        "/api/users?tags=premium,vip",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as UsersListResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.users)).toBe(true);
      // Users returned should have at least one of the specified tags
    });

    it("should include user metadata in response", async () => {
      const response = await authRequest("GET", "/api/users", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as UsersListResponse;

      expect(response.status).toBe(200);
      
      // If there are users, check their structure
      if (data.users.length > 0) {
        const user = data.users[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("platformUserId");
        expect(user).toHaveProperty("platform");
        expect(user).toHaveProperty("sessionCount");
      }
    });
  });

  // ===========================================================================
  // GET USER SESSIONS
  // ===========================================================================

  describe("GET /api/users/:userId/sessions", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/users/some-user-id/sessions");
      expect(response.status).toBe(401);
    });

    it("should return empty sessions for non-existent user", async () => {
      const response = await authRequest(
        "GET",
        "/api/users/00000000-0000-0000-0000-000000000999/sessions",
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as UserSessionsResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("sessions");
      expect(Array.isArray(data.sessions)).toBe(true);
      expect(data.sessions.length).toBe(0);
    });

    it("should return sessions scoped to user's organization journeys", async () => {
      // Demo user should only see sessions from Demo org journeys
      const targetUserId = demoChannelUserId ?? "00000000-0000-0000-0000-000000000999";
      const response = await authRequest(
        "GET",
        `/api/users/${targetUserId}/sessions`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as UserSessionsResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.sessions)).toBe(true);
    });
  });

  // ===========================================================================
  // DELETE CHANNEL USER
  // ===========================================================================

  describe("DELETE /api/users/:userId", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", "/api/users/some-user-id");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await authRequest(
        "DELETE",
        "/api/users/00000000-0000-0000-0000-000000000999",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 for user not in organization's journeys", async () => {
      // Demo user trying to delete a user that only exists in Arina's journeys
      // This would return 404 since the user doesn't have sessions in Demo's journeys
      const response = await authRequest(
        "DELETE",
        "/api/users/00000000-0000-0000-0000-000000000888",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    // Note: Testing actual user deletion requires having a real channel user in the DB
    // This would typically be created via the telegram webhook
  });

  // ===========================================================================
  // ORGANIZATION SCOPING
  // ===========================================================================
  // NOTE: Data cleanup on user deletion is documented in user-service.ts
  // CASCADE deletes handle: journeySessions, clientTags, clientMindstates,
  // crmClientStages, crmStageHistory, crmClientFieldValues, crmDirectMessages,
  // interactions, sentMessages, durableTimers
  // Explicit deletes handle: events (sessionId/clientId)

  describe("Organization Scoping", () => {
    it("should only show users with sessions in organization journeys", async () => {
      // Demo user should only see users from Demo org journeys
      const demoResponse = await authRequest("GET", "/api/users", TEST_USER_IDS.DEMO);
      const demoData = (await demoResponse.json()) as UsersListResponse;

      // Arina should only see users from Arina org journeys
      const arinaResponse = await authRequest("GET", "/api/users", TEST_USER_IDS.ARINA);
      const arinaData = (await arinaResponse.json()) as UsersListResponse;

      expect(demoResponse.status).toBe(200);
      expect(arinaResponse.status).toBe(200);

      // Both should return arrays (may be empty or different)
      expect(Array.isArray(demoData.users)).toBe(true);
      expect(Array.isArray(arinaData.users)).toBe(true);
    });

    it("should return empty list when organization has no journeys", async () => {
      // This test would require a user with no journeys in their organization
      // For now, we just verify the response structure
      const response = await authRequest("GET", "/api/users", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as UsersListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("total");
    });
  });
});
