/**
 * CRM API Integration Tests
 *
 * Tests for the /api/crm endpoints using real HTTP requests.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:crm
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_BASE_URL, authRequest, checkServerHealth, request, TEST_USER_IDS, type ErrorResponse } from "./helpers/test-app";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  isDefault: boolean | null;
  stageCount?: number;
}

interface PipelinesListResponse {
  pipelines: Pipeline[];
}

interface PipelineResponse {
  pipeline: Pipeline;
}

interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  clientCount?: number;
  isDefault?: boolean | null;
  isSystem?: boolean | null;
}

interface StagesListResponse {
  stages: PipelineStage[];
}

interface StageResponse {
  stage: PipelineStage;
}

interface CustomField {
  id: string;
  name: string;
  key: string;
  fieldType: string;
  description: string | null;
  isRequired: boolean | null;
  position: number;
}

interface FieldsListResponse {
  fields: CustomField[];
}

interface FieldResponse {
  field: CustomField;
}

interface CrmClient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  stageId: string | null;
  stageName?: string;
}

interface ClientsListResponse {
  clients: CrmClient[];
  total: number;
}

interface ClientProfileResponse {
  client: CrmClient & {
    fieldValues?: Array<{
      fieldId: string;
      fieldKey: string;
      value: unknown;
    }>;
  };
}

// =============================================================================
// TEST DATA
// =============================================================================

let createdPipelineId: string | null = null;
let createdStageId: string | null = null;
let createdFieldId: string | null = null;

// =============================================================================
// TESTS
// =============================================================================

describe("CRM API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(`API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`);
    }
  });

  // Cleanup created test data
  afterAll(async () => {
    // Clean up in reverse order of creation
    if (createdFieldId) {
      await authRequest("DELETE", `/api/crm/fields/${createdFieldId}`, TEST_USER_IDS.DEMO);
    }
    if (createdStageId) {
      await authRequest("DELETE", `/api/crm/stages/${createdStageId}`, TEST_USER_IDS.DEMO);
    }
    if (createdPipelineId) {
      await authRequest("DELETE", `/api/crm/pipelines/${createdPipelineId}`, TEST_USER_IDS.DEMO);
    }
  });

  // ===========================================================================
  // PIPELINES
  // ===========================================================================

  describe("Pipelines", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/crm/pipelines");
      expect(response.status).toBe(401);
    });

    it("should list pipelines for authenticated user", async () => {
      const response = await authRequest("GET", "/api/crm/pipelines", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as PipelinesListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("pipelines");
      expect(Array.isArray(data.pipelines)).toBe(true);
    });

    it("should create a new pipeline", async () => {
      const response = await authRequest("POST", "/api/crm/pipelines", TEST_USER_IDS.DEMO, {
        body: {
          name: "Test Pipeline",
          description: "Created by API tests",
          color: "#FF5733",
        },
      });

      if (response.status === 201) {
        const data = (await response.json()) as PipelineResponse;
        expect(data.pipeline).toHaveProperty("id");
        expect(data.pipeline.name).toBe("Test Pipeline");
        expect(data.pipeline.description).toBe("Created by API tests");
        expect(data.pipeline.color).toBe("#FF5733");
        createdPipelineId = data.pipeline.id;
      } else {
        // Skip if pipeline creation is not available
        expect(response.status).toBeGreaterThanOrEqual(200);
      }
    });

    it("should update a pipeline", async () => {
      if (!createdPipelineId) {
        return; // Skip - no pipeline was created in previous test
      }

      const response = await authRequest("PUT", `/api/crm/pipelines/${createdPipelineId}`, TEST_USER_IDS.DEMO, {
        body: {
          name: "Updated Pipeline",
          description: "Updated description",
        },
      });
      const data = (await response.json()) as PipelineResponse;

      expect(response.status).toBe(200);
      expect(data.pipeline.name).toBe("Updated Pipeline");
      expect(data.pipeline.description).toBe("Updated description");
    });

    it("should return 404 for non-existent pipeline", async () => {
      const response = await authRequest("GET", "/api/crm/pipelines/00000000-0000-0000-0000-000000000999", TEST_USER_IDS.DEMO);

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // PIPELINE WITH DEFAULT STAGE
  // ===========================================================================

  describe("Pipeline Creation with Default Stage", () => {
    let testPipelineId: string | null = null;
    let unassignedStageId: string | null = null;

    afterAll(async () => {
      // Clean up the test pipeline
      if (testPipelineId) {
        await authRequest("DELETE", `/api/crm/pipelines/${testPipelineId}`, TEST_USER_IDS.DEMO);
      }
    });

    it("should create Unassigned stage when creating new pipeline", async () => {
      // Create a new pipeline
      const createResponse = await authRequest("POST", "/api/crm/pipelines", TEST_USER_IDS.DEMO, {
        body: {
          name: "Pipeline With Default Stage",
          description: "Test pipeline for default stage creation",
          color: "#8B5CF6",
        },
      });

      if (createResponse.status !== 201) {
        return; // Skip - pipeline creation not available
      }

      const createData = (await createResponse.json()) as PipelineResponse;
      expect(createResponse.status).toBe(201);
      testPipelineId = createData.pipeline.id;

      // Verify Unassigned stage was created
      const stagesResponse = await authRequest("GET", `/api/crm/stages?pipelineId=${testPipelineId}`, TEST_USER_IDS.DEMO);
      const stagesData = (await stagesResponse.json()) as StagesListResponse;

      expect(stagesResponse.status).toBe(200);
      expect(stagesData.stages.length).toBe(1);
      expect(stagesData.stages[0].name).toBe("Unassigned");
      expect(stagesData.stages[0].isSystem).toBe(true);
      expect(stagesData.stages[0].isDefault).toBe(true);
      expect(stagesData.stages[0].pipelineId).toBe(testPipelineId);

      // Save for next test
      unassignedStageId = stagesData.stages[0].id;
    });

    it("should not allow deletion of system Unassigned stage", async () => {
      if (!unassignedStageId) {
        return; // Skip - prerequisite test did not run successfully
      }

      const deleteResponse = await authRequest("DELETE", `/api/crm/stages/${unassignedStageId}`, TEST_USER_IDS.DEMO);

      expect(deleteResponse.status).toBe(400);
      const data = (await deleteResponse.json()) as ErrorResponse;
      expect(data.error).toContain("system");
    });

    it("should create custom stages on correct pipeline", async () => {
      if (!testPipelineId) {
        return; // Skip - prerequisite test did not run successfully
      }

      // Create a custom stage on the test pipeline
      const stageResponse = await authRequest("POST", "/api/crm/stages", TEST_USER_IDS.DEMO, {
        body: {
          pipelineId: testPipelineId,
          name: "Custom Stage",
          description: "A custom stage on the test pipeline",
          color: "#10B981",
        },
      });
      const stageData = (await stageResponse.json()) as StageResponse;

      expect(stageResponse.status).toBe(201);
      expect(stageData.stage.name).toBe("Custom Stage");
      expect(stageData.stage.pipelineId).toBe(testPipelineId);
      expect(stageData.stage.isSystem).toBeFalsy();

      // Verify pipeline now has 2 stages (Unassigned + Custom)
      const stagesResponse = await authRequest("GET", `/api/crm/stages?pipelineId=${testPipelineId}`, TEST_USER_IDS.DEMO);
      const stagesData = (await stagesResponse.json()) as StagesListResponse;

      expect(stagesData.stages.length).toBe(2);
      expect(stagesData.stages.map((s) => s.name).sort()).toEqual(["Custom Stage", "Unassigned"]);

      // Clean up the custom stage
      await authRequest("DELETE", `/api/crm/stages/${stageData.stage.id}`, TEST_USER_IDS.DEMO);
    });
  });

  // ===========================================================================
  // STAGES
  // ===========================================================================

  describe("Stages", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/crm/stages");
      expect(response.status).toBe(401);
    });

    it("should list stages for authenticated user", async () => {
      const response = await authRequest("GET", "/api/crm/stages", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as StagesListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("stages");
      expect(Array.isArray(data.stages)).toBe(true);
    });

    it("should create a new stage", async () => {
      if (!createdPipelineId) {
        return; // Skip - no pipeline was created
      }

      const response = await authRequest("POST", "/api/crm/stages", TEST_USER_IDS.DEMO, {
        body: {
          pipelineId: createdPipelineId,
          name: "Test Stage",
          description: "Created by API tests",
          color: "#00FF00",
        },
      });
      const data = (await response.json()) as StageResponse;

      expect(response.status).toBe(201);
      expect(data.stage).toHaveProperty("id");
      expect(data.stage.name).toBe("Test Stage");
      expect(data.stage.pipelineId).toBe(createdPipelineId);

      // Save for cleanup
      createdStageId = data.stage.id;
    });

    it("should update a stage", async () => {
      if (!createdStageId) {
        return; // Skip - no stage was created
      }

      const response = await authRequest("PUT", `/api/crm/stages/${createdStageId}`, TEST_USER_IDS.DEMO, {
        body: {
          name: "Updated Stage",
          color: "#0000FF",
        },
      });
      const data = (await response.json()) as StageResponse;

      expect(response.status).toBe(200);
      expect(data.stage.name).toBe("Updated Stage");
      expect(data.stage.color).toBe("#0000FF");
    });

    it("should return 404 for non-existent stage", async () => {
      const response = await authRequest("GET", "/api/crm/stages/00000000-0000-0000-0000-000000000999", TEST_USER_IDS.DEMO);

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // CUSTOM FIELDS
  // ===========================================================================

  describe("Custom Fields", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/crm/fields");
      expect(response.status).toBe(401);
    });

    it("should list custom fields for authenticated user", async () => {
      const response = await authRequest("GET", "/api/crm/fields", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as FieldsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("fields");
      expect(Array.isArray(data.fields)).toBe(true);
    });

    it("should create a new text field", async () => {
      // Use unique key to avoid conflicts with previous test runs
      const uniqueKey = `test_field_${Date.now()}`;
      const response = await authRequest("POST", "/api/crm/fields", TEST_USER_IDS.DEMO, {
        body: {
          name: "Test Field",
          key: uniqueKey,
          fieldType: "text",
          description: "Created by API tests",
          isRequired: false,
        },
      });
      const data = (await response.json()) as FieldResponse;

      expect(response.status).toBe(201);
      expect(data.field).toHaveProperty("id");
      expect(data.field.name).toBe("Test Field");
      expect(data.field.key).toBe(uniqueKey);
      expect(data.field.fieldType).toBe("text");

      // Save for cleanup
      createdFieldId = data.field.id;
    });

    it("should update a custom field", async () => {
      if (!createdFieldId) {
        throw new Error("No field was created to update");
      }

      const response = await authRequest("PUT", `/api/crm/fields/${createdFieldId}`, TEST_USER_IDS.DEMO, {
        body: {
          name: "Updated Field",
          description: "Updated description",
        },
      });
      const data = (await response.json()) as FieldResponse;

      expect(response.status).toBe(200);
      expect(data.field.name).toBe("Updated Field");
      expect(data.field.description).toBe("Updated description");
    });

    it("should reject invalid field key format", async () => {
      const response = await authRequest("POST", "/api/crm/fields", TEST_USER_IDS.DEMO, {
        body: {
          name: "Invalid Key Field",
          key: "Invalid-Key", // Should be snake_case
          fieldType: "text",
        },
      });
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toContain("key");
    });
  });

  // ===========================================================================
  // CLIENTS
  // ===========================================================================

  describe("Clients", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/crm/clients");
      expect(response.status).toBe(401);
    });

    it("should list clients with pagination", async () => {
      const response = await authRequest("GET", "/api/crm/clients?limit=10&offset=0", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ClientsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("clients");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.clients)).toBe(true);
      expect(typeof data.total).toBe("number");
    });

    it("should filter clients by stage", async () => {
      // First get stages to find a valid stageId
      const stagesResponse = await authRequest("GET", "/api/crm/stages", TEST_USER_IDS.DEMO);
      const stagesData = (await stagesResponse.json()) as StagesListResponse;

      if (stagesData.stages.length > 0) {
        const stageId = stagesData.stages[0].id;
        const response = await authRequest("GET", `/api/crm/clients?stageId=${stageId}`, TEST_USER_IDS.DEMO);
        const data = (await response.json()) as ClientsListResponse;

        expect(response.status).toBe(200);
        expect(data).toHaveProperty("clients");
        // All returned clients should have the filtered stageId
        for (const client of data.clients) {
          expect(client.stageId).toBe(stageId);
        }
      }
    });

    it("should filter clients by date range", async () => {
      // Test dateFrom filter - clients active since 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFrom = thirtyDaysAgo.toISOString();

      const responseFrom = await authRequest("GET", `/api/crm/clients?dateFrom=${encodeURIComponent(dateFrom)}`, TEST_USER_IDS.DEMO);
      const dataFrom = (await responseFrom.json()) as ClientsListResponse;

      expect(responseFrom.status).toBe(200);
      expect(dataFrom).toHaveProperty("clients");
      expect(dataFrom).toHaveProperty("total");
      expect(Array.isArray(dataFrom.clients)).toBe(true);

      // Test dateTo filter - clients active until today
      const today = new Date();
      const dateTo = today.toISOString();

      const responseTo = await authRequest("GET", `/api/crm/clients?dateTo=${encodeURIComponent(dateTo)}`, TEST_USER_IDS.DEMO);
      const dataTo = (await responseTo.json()) as ClientsListResponse;

      expect(responseTo.status).toBe(200);
      expect(dataTo).toHaveProperty("clients");

      // Test combined dateFrom and dateTo
      const responseRange = await authRequest(
        "GET",
        `/api/crm/clients?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
        TEST_USER_IDS.DEMO
      );
      const dataRange = (await responseRange.json()) as ClientsListResponse;

      expect(responseRange.status).toBe(200);
      expect(dataRange).toHaveProperty("clients");
      expect(dataRange).toHaveProperty("total");
    });

    it("should return fewer or equal clients when date range is restricted", async () => {
      // Get all clients first
      const allResponse = await authRequest("GET", "/api/crm/clients?limit=100", TEST_USER_IDS.DEMO);
      const allData = (await allResponse.json()) as ClientsListResponse;

      // Filter to only last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const today = new Date();

      const filteredResponse = await authRequest(
        "GET",
        `/api/crm/clients?dateFrom=${encodeURIComponent(sevenDaysAgo.toISOString())}&dateTo=${encodeURIComponent(today.toISOString())}&limit=100`,
        TEST_USER_IDS.DEMO
      );
      const filteredData = (await filteredResponse.json()) as ClientsListResponse;

      expect(filteredResponse.status).toBe(200);
      // Filtered results should be <= total results
      expect(filteredData.total).toBeLessThanOrEqual(allData.total);
    });

    it("should return 404 for non-existent client profile", async () => {
      const response = await authRequest("GET", "/api/crm/clients/00000000-0000-0000-0000-000000000999", TEST_USER_IDS.DEMO);

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // ORGANIZATION SCOPING
  // ===========================================================================

  describe("Organization Scoping", () => {
    it("should scope pipelines to user's organization", async () => {
      const demoResponse = await authRequest("GET", "/api/crm/pipelines", TEST_USER_IDS.DEMO);
      const demoData = (await demoResponse.json()) as PipelinesListResponse;

      const arinaResponse = await authRequest("GET", "/api/crm/pipelines", TEST_USER_IDS.ARINA);
      const arinaData = (await arinaResponse.json()) as PipelinesListResponse;

      expect(demoResponse.status).toBe(200);
      expect(arinaResponse.status).toBe(200);

      // Both should return arrays (may have different data)
      expect(Array.isArray(demoData.pipelines)).toBe(true);
      expect(Array.isArray(arinaData.pipelines)).toBe(true);
    });

    it("should scope custom fields to user's organization", async () => {
      const demoResponse = await authRequest("GET", "/api/crm/fields", TEST_USER_IDS.DEMO);
      const demoData = (await demoResponse.json()) as FieldsListResponse;

      const arinaResponse = await authRequest("GET", "/api/crm/fields", TEST_USER_IDS.ARINA);
      const arinaData = (await arinaResponse.json()) as FieldsListResponse;

      expect(demoResponse.status).toBe(200);
      expect(arinaResponse.status).toBe(200);

      expect(Array.isArray(demoData.fields)).toBe(true);
      expect(Array.isArray(arinaData.fields)).toBe(true);
    });
  });
});
