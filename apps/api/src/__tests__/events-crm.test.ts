/**
 * Draft: CRM Events API Integration Tests
 * Location target: apps/api/src/__tests__/events-crm.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_USER_IDS,
} from "./helpers/test-app";

describe("Events CRM API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  it("lists CRM activity events", async () => {
    const response = await authRequest("GET", "/api/events/crm", TEST_USER_IDS.DEMO);
    const data = (await response.json()) as {
      activities: Array<{ id: string; activityType: string }>;
      pagination: { total: number; limit: number; offset: number };
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(data.activities)).toBe(true);
    expect(data.pagination).toBeDefined();
  });
});
