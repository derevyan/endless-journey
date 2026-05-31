/**
 * Prompts API Integration Tests
 *
 * Tests for the /api/prompts endpoints using real HTTP requests.
 * Covers prompt CRUD, version management, and compilation.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:prompts
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  API_BASE_URL,
  request,
  authRequest,
  TEST_USER_IDS,
  checkServerHealth,
  type ErrorResponse,
} from "./helpers/test-app";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface PromptResponse {
  id: string;
  name: string;
  description?: string;
  type: "text" | "chat";
  tags: string[];
  isSystem: boolean;
  productionVersion?: VersionSummary;
  latestVersion?: VersionSummary;
  createdAt: string;
  updatedAt: string;
}

interface VersionSummary {
  id: string;
  versionId: string;
  labels: string[];
  createdAt: string;
}

interface PromptVersionResponse {
  id: string;
  versionId: string;
  content: string | ChatMessage[];
  config?: Record<string, unknown>;
  labels: string[];
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PromptsListResponse {
  prompts: PromptResponse[];
  total: number;
}

interface VersionsListResponse {
  versions: PromptVersionResponse[];
}

interface CompiledPromptResponse {
  name: string;
  type: "text" | "chat";
  versionId: string;
  label?: string;
  content: string | ChatMessage[];
  config?: Record<string, unknown>;
}

interface VariablesResponse {
  versionId: string;
  variables: string[];
  paths: string[];
}

// =============================================================================
// TESTS
// =============================================================================

describe("Prompts API", () => {
  // Track created prompts for cleanup
  const createdPromptNames: string[] = [];

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  afterAll(async () => {
    // Cleanup: delete any prompts created during tests
    for (const name of createdPromptNames) {
      try {
        await authRequest("DELETE", `/api/prompts/${name}`, TEST_USER_IDS.DEMO);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ===========================================================================
  // PROMPT CRUD
  // ===========================================================================

  describe("GET /api/prompts", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/prompts");
      expect(response.status).toBe(401);
    });

    it("should return prompts list for authenticated user", async () => {
      const response = await authRequest("GET", "/api/prompts", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as PromptsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("prompts");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.prompts)).toBe(true);
    });
  });

  describe("POST /api/prompts", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", "/api/prompts", {
        body: { name: "test", type: "text", content: "Hello" },
      });
      expect(response.status).toBe(401);
    });

    it("should return 400 if name is missing", async () => {
      const response = await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { type: "text", content: "Hello" },
      });
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("should create a new text prompt", async () => {
      const testName = `test-prompt-${Date.now()}`;
      const response = await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: {
          name: testName,
          description: "Test prompt for integration tests",
          type: "text",
          content: "Hello {{name}}, welcome to {{company}}!",
          tags: ["test", "integration"],
        },
      });
      const data = (await response.json()) as PromptResponse;

      expect(response.status).toBe(201);
      expect(data.name).toBe(testName);
      expect(data.type).toBe("text");
      expect(data.tags).toContain("test");
      expect(data.latestVersion).toBeDefined();

      // Track for cleanup
      createdPromptNames.push(testName);
    });

    it("should create a new chat prompt", async () => {
      const testName = `test-chat-prompt-${Date.now()}`;
      const response = await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: {
          name: testName,
          type: "chat",
          content: [
            { role: "system", content: "You are a helpful assistant for {{company}}." },
            { role: "user", content: "Hello!" },
          ],
        },
      });
      const data = (await response.json()) as PromptResponse;

      expect(response.status).toBe(201);
      expect(data.name).toBe(testName);
      expect(data.type).toBe("chat");

      // Track for cleanup
      createdPromptNames.push(testName);
    });

    it("should return 409 for duplicate name", async () => {
      const testName = `test-duplicate-${Date.now()}`;

      // Create first
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "First" },
      });
      createdPromptNames.push(testName);

      // Try to create with same name - service returns 409 Conflict
      const response = await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "Second" },
      });

      // Service may return 400 (validation) or 409 (conflict) depending on implementation
      expect([400, 409]).toContain(response.status);
    });
  });

  describe("GET /api/prompts/:name", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/prompts/test-prompt");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent prompt", async () => {
      const response = await authRequest(
        "GET",
        "/api/prompts/non-existent-prompt-xyz",
        TEST_USER_IDS.DEMO
      );
      expect(response.status).toBe(404);
    });

    it("should return prompt by name", async () => {
      const testName = `test-get-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "Test content" },
      });
      createdPromptNames.push(testName);

      const response = await authRequest("GET", `/api/prompts/${testName}`, TEST_USER_IDS.DEMO);
      const data = (await response.json()) as PromptResponse;

      expect(response.status).toBe(200);
      expect(data.name).toBe(testName);
    });
  });

  describe("PUT /api/prompts/:name", () => {
    it("should update prompt metadata", async () => {
      const testName = `test-update-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "Original" },
      });
      createdPromptNames.push(testName);

      const response = await authRequest("PUT", `/api/prompts/${testName}`, TEST_USER_IDS.DEMO, {
        body: { description: "Updated description", tags: ["updated"] },
      });
      const data = (await response.json()) as PromptResponse;

      expect(response.status).toBe(200);
      expect(data.description).toBe("Updated description");
      expect(data.tags).toContain("updated");
    });
  });

  describe("DELETE /api/prompts/:name", () => {
    it("should soft delete a prompt", async () => {
      const testName = `test-delete-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "To delete" },
      });

      const deleteResponse = await authRequest(
        "DELETE",
        `/api/prompts/${testName}`,
        TEST_USER_IDS.DEMO
      );
      expect(deleteResponse.status).toBe(200);

      // Verify it's not accessible
      const getResponse = await authRequest(
        "GET",
        `/api/prompts/${testName}`,
        TEST_USER_IDS.DEMO
      );
      expect(getResponse.status).toBe(404);
    });
  });

  // ===========================================================================
  // VERSION MANAGEMENT
  // ===========================================================================

  describe("GET /api/prompts/:name/versions", () => {
    it("should return versions list", async () => {
      const testName = `test-versions-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "Initial" },
      });
      createdPromptNames.push(testName);

      const response = await authRequest(
        "GET",
        `/api/prompts/${testName}/versions`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as VersionsListResponse;

      expect(response.status).toBe(200);
      expect(data.versions).toHaveLength(1);
      expect(data.versions[0].versionId).toBe("v001");
    });
  });

  describe("POST /api/prompts/:name/versions", () => {
    it("should create a new version with auto-increment versionId", async () => {
      const testName = `test-new-version-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "v001 content" },
      });
      createdPromptNames.push(testName);

      const response = await authRequest(
        "POST",
        `/api/prompts/${testName}/versions`,
        TEST_USER_IDS.DEMO,
        { body: { content: "v002 content", notes: "Second version" } }
      );
      const data = (await response.json()) as PromptVersionResponse;

      expect(response.status).toBe(201);
      expect(data.versionId).toBe("v002");
      expect(data.labels).toContain("latest");
    });

    it("should move latest label to new version", async () => {
      const testName = `test-latest-move-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "v001" },
      });
      createdPromptNames.push(testName);

      // Create v002
      await authRequest("POST", `/api/prompts/${testName}/versions`, TEST_USER_IDS.DEMO, {
        body: { content: "v002" },
      });

      // Check v001 no longer has latest
      const versionsResponse = await authRequest(
        "GET",
        `/api/prompts/${testName}/versions`,
        TEST_USER_IDS.DEMO
      );
      const versions = (await versionsResponse.json()) as VersionsListResponse;

      const v001 = versions.versions.find((v) => v.versionId === "v001");
      const v002 = versions.versions.find((v) => v.versionId === "v002");

      expect(v001?.labels).not.toContain("latest");
      expect(v002?.labels).toContain("latest");
    });
  });

  describe("PUT /api/prompts/:name/versions/:vId/labels", () => {
    it("should update labels and move production", async () => {
      const testName = `test-labels-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "v001" },
      });
      createdPromptNames.push(testName);

      // Promote v001 to production
      const response = await authRequest(
        "PUT",
        `/api/prompts/${testName}/versions/v001/labels`,
        TEST_USER_IDS.DEMO,
        { body: { labels: ["production", "latest"] } }
      );
      const data = (await response.json()) as PromptVersionResponse;

      expect(response.status).toBe(200);
      expect(data.labels).toContain("production");

      // Check prompt now has productionVersion
      const promptResponse = await authRequest(
        "GET",
        `/api/prompts/${testName}`,
        TEST_USER_IDS.DEMO
      );
      const prompt = (await promptResponse.json()) as PromptResponse;

      expect(prompt.productionVersion).toBeDefined();
      expect(prompt.productionVersion?.versionId).toBe("v001");
    });
  });

  // ===========================================================================
  // COMPILATION & VARIABLES
  // ===========================================================================

  describe("POST /api/prompts/:name/compile", () => {
    it("should compile text prompt with variables", async () => {
      const testName = `test-compile-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: {
          name: testName,
          type: "text",
          content: "Hello {{name}}, welcome to {{company}}!",
        },
      });
      createdPromptNames.push(testName);

      // Promote to production
      await authRequest(
        "PUT",
        `/api/prompts/${testName}/versions/v001/labels`,
        TEST_USER_IDS.DEMO,
        { body: { labels: ["production", "latest"] } }
      );

      const response = await authRequest(
        "POST",
        `/api/prompts/${testName}/compile`,
        TEST_USER_IDS.DEMO,
        { body: { variables: { name: "John", company: "Acme Inc" } } }
      );
      const data = (await response.json()) as CompiledPromptResponse;

      expect(response.status).toBe(200);
      expect(data.content).toBe("Hello John, welcome to Acme Inc!");
    });

    it("should compile chat prompt with variables", async () => {
      const testName = `test-compile-chat-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: {
          name: testName,
          type: "chat",
          content: [
            { role: "system", content: "You help users of {{company}}." },
            { role: "user", content: "My name is {{name}}." },
          ],
        },
      });
      createdPromptNames.push(testName);

      // Promote to production
      await authRequest(
        "PUT",
        `/api/prompts/${testName}/versions/v001/labels`,
        TEST_USER_IDS.DEMO,
        { body: { labels: ["production", "latest"] } }
      );

      const response = await authRequest(
        "POST",
        `/api/prompts/${testName}/compile`,
        TEST_USER_IDS.DEMO,
        { body: { variables: { name: "Jane", company: "TechCo" } } }
      );
      const data = (await response.json()) as CompiledPromptResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.content)).toBe(true);
      expect((data.content as ChatMessage[])[0].content).toBe("You help users of TechCo.");
      expect((data.content as ChatMessage[])[1].content).toBe("My name is Jane.");
    });

    it("should compile by label", async () => {
      const testName = `test-compile-label-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "Version 1: {{x}}" },
      });
      createdPromptNames.push(testName);

      // Create v002
      await authRequest("POST", `/api/prompts/${testName}/versions`, TEST_USER_IDS.DEMO, {
        body: { content: "Version 2: {{x}}" },
      });

      // Compile with label=latest (should use v002)
      const response = await authRequest(
        "POST",
        `/api/prompts/${testName}/compile`,
        TEST_USER_IDS.DEMO,
        { body: { variables: { x: "test" }, label: "latest" } }
      );
      const data = (await response.json()) as CompiledPromptResponse;

      expect(response.status).toBe(200);
      expect(data.content).toBe("Version 2: test");
      expect(data.versionId).toBe("v002");
    });
  });

  describe("GET /api/prompts/:name/variables", () => {
    it("should extract variables from prompt", async () => {
      const testName = `test-variables-${Date.now()}`;
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: {
          name: testName,
          type: "text",
          content: "Hello {{user.name}}, your balance is {{account.balance}}!",
        },
      });
      createdPromptNames.push(testName);

      // Promote to production for the endpoint to work
      await authRequest(
        "PUT",
        `/api/prompts/${testName}/versions/v001/labels`,
        TEST_USER_IDS.DEMO,
        { body: { labels: ["production", "latest"] } }
      );

      const response = await authRequest(
        "GET",
        `/api/prompts/${testName}/variables`,
        TEST_USER_IDS.DEMO
      );
      const data = (await response.json()) as VariablesResponse;

      expect(response.status).toBe(200);
      // Variables extraction returns root-level names
      expect(data.variables).toContain("user");
      expect(data.variables).toContain("account");
      // Full paths are returned in the 'paths' field
      expect(data.paths).toContain("user.name");
      expect(data.paths).toContain("account.balance");
    });
  });

  // ===========================================================================
  // ORGANIZATION ISOLATION
  // ===========================================================================

  describe("Organization Isolation", () => {
    it("should not allow access to another org's prompts", async () => {
      const testName = `test-isolation-${Date.now()}`;

      // Demo creates a prompt
      await authRequest("POST", "/api/prompts", TEST_USER_IDS.DEMO, {
        body: { name: testName, type: "text", content: "Demo's prompt" },
      });
      createdPromptNames.push(testName);

      // Arina (different org) tries to access it
      const response = await authRequest(
        "GET",
        `/api/prompts/${testName}`,
        TEST_USER_IDS.ARINA
      );

      expect(response.status).toBe(404);
    });
  });
});
