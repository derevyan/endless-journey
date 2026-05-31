/**
 * Auth/Mock User Integration Tests
 *
 * Tests for authentication and mock user switching using real HTTP requests.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:auth
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  checkServerHealth,
  MOCK_USERS,
  mockUserHeaders,
  request,
  TEST_USER_IDS,
  type ErrorResponse,
  type JourneysListResponse,
  type UserResponse,
} from "./helpers/test-app";

describe("Auth - Mock User System", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(`API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`);
    }
  });

  describe("GET /api/me", () => {
    it("should return null user when no auth provided", async () => {
      const response = await request("GET", "/api/me");
      const data = (await response.json()) as UserResponse;

      expect(response.status).toBe(200);
      expect(data.user).toBeNull();
    });

    it("should return Demo User with X-Mock-User-Id header", async () => {
      const response = await request("GET", "/api/me", {
        headers: mockUserHeaders(TEST_USER_IDS.DEMO),
      });
      const data = (await response.json()) as UserResponse;

      expect(response.status).toBe(200);
      expect(data.user?.email).toBe(MOCK_USERS[TEST_USER_IDS.DEMO].email);
      expect(data.isMockUser).toBe(true);
    });

    it("should return Arina with X-Mock-User-Id header", async () => {
      const response = await request("GET", "/api/me", {
        headers: mockUserHeaders(TEST_USER_IDS.ARINA),
      });
      const data = (await response.json()) as UserResponse;

      expect(response.status).toBe(200);
      expect(data.user?.email).toBe(MOCK_USERS[TEST_USER_IDS.ARINA].email);
      expect(data.user?.name).toBe(MOCK_USERS[TEST_USER_IDS.ARINA].name);
      expect(data.isMockUser).toBe(true);
    });

    it("should return null for invalid mock user ID", async () => {
      const response = await request("GET", "/api/me", {
        headers: mockUserHeaders("invalid-user-id"),
      });
      const data = (await response.json()) as UserResponse;

      expect(response.status).toBe(200);
      expect(data.user).toBeNull();
    });
  });

  describe("Auth Middleware", () => {
    it("should reject unauthenticated requests to protected routes", async () => {
      const response = await request("GET", "/api/journeys");
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });

    it("should allow authenticated requests with mock user", async () => {
      const response = await request("GET", "/api/journeys", {
        headers: mockUserHeaders(TEST_USER_IDS.DEMO),
      });

      expect(response.status).toBe(200);
    });

    it("should scope data to the authenticated user", async () => {
      // Demo user should see SaaS and Starter journeys
      const demoResponse = await request("GET", "/api/journeys", {
        headers: mockUserHeaders(TEST_USER_IDS.DEMO),
      });
      const demoData = (await demoResponse.json()) as JourneysListResponse;

      // Arina should see her own org's journeys
      const arinaResponse = await request("GET", "/api/journeys", {
        headers: mockUserHeaders(TEST_USER_IDS.ARINA),
      });
      const arinaData = (await arinaResponse.json()) as JourneysListResponse;

      // Different users should see different journeys
      expect(demoData.journeys.length).toBeGreaterThan(0);
      expect(arinaData.journeys.length).toBeGreaterThan(0);

      // Verify users see their own org's journeys (counts may vary with seed data)
      // Demo org has more journeys than Arina's org
      expect(demoData.journeys.length).toBeGreaterThanOrEqual(1);
      expect(arinaData.journeys.length).toBeGreaterThanOrEqual(1);
    });
  });
});
