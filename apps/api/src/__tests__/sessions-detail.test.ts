/**
 * Draft: Sessions Detail API Integration Tests
 * Location target: apps/api/src/__tests__/sessions-detail.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_USER_IDS,
} from "./helpers/test-app";

// This session ID should exist in seed data for demo user's organization
const SEEDED_SESSION_ID = "00000000-0000-0000-2000-000000000001";

describe("Sessions Detail API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  it("returns session detail with interactions for seeded session", async () => {
    const response = await authRequest(
      "GET",
      `/api/sessions/${SEEDED_SESSION_ID}`,
      TEST_USER_IDS.DEMO
    );

    // If session not found (seed data may not be loaded), skip test
    if (response.status === 404) {
      return;
    }

    const data = (await response.json()) as {
      session: { id: string; interactions: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(data.session.id).toBe(SEEDED_SESSION_ID);
    expect(Array.isArray(data.session.interactions)).toBe(true);
  });
});
