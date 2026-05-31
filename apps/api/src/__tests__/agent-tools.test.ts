/**
 * Draft: Agent Tools API Integration Tests
 * Location target: apps/api/src/__tests__/agent-tools.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_USER_IDS,
} from "./helpers/test-app";

interface AgentToolDefinition {
  id: string;
  name: string;
  source: "system" | "utility" | "mcp";
  category: string;
}

interface AgentToolsResponse {
  tools: AgentToolDefinition[];
  metadata: {
    count: {
      total: number;
      system: number;
      utility: number;
      mcp: number;
    };
    timestamp: string;
  };
}

interface AgentToolCategoriesResponse {
  categories: Record<string, AgentToolDefinition[]>;
}

interface AgentToolsAvailableResponse {
  tools: AgentToolDefinition[];
}

describe("LLM Tools API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  describe("GET /api/llm/tools", () => {
    it("returns tool definitions with source counts", async () => {
      const response = await authRequest("GET", "/api/llm/tools", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as AgentToolsResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.count.total).toBe(data.tools.length);

      const counts = data.tools.reduce(
        (acc, tool) => {
          acc.total += 1;
          if (tool.source === "system") acc.system += 1;
          if (tool.source === "utility") acc.utility += 1;
          if (tool.source === "mcp") acc.mcp += 1;
          return acc;
        },
        { total: 0, system: 0, utility: 0, mcp: 0 }
      );

      expect(data.metadata.count.system).toBe(counts.system);
      expect(data.metadata.count.utility).toBe(counts.utility);
      expect(data.metadata.count.mcp).toBe(counts.mcp);
      expect(data.metadata.count.total).toBe(counts.total);
    });
  });

  describe("GET /api/llm/tools/categories", () => {
    it("returns tools grouped by category", async () => {
      const response = await authRequest("GET", "/api/llm/tools/categories", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as AgentToolCategoriesResponse;

      expect(response.status).toBe(200);
      expect(data.categories).toBeDefined();

      for (const [category, tools] of Object.entries(data.categories)) {
        expect(typeof category).toBe("string");
        expect(Array.isArray(tools)).toBe(true);
      }
    });
  });

  describe("GET /api/llm/tools/available", () => {
    it("returns currently available tools", async () => {
      const response = await authRequest("GET", "/api/llm/tools/available", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as AgentToolsAvailableResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.tools)).toBe(true);
    });
  });
});
