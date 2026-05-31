/**
 * Draft: Mindstates Definitions API Integration Tests
 * Location target: apps/api/src/__tests__/mindstates.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_USER_IDS,
} from "./helpers/test-app";

interface MindstateDefinition {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  analysisMode?: string;
}

interface MindstateDefinitionResponse {
  definition: MindstateDefinition;
}

interface MindstateDefinitionsListResponse {
  definitions: MindstateDefinition[];
}

describe("Mindstates Definitions API", () => {
  const createdKeys: string[] = [];
  let definitionKey: string | null = null;
  let definitionId: string | null = null;

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  afterAll(async () => {
    for (const key of createdKeys) {
      try {
        await authRequest(
          "DELETE",
          `/api/mindstates/definitions/${key}`,
          TEST_USER_IDS.DEMO
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("creates a mindstate definition", async () => {
    definitionKey = `test-mindstate-${Date.now()}`;
    const response = await authRequest(
      "POST",
      "/api/mindstates/definitions",
      TEST_USER_IDS.DEMO,
      {
        body: {
          key: definitionKey,
          name: "Test Mindstate",
          description: "Created by integration tests",
        },
      }
    );

    const data = (await response.json()) as MindstateDefinitionResponse;

    expect(response.status).toBe(201);
    expect(data.definition.key).toBe(definitionKey);

    createdKeys.push(definitionKey);
    definitionId = data.definition.id;
  });

  it("lists mindstate definitions", async () => {
    const response = await authRequest(
      "GET",
      "/api/mindstates/definitions",
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as MindstateDefinitionsListResponse;

    expect(response.status).toBe(200);
    expect(Array.isArray(data.definitions)).toBe(true);
    expect(data.definitions.some((def) => def.key === definitionKey)).toBe(true);
  });

  it("gets a definition by key", async () => {
    const response = await authRequest(
      "GET",
      `/api/mindstates/definitions/${definitionKey}`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as MindstateDefinitionResponse;

    expect(response.status).toBe(200);
    expect(data.definition.key).toBe(definitionKey);
  });

  it("gets a definition by id", async () => {
    const response = await authRequest(
      "GET",
      `/api/mindstates/definitions/${definitionId}`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as MindstateDefinitionResponse;

    expect(response.status).toBe(200);
    expect(data.definition.id).toBe(definitionId);
  });

  it("updates a mindstate definition", async () => {
    const response = await authRequest(
      "PUT",
      `/api/mindstates/definitions/${definitionKey}`,
      TEST_USER_IDS.DEMO,
      {
        body: {
          name: "Updated Mindstate",
          description: "Updated by tests",
        },
      }
    );

    const data = (await response.json()) as MindstateDefinitionResponse;

    expect(response.status).toBe(200);
    expect(data.definition.name).toBe("Updated Mindstate");
    expect(data.definition.description).toBe("Updated by tests");
  });

  it("rejects duplicate definition keys", async () => {
    const response = await authRequest(
      "POST",
      "/api/mindstates/definitions",
      TEST_USER_IDS.DEMO,
      {
        body: {
          key: definitionKey,
          name: "Duplicate Mindstate",
        },
      }
    );

    expect(response.status).toBe(409);
  });

  it("deletes a mindstate definition", async () => {
    const response = await authRequest(
      "DELETE",
      `/api/mindstates/definitions/${definitionKey}`,
      TEST_USER_IDS.DEMO
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { success: boolean };
    expect(data.success).toBe(true);

    if (definitionKey) {
      const index = createdKeys.indexOf(definitionKey);
      if (index >= 0) {
        createdKeys.splice(index, 1);
      }
    }
  });
});

// =============================================================================
// SSE EVENTS - MINDSTATE DEFINITION CRUD
// =============================================================================

describe("Mindstate SSE Events", () => {
  let testDefinitionKey: string;
  let testDefinitionId: string;
  let startSequence: number;

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }

    // Get latest sequence before tests to filter only our events
    const latestResponse = await authRequest(
      "GET",
      "/api/events/replay/latest",
      TEST_USER_IDS.DEMO
    );
    const latestData = (await latestResponse.json()) as { latestSequence: number };
    startSequence = latestData.latestSequence || 0;
  });

  afterAll(async () => {
    // Cleanup - delete definition if it still exists
    if (testDefinitionKey) {
      try {
        await authRequest(
          "DELETE",
          `/api/mindstates/definitions/${testDefinitionKey}`,
          TEST_USER_IDS.DEMO
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("emits mindstate.definition.created event on create", async () => {
    testDefinitionKey = `sse-test-${Date.now()}`;

    // Create definition
    const createResponse = await authRequest(
      "POST",
      "/api/mindstates/definitions",
      TEST_USER_IDS.DEMO,
      {
        body: {
          key: testDefinitionKey,
          name: "SSE Test Definition",
          description: "Testing SSE events",
        },
      }
    );
    expect(createResponse.status).toBe(201);

    const createData = (await createResponse.json()) as MindstateDefinitionResponse;
    testDefinitionId = createData.definition.id;

    // Wait briefly for event to be stored
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check replay endpoint for the created event
    const replayResponse = await authRequest(
      "GET",
      `/api/events/replay?types=mindstate.definition.created&sinceSequence=${startSequence}`,
      TEST_USER_IDS.DEMO
    );
    const replayData = (await replayResponse.json()) as {
      events: Array<{ type: string; payload?: { definitionKey?: string } }>;
    };

    const createdEvent = replayData.events.find(
      (e) => e.type === "mindstate.definition.created" && e.payload?.definitionKey === testDefinitionKey
    );
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.payload?.definitionKey).toBe(testDefinitionKey);
  });

  it("emits mindstate.definition.updated event on update", async () => {
    // Update definition
    const updateResponse = await authRequest(
      "PUT",
      `/api/mindstates/definitions/${testDefinitionKey}`,
      TEST_USER_IDS.DEMO,
      {
        body: {
          name: "Updated SSE Test",
          description: "Updated via SSE test",
        },
      }
    );
    expect(updateResponse.status).toBe(200);

    // Wait briefly for event
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check replay endpoint for the updated event
    const replayResponse = await authRequest(
      "GET",
      `/api/events/replay?types=mindstate.definition.updated&sinceSequence=${startSequence}`,
      TEST_USER_IDS.DEMO
    );
    const replayData = (await replayResponse.json()) as {
      events: Array<{ type: string; payload?: { definitionKey?: string } }>;
    };

    const updatedEvent = replayData.events.find(
      (e) => e.type === "mindstate.definition.updated" && e.payload?.definitionKey === testDefinitionKey
    );
    expect(updatedEvent).toBeDefined();
  });

  it("emits mindstate.definition.deleted event on delete", async () => {
    // Delete definition
    const deleteResponse = await authRequest(
      "DELETE",
      `/api/mindstates/definitions/${testDefinitionKey}`,
      TEST_USER_IDS.DEMO
    );
    expect(deleteResponse.status).toBe(200);

    // Wait briefly for event
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check replay endpoint for the deleted event
    const replayResponse = await authRequest(
      "GET",
      `/api/events/replay?types=mindstate.definition.deleted&sinceSequence=${startSequence}`,
      TEST_USER_IDS.DEMO
    );
    const replayData = (await replayResponse.json()) as {
      events: Array<{ type: string; payload?: { definitionKey?: string } }>;
    };

    const deletedEvent = replayData.events.find(
      (e) => e.type === "mindstate.definition.deleted" && e.payload?.definitionKey === testDefinitionKey
    );
    expect(deletedEvent).toBeDefined();

    // Clear the key so cleanup doesn't run
    testDefinitionKey = "";
  });
});

// =============================================================================
// CLIENT MINDSTATES - ORGANIZATION SCOPING
// =============================================================================

describe("Mindstates Client API - Organization Scoping", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  it("should return 404 when accessing non-existent client mindstates", async () => {
    // Non-existent client should return 404
    const response = await authRequest(
      "GET",
      "/api/mindstates/clients/00000000-0000-0000-0000-000000000999",
      TEST_USER_IDS.DEMO
    );

    expect(response.status).toBe(404);
  });

  it("should return 404 for all endpoints when accessing client from different org", async () => {
    const clientId = "00000000-0000-0000-0000-000000000001";
    const endpoints = [
      { method: "GET", path: `/api/mindstates/clients/${clientId}` },
      { method: "GET", path: `/api/mindstates/clients/${clientId}/engagement` },
      { method: "GET", path: `/api/mindstates/clients/${clientId}/engagement/history` },
    ];

    for (const { method, path } of endpoints) {
      const response = await authRequest(method as "GET", path, TEST_USER_IDS.ARINA);
      expect(response.status).toBe(404);
    }

    // POST endpoint with body
    const analyzeResponse = await authRequest(
      "POST",
      `/api/mindstates/clients/${clientId}/engagement/analyze`,
      TEST_USER_IDS.ARINA,
      { body: { message: "Test" } }
    );
    expect(analyzeResponse.status).toBe(404);
  });
});
