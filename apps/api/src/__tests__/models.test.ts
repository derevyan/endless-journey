/**
 * Draft: Models API Integration Tests
 * Location target: apps/api/src/__tests__/models.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import { API_BASE_URL, authRequest, checkServerHealth, TEST_USER_IDS } from "./helpers/test-app";

interface ModelsListResponse {
  models: Array<{ id: string }>;
  metadata: {
    count: number;
    lastLoad: string | null;
  };
}

interface ModelsGroupedResponse {
  modelsByProvider: Record<string, Array<{ id: string }>>;
}

interface ModelDetailResponse {
  model: { id: string };
}

describe("Models API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  describe("GET /api/llm/models", () => {
    it("returns models with metadata", async () => {
      const response = await authRequest("GET", "/api/llm/models", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ModelsListResponse;

      expect(response.status).toBe(200);
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.metadata.count).toBe(data.models.length);
    });
  });

  describe("GET /api/llm/models/grouped", () => {
    it("returns models grouped by provider", async () => {
      const response = await authRequest("GET", "/api/llm/models/grouped", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ModelsGroupedResponse;

      expect(response.status).toBe(200);
      expect(data.modelsByProvider).toBeDefined();
      expect(typeof data.modelsByProvider).toBe("object");
    });
  });

  describe("GET /api/llm/models/:modelId", () => {
    it("returns 404 for unknown model", async () => {
      const response = await authRequest("GET", "/api/llm/models/non-existent-model-id", TEST_USER_IDS.DEMO);
      expect(response.status).toBe(404);
    });

    it("returns details for a known model when available", async () => {
      const listResponse = await authRequest("GET", "/api/llm/models", TEST_USER_IDS.DEMO);
      const listData = (await listResponse.json()) as ModelsListResponse;

      expect(listResponse.status).toBe(200);

      if (listData.models.length === 0) {
        return;
      }

      const modelId = listData.models[0].id;
      const response = await authRequest("GET", `/api/llm/models/${modelId}`, TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ModelDetailResponse;

      expect(response.status).toBe(200);
      expect(data.model.id).toBe(modelId);
    });
  });
});
