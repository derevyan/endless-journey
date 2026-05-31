/**
 * Draft: Journeys Active Sessions Count Tests
 * Location target: apps/api/src/__tests__/journeys-active-sessions-count.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_JOURNEY_IDS,
  TEST_USER_IDS,
} from "./helpers/test-app";

describe("Journeys Active Sessions Count", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  it("returns active sessions count for journey", async () => {
    const response = await authRequest(
      "GET",
      `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/active-sessions-count`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as { count: number };

    expect(response.status).toBe(200);
    expect(typeof data.count).toBe("number");
  });

  it("returns 404 for cross-org journey", async () => {
    const response = await authRequest(
      "GET",
      `/api/journeys/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/active-sessions-count`,
      TEST_USER_IDS.ARINA
    );

    expect(response.status).toBe(404);
  });
});
