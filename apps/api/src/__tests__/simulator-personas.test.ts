/**
 * Simulator Personas API Tests
 *
 * Integration tests for persona CRUD operations.
 * Tests the /api/simulator/personas endpoints.
 *
 * @module api/tests/simulator-personas
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { authRequest, checkServerHealth, TEST_USER_IDS } from "./helpers/test-app";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Persona {
  id: string;
  name: string;
  profile: {
    firstName?: string;
    lastName?: string;
  };
}

interface PersonaResponse {
  persona: Persona;
}

interface PersonasListResponse {
  personas: Persona[];
}

interface DeleteResponse {
  success: boolean;
}

// =============================================================================
// TESTS
// =============================================================================

describe("Simulator Personas API", () => {
  const createdPersonaIds: string[] = [];

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error("API server is not running. Start it with: pnpm dev");
    }
  });

  afterAll(async () => {
    // Cleanup: delete all created personas
    for (const personaId of createdPersonaIds) {
      await authRequest("DELETE", `/api/simulator/personas/${personaId}`, TEST_USER_IDS.DEMO);
    }
  });

  // =============================================================================
  // CREATE PERSONA
  // =============================================================================

  describe("POST /api/simulator/personas", () => {
    it("should create a persona with auto-filled firstName", async () => {
      const response = await authRequest("POST", "/api/simulator/personas", TEST_USER_IDS.DEMO, {
        body: { name: "Sales Lead" },
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as PersonaResponse;
      expect(data.persona).toBeDefined();
      expect(data.persona.name).toBe("Sales Lead");
      // Auto-fill: profile.firstName should default to persona name
      expect(data.persona.profile.firstName).toBe("Sales Lead");

      createdPersonaIds.push(data.persona.id);
    });

    it("should allow explicit profile to override auto-fill", async () => {
      const response = await authRequest("POST", "/api/simulator/personas", TEST_USER_IDS.DEMO, {
        body: {
          name: "VIP Customer",
          profile: { firstName: "John", lastName: "Doe" },
        },
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as PersonaResponse;
      expect(data.persona.name).toBe("VIP Customer");
      // Explicit profile overrides auto-fill
      expect(data.persona.profile.firstName).toBe("John");
      expect(data.persona.profile.lastName).toBe("Doe");

      createdPersonaIds.push(data.persona.id);
    });

    it("should reject duplicate persona names within organization", async () => {
      // Create first persona
      const response1 = await authRequest("POST", "/api/simulator/personas", TEST_USER_IDS.DEMO, {
        body: { name: "Duplicate Test" },
      });
      expect(response1.status).toBe(201);
      const data1 = (await response1.json()) as PersonaResponse;
      createdPersonaIds.push(data1.persona.id);

      // Try to create duplicate
      const response2 = await authRequest("POST", "/api/simulator/personas", TEST_USER_IDS.DEMO, {
        body: { name: "Duplicate Test" },
      });
      expect(response2.status).toBe(409);
    });
  });

  // =============================================================================
  // LIST PERSONAS
  // =============================================================================

  describe("GET /api/simulator/personas", () => {
    it("should list personas for the organization", async () => {
      const response = await authRequest("GET", "/api/simulator/personas", TEST_USER_IDS.DEMO);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PersonasListResponse;
      expect(Array.isArray(data.personas)).toBe(true);
    });
  });

  // =============================================================================
  // GET PERSONA
  // =============================================================================

  describe("GET /api/simulator/personas/:id", () => {
    it("should return persona by ID", async () => {
      // First create a persona
      const createResponse = await authRequest("POST", "/api/simulator/personas", TEST_USER_IDS.DEMO, {
        body: { name: "Get Test Persona" },
      });
      const createData = (await createResponse.json()) as PersonaResponse;
      createdPersonaIds.push(createData.persona.id);

      // Then get it
      const response = await authRequest("GET", `/api/simulator/personas/${createData.persona.id}`, TEST_USER_IDS.DEMO);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PersonaResponse;
      expect(data.persona.id).toBe(createData.persona.id);
      expect(data.persona.name).toBe("Get Test Persona");
    });

    it("should return 404 for non-existent persona", async () => {
      const response = await authRequest(
        "GET",
        "/api/simulator/personas/00000000-0000-0000-0000-000000000000",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });
  });

  // =============================================================================
  // DELETE PERSONA
  // =============================================================================

  describe("DELETE /api/simulator/personas/:id", () => {
    it("should delete persona and return success", async () => {
      // Create a persona to delete
      const createResponse = await authRequest("POST", "/api/simulator/personas", TEST_USER_IDS.DEMO, {
        body: { name: "Delete Test Persona" },
      });
      const createData = (await createResponse.json()) as PersonaResponse;

      // Delete it
      const deleteResponse = await authRequest("DELETE", `/api/simulator/personas/${createData.persona.id}`, TEST_USER_IDS.DEMO);

      expect(deleteResponse.status).toBe(200);
      const data = (await deleteResponse.json()) as DeleteResponse;
      expect(data.success).toBe(true);

      // Verify it's gone
      const getResponse = await authRequest("GET", `/api/simulator/personas/${createData.persona.id}`, TEST_USER_IDS.DEMO);
      expect(getResponse.status).toBe(404);
    });
  });

  // Cleanup endpoint tests removed: destructive operation and overlaps with other integration coverage.
});
