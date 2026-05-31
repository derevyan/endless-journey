/**
 * Draft: LLM Events API Integration Tests
 * Location target: apps/api/src/__tests__/events-llm.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_USER_IDS,
} from "./helpers/test-app";

describe("Events LLM API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  it("lists LLM usage events", async () => {
    const response = await authRequest("GET", "/api/events/llm", TEST_USER_IDS.DEMO);
    const data = (await response.json()) as {
      events: Array<{ id: string; model: string | null; provider: string | null }>;
      pagination: { total: number; limit: number; offset: number };
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("returns LLM usage stats", async () => {
    const response = await authRequest("GET", "/api/events/llm/stats", TEST_USER_IDS.DEMO);
    const data = (await response.json()) as {
      totals: { tokens: number; costUSD: string; calls: number };
      byModel: Record<string, { tokens: number; costUSD: string; calls: number }>;
      byService: Record<string, { tokens: number; costUSD: string; calls: number }>;
      filters: { services: string[]; models: string[]; providers: string[] };
    };

    expect(response.status).toBe(200);
    expect(data.totals.tokens).toBeGreaterThanOrEqual(0);
    expect(data.totals.calls).toBeGreaterThanOrEqual(0);
  });
});
