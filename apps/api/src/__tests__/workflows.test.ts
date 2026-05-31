/**
 * Workflow CRUD Integration Tests
 *
 * Tests for the /api/workflows endpoints using real HTTP requests.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm --filter @journey/api test
 *
 * @module api/tests/workflows
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  TEST_USER_IDS,
  authRequest,
  checkServerHealth,
  request,
} from "./helpers/test-app";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface WorkflowItem {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "archived";
  nodeCount?: number;
  agentCount?: number;
}

interface WorkflowsListResponse {
  workflows: WorkflowItem[];
  total: number;
  limit: number;
  offset: number;
}

interface WorkflowResponse {
  workflow: {
    id: string;
    key: string;
    name: string;
    description?: string;
    status: "draft" | "active" | "archived";
    configuration: {
      nodes: unknown[];
      edges: unknown[];
    };
  };
}

interface WorkflowExecutionResponse {
  message: string;
  conversationId: string;
  executionTrace: {
    status: "completed" | "blocked" | "error";
    durationMs: number;
    nodesExecuted: unknown[];
    path: string[];
  };
  variables: Record<string, unknown>;
}

interface WorkflowValidationResponse {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
  graphAnalysis: {
    hasStart: boolean;
    hasEnd: boolean;
    isConnected: boolean;
    hasCycles: boolean;
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Workflows API", () => {
  // Track created workflows for cleanup
  const createdWorkflowKeys: string[] = [];

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(`API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`);
    }
  });

  afterAll(async () => {
    // Cleanup: delete any workflows created during tests
    for (const key of createdWorkflowKeys) {
      try {
        await authRequest("DELETE", `/api/workflows/${key}?force=true`, TEST_USER_IDS.DEMO);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ==========================================================================
  // GET /api/workflows
  // ==========================================================================

  describe("GET /api/workflows", () => {
    it("returns 401 without authentication", async () => {
      const response = await request("GET", "/api/workflows");
      expect(response.status).toBe(401);
    });

    it("returns workflows list for authenticated user", async () => {
      const response = await authRequest("GET", "/api/workflows", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as WorkflowsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("workflows");
      expect(Array.isArray(data.workflows)).toBe(true);
      expect(data).toHaveProperty("total");
    });

    it("includes demo workflows in the list", async () => {
      const response = await authRequest("GET", "/api/workflows", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as WorkflowsListResponse;

      expect(data.workflows.length).toBeGreaterThanOrEqual(1);

      // Check that demo-assistant exists
      const demoAssistant = data.workflows.find((w) => w.key === "demo-assistant");
      expect(demoAssistant).toBeDefined();
    });
  });

  // ==========================================================================
  // GET /api/workflows/:key
  // ==========================================================================

  describe("GET /api/workflows/:key", () => {
    it("returns 401 without authentication", async () => {
      const response = await request("GET", "/api/workflows/demo-assistant");
      expect(response.status).toBe(401);
    });

    it("returns a specific workflow by key", async () => {
      const response = await authRequest("GET", "/api/workflows/demo-assistant", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as WorkflowResponse;

      expect(response.status).toBe(200);
      expect(data.workflow).toBeDefined();
      expect(data.workflow.key).toBe("demo-assistant");
      expect(data.workflow.configuration).toBeDefined();
      expect(data.workflow.configuration.nodes).toBeDefined();
      expect(data.workflow.configuration.edges).toBeDefined();
    });

    it("returns 404 for non-existent workflow", async () => {
      const response = await authRequest(
        "GET",
        "/api/workflows/non-existent-workflow-key",
        TEST_USER_IDS.DEMO
      );
      expect(response.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/workflows/:key/execute
  // ==========================================================================

  describe("POST /api/workflows/:key/execute", () => {
    it("returns 401 without authentication", async () => {
      const response = await request("POST", "/api/workflows/demo-assistant/execute", {
        body: { message: "Hello" },
      });
      expect(response.status).toBe(401);
    });

    it("executes demo-assistant workflow successfully", async () => {
      const response = await authRequest(
        "POST",
        "/api/workflows/demo-assistant/execute",
        TEST_USER_IDS.DEMO,
        {
          body: {
            message: "Hi, can you help me?",
            mockLlm: true,
          },
        }
      );
      const data = (await response.json()) as WorkflowExecutionResponse;

      expect(response.status).toBe(200);
      expect(data.message).toBeDefined();
      expect(data.conversationId).toBeDefined();
      expect(data.executionTrace).toBeDefined();
      expect(data.executionTrace.status).toBe("completed");
      expect(data.executionTrace.path.length).toBeGreaterThanOrEqual(2);
    }, 60000);

    it("passes conversation history to execution", async () => {
      const response = await authRequest(
        "POST",
        "/api/workflows/demo-assistant/execute",
        TEST_USER_IDS.DEMO,
        {
          body: {
            message: "What was my question?",
            conversationHistory: [
              { role: "user", content: "My name is TestUser" },
              { role: "assistant", content: "Hello TestUser! How can I help you?" },
            ],
            mockLlm: true,
          },
        }
      );
      const data = (await response.json()) as WorkflowExecutionResponse;

      expect(response.status).toBe(200);
      expect(data.executionTrace.status).toBe("completed");
    }, 60000);

    it("returns 404 for non-existent workflow", async () => {
      const response = await authRequest(
        "POST",
        "/api/workflows/non-existent/execute",
        TEST_USER_IDS.DEMO,
        {
          body: { message: "Test" },
        }
      );
      expect(response.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/workflows/:key/validate
  // ==========================================================================

  describe("POST /api/workflows/:key/validate", () => {
    it("validates a correct workflow configuration", async () => {
      const response = await authRequest(
        "POST",
        "/api/workflows/demo-assistant/validate",
        TEST_USER_IDS.DEMO,
        {
          body: {
            nodes: [
              { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
              { id: "agent1", type: "agent", position: { x: 100, y: 0 }, data: { name: "Test" } },
              { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
            ],
            edges: [
              { id: "e1", source: "start", target: "agent1" },
              { id: "e2", source: "agent1", target: "end" },
            ],
          },
        }
      );
      const data = (await response.json()) as WorkflowValidationResponse;

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.graphAnalysis.hasStart).toBe(true);
      expect(data.graphAnalysis.hasEnd).toBe(true);
    });

    it("returns validation errors for invalid configuration", async () => {
      const response = await authRequest(
        "POST",
        "/api/workflows/demo-assistant/validate",
        TEST_USER_IDS.DEMO,
        {
          body: {
            nodes: [
              { id: "agent1", type: "agent", position: { x: 100, y: 0 }, data: {} },
            ],
            edges: [],
          },
        }
      );
      const data = (await response.json()) as WorkflowValidationResponse;

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.graphAnalysis.hasStart).toBe(false);
      expect(data.errors.length).toBeGreaterThan(0);
    });
  });
});
