/**
 * Variables API Integration Tests
 *
 * Tests for the /api/variables endpoints using real HTTP requests.
 * Covers global and journey-scoped variables CRUD operations.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:variables
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
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

interface VariableItem {
  key: string;
  value: unknown;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VariablesListResponse {
  variables: VariableItem[];
}

interface VariableResponse {
  variable: VariableItem;
}

// =============================================================================
// TESTS
// =============================================================================

describe("Variables API", () => {
  // Track created variables for cleanup
  const createdGlobalKeys: string[] = [];
  const createdJourneyKeys: { journeyId: string; key: string }[] = [];

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  afterAll(async () => {
    // Cleanup: delete any variables created during tests
    for (const key of createdGlobalKeys) {
      try {
        await authRequest("DELETE", `/api/variables/global/${key}`, TEST_USER_IDS.DEMO);
      } catch {
        // Ignore cleanup errors
      }
    }
    for (const { journeyId, key } of createdJourneyKeys) {
      try {
        await authRequest("DELETE", `/api/variables/journey/${journeyId}/${key}`, TEST_USER_IDS.DEMO);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ===========================================================================
  // GLOBAL VARIABLES
  // ===========================================================================

  describe("GET /api/variables/global", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/variables/global");
      expect(response.status).toBe(401);
    });

    it("should return global variables list for authenticated user", async () => {
      const response = await authRequest("GET", "/api/variables/global", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as VariablesListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("variables");
      expect(Array.isArray(data.variables)).toBe(true);
    });
  });

  describe("GET /api/variables/global/:key", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/variables/global/test-key");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent variable", async () => {
      const response = await authRequest(
        "GET",
        "/api/variables/global/non-existent-key-xyz",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/variables/global/:key", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("PUT", "/api/variables/global/test-key", {
        body: { value: "test" },
      });

      expect(response.status).toBe(401);
    });

    it("should return 400 if value is missing", async () => {
      const response = await authRequest(
        "PUT",
        "/api/variables/global/test-key",
        TEST_USER_IDS.DEMO,
        { body: {} }
      );
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("should create a new global variable", async () => {
      const testKey = `test-var-${Date.now()}`;
      const response = await authRequest(
        "PUT",
        `/api/variables/global/${testKey}`,
        TEST_USER_IDS.DEMO,
        {
          body: { value: "test-value", description: "Test variable" },
        }
      );
      const data = (await response.json()) as VariableResponse;

      expect(response.status).toBe(200);
      expect(data.variable).toBeDefined();
      expect(data.variable.key).toBe(testKey);
      expect(data.variable.value).toBe("test-value");

      // Track for cleanup
      createdGlobalKeys.push(testKey);
    });

    it("should update an existing global variable", async () => {
      const testKey = `test-var-update-${Date.now()}`;
      
      // Create first
      await authRequest("PUT", `/api/variables/global/${testKey}`, TEST_USER_IDS.DEMO, {
        body: { value: "initial" },
      });
      createdGlobalKeys.push(testKey);

      // Update
      const response = await authRequest(
        "PUT",
        `/api/variables/global/${testKey}`,
        TEST_USER_IDS.DEMO,
        {
          body: { value: "updated" },
        }
      );
      const data = (await response.json()) as VariableResponse;

      expect(response.status).toBe(200);
      expect(data.variable.value).toBe("updated");
    });
  });

  describe("DELETE /api/variables/global/:key", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", "/api/variables/global/test-key");

      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent variable", async () => {
      const response = await authRequest(
        "DELETE",
        "/api/variables/global/non-existent-key-xyz",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });

    it("should delete an existing global variable", async () => {
      const testKey = `test-var-delete-${Date.now()}`;
      
      // Create first
      await authRequest("PUT", `/api/variables/global/${testKey}`, TEST_USER_IDS.DEMO, {
        body: { value: "to-delete" },
      });

      // Delete
      const deleteResponse = await authRequest(
        "DELETE",
        `/api/variables/global/${testKey}`,
        TEST_USER_IDS.DEMO
      );

      expect(deleteResponse.status).toBe(200);

      // Verify it's gone
      const getResponse = await authRequest(
        "GET",
        `/api/variables/global/${testKey}`,
        TEST_USER_IDS.DEMO
      );
      expect(getResponse.status).toBe(404);
    });
  });

  // ===========================================================================
  // JOURNEY VARIABLES
  // ===========================================================================

  describe("GET /api/variables/journey/:journeyId", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(
        "GET",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`
      );
      expect(response.status).toBe(401);
    });

    it("should return journey variables list for authenticated user", async () => {
      const response = await authRequest(
        "GET",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as VariablesListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("variables");
      expect(Array.isArray(data.variables)).toBe(true);
    });

    it("should return 404 for journey user doesn't own", async () => {
      // Arina trying to access Demo's journey variables
      const response = await authRequest(
        "GET",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}`,
        TEST_USER_IDS.ARINA
      );

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/variables/journey/:journeyId/:key", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(
        "GET",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/test-key`
      );
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent variable", async () => {
      const response = await authRequest(
        "GET",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/non-existent-key-xyz`,
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/variables/journey/:journeyId/:key", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(
        "PUT",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/test-key`,
        { body: { value: "test" } }
      );

      expect(response.status).toBe(401);
    });

    it("should return 400 if value is missing", async () => {
      const response = await authRequest(
        "PUT",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/test-key`,
        TEST_USER_IDS.DEMO,
        { body: {} }
      );
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("should return 404 for journey user doesn't own", async () => {
      // Arina trying to set variable on Demo's journey
      const response = await authRequest(
        "PUT",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/test-key`,
        TEST_USER_IDS.ARINA,
        { body: { value: "hacked" } }
      );

      expect(response.status).toBe(404);
    });

    it("should create a new journey variable", async () => {
      const testKey = `test-jvar-${Date.now()}`;
      const response = await authRequest(
        "PUT",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/${testKey}`,
        TEST_USER_IDS.DEMO,
        {
          body: { value: { nested: "object" }, description: "Test journey variable" },
        }
      );
      const data = (await response.json()) as VariableResponse;

      expect(response.status).toBe(200);
      expect(data.variable).toBeDefined();
      expect(data.variable.key).toBe(testKey);
      expect(data.variable.value).toEqual({ nested: "object" });

      // Track for cleanup
      createdJourneyKeys.push({ journeyId: TEST_JOURNEY_IDS.SAAS_ONBOARDING, key: testKey });
    });
  });

  describe("DELETE /api/variables/journey/:journeyId/:key", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(
        "DELETE",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/test-key`
      );

      expect(response.status).toBe(401);
    });

    it("should return 404 for journey user doesn't own", async () => {
      // Arina trying to delete variable on Demo's journey
      const response = await authRequest(
        "DELETE",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/test-key`,
        TEST_USER_IDS.ARINA
      );

      expect(response.status).toBe(404);
    });

    it("should delete an existing journey variable", async () => {
      const testKey = `test-jvar-delete-${Date.now()}`;
      
      // Create first
      await authRequest(
        "PUT",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/${testKey}`,
        TEST_USER_IDS.DEMO,
        { body: { value: "to-delete" } }
      );

      // Delete
      const deleteResponse = await authRequest(
        "DELETE",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/${testKey}`,
        TEST_USER_IDS.DEMO
      );

      expect(deleteResponse.status).toBe(200);

      // Verify it's gone
      const getResponse = await authRequest(
        "GET",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/${testKey}`,
        TEST_USER_IDS.DEMO
      );
      expect(getResponse.status).toBe(404);
    });
  });

  // ===========================================================================
  // EXECUTE OPERATIONS
  // ===========================================================================

  describe("POST /api/variables/execute", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", "/api/variables/execute", {
        body: {
          scope: "global",
          operations: [{ type: "set", key: "test", value: "test" }],
        },
      });

      expect(response.status).toBe(401);
    });

    it("should return 400 for invalid request body", async () => {
      const response = await authRequest(
        "POST",
        "/api/variables/execute",
        TEST_USER_IDS.DEMO,
        { body: { invalid: "body" } }
      );

      expect(response.status).toBe(400);
    });

    it("should execute global variable operations", async () => {
      const testKey = `test-exec-global-${Date.now()}`;
      
      const response = await authRequest(
        "POST",
        "/api/variables/execute",
        TEST_USER_IDS.DEMO,
        {
          body: {
            scope: "global",
            operations: [{ op: "set", key: testKey, value: "executed" }],
          },
        }
      );

      expect(response.status).toBe(200);

      // Verify the variable was created
      const getResponse = await authRequest(
        "GET",
        `/api/variables/global/${testKey}`,
        TEST_USER_IDS.DEMO
      );
      const data = (await getResponse.json()) as VariableResponse;
      expect(data.variable.value).toBe("executed");

      // Track for cleanup
      createdGlobalKeys.push(testKey);
    });

    it("should execute journey variable operations", async () => {
      const testKey = `test-exec-journey-${Date.now()}`;
      
      const response = await authRequest(
        "POST",
        "/api/variables/execute",
        TEST_USER_IDS.DEMO,
        {
          body: {
            scope: "journey",
            journeyId: TEST_JOURNEY_IDS.SAAS_ONBOARDING,
            operations: [{ op: "set", key: testKey, value: 42 }],
          },
        }
      );

      expect(response.status).toBe(200);

      // Verify the variable was created
      const getResponse = await authRequest(
        "GET",
        `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/${testKey}`,
        TEST_USER_IDS.DEMO
      );
      const data = (await getResponse.json()) as VariableResponse;
      expect(data.variable.value).toBe(42);

      // Track for cleanup
      createdJourneyKeys.push({ journeyId: TEST_JOURNEY_IDS.SAAS_ONBOARDING, key: testKey });
    });

    it("should return 400 for journey scope without journeyId", async () => {
      const response = await authRequest(
        "POST",
        "/api/variables/execute",
        TEST_USER_IDS.DEMO,
        {
          body: {
            scope: "journey",
            operations: [{ op: "set", key: "test", value: "test" }],
          },
        }
      );

      expect(response.status).toBe(400);
    });

    it("should return 404 for journey scope with inaccessible journey", async () => {
      // Arina trying to execute on Demo's journey
      const response = await authRequest(
        "POST",
        "/api/variables/execute",
        TEST_USER_IDS.ARINA,
        {
          body: {
            scope: "journey",
            journeyId: TEST_JOURNEY_IDS.SAAS_ONBOARDING,
            operations: [{ op: "set", key: "test", value: "hacked" }],
          },
        }
      );

      expect(response.status).toBe(404);
    });
  });
});

