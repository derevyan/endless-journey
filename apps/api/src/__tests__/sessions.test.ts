/**
 * Sessions API Integration Tests
 *
 * Tests for the /api/sessions and /api/journeys/:id/sessions endpoints.
 * Covers session listing, detail view, and deletion.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:sessions
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

interface SessionItem {
  id: string;
  journeyId: string;
  clientId: string;
  currentNodeId?: string;
  status: "active" | "completed" | "dropped" | "paused";
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

interface SessionWithInteractions extends SessionItem {
  interactions: Array<{
    id: string;
    nodeId: string;
    type: string;
    data?: unknown;
    createdAt?: string;
  }>;
}

interface SessionsListResponse {
  sessions: SessionItem[];
}

interface SessionDetailResponse {
  session: SessionWithInteractions;
}

interface ResetSessionsResponse {
  success: boolean;
  deletedCount: number;
  clearedEngines: number;
  message: string;
}

// =============================================================================
// TESTS
// =============================================================================

describe("Sessions API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  // ===========================================================================
  // LIST SESSIONS BY JOURNEY
  // ===========================================================================

  describe("GET /api/journeys/:journeyId/sessions", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions`
      );
      expect(response.status).toBe(401);
    });

    it("should return sessions list for authenticated user", async () => {
      const response = await authRequest(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as SessionsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("sessions");
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    it("should return 404 for journey user doesn't own", async () => {
      // Arina trying to access Demo's journey sessions
      const response = await authRequest(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions`,
        TEST_USER_IDS.ARINA
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent journey", async () => {
      const response = await authRequest(
        "GET",
        "/api/journeys/00000000-0000-0000-0000-000000000999/sessions",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    it("should respect limit and offset parameters", async () => {
      const response = await authRequest(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions?limit=10&offset=0`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as SessionsListResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.sessions)).toBe(true);
      expect(data.sessions.length).toBeLessThanOrEqual(10);
    });

    it("should filter by status when provided", async () => {
      const response = await authRequest(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions?status=active`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as SessionsListResponse;

      expect(response.status).toBe(200);
      // All returned sessions should have active status
      for (const session of data.sessions) {
        expect(session.status).toBe("active");
      }
    });
  });

  // ===========================================================================
  // SESSION DETAIL
  // ===========================================================================

  describe("GET /api/sessions/:sessionId", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/sessions/some-session-id");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent session", async () => {
      const response = await authRequest(
        "GET",
        "/api/sessions/00000000-0000-0000-0000-000000000999",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    // Note: Testing actual session detail requires having a real session in the DB
    // This would typically be created via the telegram webhook or simulator
  });

  // ===========================================================================
  // DELETE SESSION
  // ===========================================================================

  describe("DELETE /api/sessions/:sessionId", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", "/api/sessions/some-session-id");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent session", async () => {
      const response = await authRequest(
        "DELETE",
        "/api/sessions/00000000-0000-0000-0000-000000000999",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    // Note: Testing actual session deletion requires having a real session in the DB
  });

  // ===========================================================================
  // RESET SESSIONS (DEV ONLY)
  // ===========================================================================

  describe("DELETE /api/journeys/:journeyId/sessions", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(
        "DELETE",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions`
      );
      expect(response.status).toBe(401);
    });

    it("should return 404 for journey user doesn't own", async () => {
      // Arina trying to reset Demo's journey sessions
      const response = await authRequest(
        "DELETE",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions`,
        TEST_USER_IDS.ARINA
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent journey", async () => {
      const response = await authRequest(
        "DELETE",
        "/api/journeys/00000000-0000-0000-0000-000000000999/sessions",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    // Note: In production mode, this endpoint returns 403
    // We test the dev mode behavior here
    it("should reset sessions in development mode", async () => {
      const response = await authRequest(
        "DELETE",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions`,
        TEST_USER_IDS.DEMO
      );

      // In dev mode: 200 with success response
      // In prod mode: 403 Not available in production
      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = (await response.json()) as ResetSessionsResponse;
        expect(data.success).toBe(true);
        expect(typeof data.deletedCount).toBe("number");
        expect(typeof data.clearedEngines).toBe("number");
      }
    });
  });

  // ===========================================================================
  // ORGANIZATION SCOPING
  // ===========================================================================

  describe("Organization Scoping", () => {
    it("should only show sessions for journeys in user's organization", async () => {
      // Demo user should only see Demo org journey sessions
      const demoResponse = await authRequest(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/sessions`,
        TEST_USER_IDS.DEMO
      );
      expect(demoResponse.status).toBe(200);

      // Arina should see her own journey sessions
      const arinaResponse = await authRequest(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.ECU_COACHING}/sessions`,
        TEST_USER_IDS.ARINA
      );
      expect(arinaResponse.status).toBe(200);

      // Cross-org access should be denied
      const crossOrgResponse = await authRequest(
        "GET",
        `/api/journeys/${TEST_JOURNEY_IDS.ECU_COACHING}/sessions`,
        TEST_USER_IDS.DEMO
      );
      expect(crossOrgResponse.status).toBe(404);
    });
  });
});

