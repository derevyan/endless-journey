/**
 * Journey CRUD Integration Tests
 *
 * Tests for the /api/journeys endpoints using real HTTP requests.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:journeys
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  TEST_JOURNEY_IDS,
  TEST_USER_IDS,
  authRequest,
  checkServerHealth,
  request,
  testJourneyConfig,
  type JourneyResponse,
  type JourneysListResponse,
} from "./helpers/test-app";

describe("Journeys API", () => {
  // Track created journeys for cleanup
  const createdJourneyIds: string[] = [];

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(`API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`);
    }
  });

  afterAll(async () => {
    // Cleanup: delete any journeys created during tests
    for (const journeyId of createdJourneyIds) {
      try {
        await authRequest("DELETE", `/api/journeys/${journeyId}`, TEST_USER_IDS.DEMO);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("GET /api/journeys", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/journeys");
      expect(response.status).toBe(401);
    });

    it("should return journeys for authenticated user", async () => {
      const response = await authRequest("GET", "/api/journeys", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as JourneysListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("journeys");
      expect(Array.isArray(data.journeys)).toBe(true);
    });

    it("should return Demo User's journeys", async () => {
      const response = await authRequest("GET", "/api/journeys", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as JourneysListResponse;

      expect(data.journeys.length).toBeGreaterThanOrEqual(1);
      expect(data.journeys[0]).toHaveProperty("id");
      expect(data.journeys[0]).toHaveProperty("name");
    });

    it("should return Arina's journeys", async () => {
      const response = await authRequest("GET", "/api/journeys", TEST_USER_IDS.ARINA);
      const data = (await response.json()) as JourneysListResponse;

      expect(data.journeys.length).toBeGreaterThanOrEqual(0);
      if (data.journeys.length > 0) {
        expect(data.journeys[0]).toHaveProperty("id");
        expect(data.journeys[0]).toHaveProperty("name");
      }
    });

    it("should include journey metadata", async () => {
      const response = await authRequest("GET", "/api/journeys", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as JourneysListResponse;

      const journey = data.journeys[0];
      expect(journey).toHaveProperty("id");
      expect(journey).toHaveProperty("name");
      expect(journey).toHaveProperty("description");
    });
  });

  describe("GET /api/journeys/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`);
      expect(response.status).toBe(401);
    });

    it("should return a specific journey by ID", async () => {
      const response = await authRequest("GET", `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`, TEST_USER_IDS.DEMO);
      const data = (await response.json()) as JourneyResponse;

      expect(response.status).toBe(200);
      expect(data.journey).toBeDefined();
      expect(data.journey.id).toBe(TEST_JOURNEY_IDS.SAAS_ONBOARDING);
    });

    it("should return 404 for journey user doesn't own", async () => {
      // Arina trying to access Demo's journey
      const response = await authRequest("GET", `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`, TEST_USER_IDS.ARINA);

      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent journey", async () => {
      const response = await authRequest("GET", "/api/journeys/00000000-0000-0000-0000-000000000999", TEST_USER_IDS.DEMO);

      expect(response.status).toBe(404);
    });

    it("should include full configuration in response", async () => {
      const response = await authRequest("GET", `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`, TEST_USER_IDS.DEMO);
      const data = (await response.json()) as JourneyResponse;

      expect(data.journey.configuration).toBeDefined();
      expect(data.journey.configuration).toHaveProperty("nodes");
      expect(data.journey.configuration).toHaveProperty("edges");
    });
  });

  describe("POST /api/journeys", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", "/api/journeys", {
        body: {
          name: "Test Journey",
          configuration: testJourneyConfig,
        },
      });

      expect(response.status).toBe(401);
    });

    it("should create a new journey", async () => {
      const response = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          name: "Test Journey",
          description: "Created during tests",
          configuration: testJourneyConfig,
        },
      });
      const data = (await response.json()) as JourneyResponse;

      expect(response.status).toBe(201);
      expect(data.journey).toBeDefined();
      expect(data.journey.name).toBe("Test Journey");
      expect(data.journey.id).toBeDefined();

      // Track for cleanup
      createdJourneyIds.push(data.journey.id);
    });

    it("should return 400 if name is missing", async () => {
      const response = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          configuration: testJourneyConfig,
        },
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 if configuration is missing", async () => {
      const response = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          name: "Test Journey",
        },
      });

      expect(response.status).toBe(400);
    });

    it("should assign journey to the creating user", async () => {
      const response = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          name: "User Assignment Test",
          configuration: testJourneyConfig,
        },
      });
      const createData = (await response.json()) as JourneyResponse;
      createdJourneyIds.push(createData.journey.id);

      // Demo user should be able to access it
      const getResponse = await authRequest("GET", `/api/journeys/${createData.journey.id}`, TEST_USER_IDS.DEMO);
      expect(getResponse.status).toBe(200);

      // Arina should NOT be able to access it
      const arinaResponse = await authRequest("GET", `/api/journeys/${createData.journey.id}`, TEST_USER_IDS.ARINA);
      expect(arinaResponse.status).toBe(404);
    });
  });

  describe("PUT /api/journeys/:id", () => {
    let testJourneyId: string;

    beforeAll(async () => {
      // Create a journey to update
      const response = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          name: "Journey to Update",
          configuration: testJourneyConfig,
        },
      });
      const data = (await response.json()) as JourneyResponse;
      testJourneyId = data.journey.id;
      createdJourneyIds.push(testJourneyId);
    });

    it("should return 401 without authentication", async () => {
      const response = await request("PUT", `/api/journeys/${testJourneyId}`, {
        body: { name: "Updated Name" },
      });

      expect(response.status).toBe(401);
    });

    it("should update journey name", async () => {
      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { name: "Updated Journey Name" },
      });
      const data = (await response.json()) as JourneyResponse;

      expect(response.status).toBe(200);
      expect(data.journey.name).toBe("Updated Journey Name");
    });

    it("should update journey description", async () => {
      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { description: "New description" },
      });
      const data = (await response.json()) as JourneyResponse;

      expect(response.status).toBe(200);
      expect(data.journey.description).toBe("New description");
    });

    it("should return 404 when updating another user's journey", async () => {
      // Arina trying to update Demo's journey
      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.ARINA, {
        body: { name: "Hacked!" },
      });

      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent journey", async () => {
      const response = await authRequest("PUT", "/api/journeys/00000000-0000-0000-0000-000000000999", TEST_USER_IDS.DEMO, { body: { name: "Test" } });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/journeys/:id/active-sessions-count", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/active-sessions-count`);
      expect(response.status).toBe(401);
    });

    it("should return count for authenticated user", async () => {
      const response = await authRequest("GET", `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/active-sessions-count`, TEST_USER_IDS.DEMO);
      const data = (await response.json()) as { count: number };

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("count");
      expect(typeof data.count).toBe("number");
    });

    it("should return 404 for journey user doesn't own", async () => {
      const response = await authRequest("GET", `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/active-sessions-count`, TEST_USER_IDS.ARINA);

      expect(response.status).toBe(404);
    });
  });

  describe("Journey Deactivation (PUT /api/journeys/:id with status change)", () => {
    let testJourneyId: string;

    beforeAll(async () => {
      // Create an active journey for deactivation tests
      const response = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          name: "Deactivation Test Journey",
          configuration: testJourneyConfig,
        },
      });
      const data = (await response.json()) as JourneyResponse;
      testJourneyId = data.journey.id;
      createdJourneyIds.push(testJourneyId);

      // Set to active status
      await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "active" },
      });
    });

    it("should accept deactivationMode when changing from active", async () => {
      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "draft", deactivationMode: "pause" },
      });

      expect(response.status).toBe(200);
    });

    it("should default to pause mode when no deactivationMode provided", async () => {
      // First set back to active
      await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "active" },
      });

      // Then deactivate without specifying mode
      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "draft" },
      });

      expect(response.status).toBe(200);
    });

    it("should accept terminate deactivation mode", async () => {
      // First set to active
      await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "active" },
      });

      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "draft", deactivationMode: "terminate" },
      });

      expect(response.status).toBe(200);
    });

    it("should accept complete deactivation mode", async () => {
      // First set to active
      await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "active" },
      });

      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "draft", deactivationMode: "complete" },
      });

      expect(response.status).toBe(200);
    });

    it("should return 400 for invalid deactivation mode", async () => {
      // First set to active
      await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "active" },
      });

      const response = await authRequest("PUT", `/api/journeys/${testJourneyId}`, TEST_USER_IDS.DEMO, {
        body: { status: "draft", deactivationMode: "invalid_mode" },
      });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/journeys/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", "/api/journeys/some-id");

      expect(response.status).toBe(401);
    });

    it("should delete a journey", async () => {
      // Create a journey to delete
      const createResponse = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          name: "Journey to Delete",
          configuration: testJourneyConfig,
        },
      });
      const createData = (await createResponse.json()) as JourneyResponse;
      const journeyId = createData.journey.id;

      // Delete it
      const deleteResponse = await authRequest("DELETE", `/api/journeys/${journeyId}`, TEST_USER_IDS.DEMO);

      expect(deleteResponse.status).toBe(200);

      // Verify it's gone
      const getResponse = await authRequest("GET", `/api/journeys/${journeyId}`, TEST_USER_IDS.DEMO);
      expect(getResponse.status).toBe(404);
    });

    it("should return 404 when deleting another user's journey", async () => {
      // Create a journey as Demo
      const createResponse = await authRequest("POST", "/api/journeys", TEST_USER_IDS.DEMO, {
        body: {
          name: "Demo's Journey",
          configuration: testJourneyConfig,
        },
      });
      const createData = (await createResponse.json()) as JourneyResponse;
      createdJourneyIds.push(createData.journey.id);

      // Arina trying to delete Demo's journey
      const deleteResponse = await authRequest("DELETE", `/api/journeys/${createData.journey.id}`, TEST_USER_IDS.ARINA);

      expect(deleteResponse.status).toBe(404);

      // Journey should still exist for Demo
      const getResponse = await authRequest("GET", `/api/journeys/${createData.journey.id}`, TEST_USER_IDS.DEMO);
      expect(getResponse.status).toBe(200);
    });

    it("should return 404 for non-existent journey", async () => {
      const response = await authRequest("DELETE", "/api/journeys/00000000-0000-0000-0000-000000000999", TEST_USER_IDS.DEMO);

      expect(response.status).toBe(404);
    });
  });
});
