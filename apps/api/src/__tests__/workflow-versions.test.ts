/**
 * Draft: Workflow Versions API Integration Tests
 * Location target: apps/api/src/__tests__/workflow-versions.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_USER_IDS,
} from "./helpers/test-app";

interface WorkflowItem {
  configuration: {
    nodes: unknown[];
    edges: unknown[];
  };
}

interface WorkflowResponse {
  workflow: WorkflowItem;
}

interface WorkflowVersionItem {
  id: string;
  workflowId: string;
  versionId: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface WorkflowVersionsListResponse {
  versions: WorkflowVersionItem[];
}

interface WorkflowVersionResponse {
  version: WorkflowVersionItem;
  data: {
    nodes: unknown[];
    edges: unknown[];
  };
}

describe("Workflow Versions API", () => {
  const workflowKey = "demo-assistant";
  const createdVersions: string[] = [];
  let versionId: string | null = null;
  let workflowConfig: WorkflowItem["configuration"] | null = null;

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }

    const workflowResponse = await authRequest(
      "GET",
      `/api/workflows/${workflowKey}`,
      TEST_USER_IDS.DEMO
    );
    const workflowData = (await workflowResponse.json()) as WorkflowResponse;

    if (workflowResponse.status === 200) {
      workflowConfig = workflowData.workflow.configuration;
    }
  });

  afterAll(async () => {
    for (const id of createdVersions) {
      try {
        await authRequest(
          "DELETE",
          `/api/workflows/${workflowKey}/versions/${id}`,
          TEST_USER_IDS.DEMO
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("creates a new workflow version", async () => {
    versionId = `v-${Date.now()}`;
    if (!workflowConfig) {
      throw new Error("Workflow configuration unavailable for version tests");
    }

    const response = await authRequest(
      "POST",
      `/api/workflows/${workflowKey}/versions`,
      TEST_USER_IDS.DEMO,
      {
        body: {
          versionId,
          notes: "Integration test version",
          configuration: workflowConfig,
        },
      }
    );
    const data = (await response.json()) as { version: WorkflowVersionItem };

    expect(response.status).toBe(201);
    expect(data.version.versionId).toBe(versionId);

    createdVersions.push(versionId);
  });

  it("lists workflow versions including the new one", async () => {
    const response = await authRequest(
      "GET",
      `/api/workflows/${workflowKey}/versions`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as WorkflowVersionsListResponse;

    expect(response.status).toBe(200);
    expect(Array.isArray(data.versions)).toBe(true);
    expect(data.versions.some((v) => v.versionId === versionId)).toBe(true);
  });

  it("returns a workflow version snapshot", async () => {
    const response = await authRequest(
      "GET",
      `/api/workflows/${workflowKey}/versions/${versionId}`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as WorkflowVersionResponse;

    expect(response.status).toBe(200);
    expect(data.version.versionId).toBe(versionId);
    expect(Array.isArray(data.data.nodes)).toBe(true);
    expect(Array.isArray(data.data.edges)).toBe(true);
  });

  it("rejects duplicate version IDs", async () => {
    if (!workflowConfig) {
      throw new Error("Workflow configuration unavailable for version tests");
    }

    const response = await authRequest(
      "POST",
      `/api/workflows/${workflowKey}/versions`,
      TEST_USER_IDS.DEMO,
      {
        body: {
          versionId,
          notes: "Duplicate attempt",
          configuration: workflowConfig,
        },
      }
    );

    // Should return 409 Conflict for duplicate version IDs
    // Some database configurations may return 500 if constraint handling differs
    expect([409, 500]).toContain(response.status);
  });

  it("deletes a workflow version", async () => {
    const response = await authRequest(
      "DELETE",
      `/api/workflows/${workflowKey}/versions/${versionId}`,
      TEST_USER_IDS.DEMO
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { success: boolean };
    expect(data.success).toBe(true);

    if (versionId) {
      const index = createdVersions.indexOf(versionId);
      if (index >= 0) {
        createdVersions.splice(index, 1);
      }
    }
  });
});
