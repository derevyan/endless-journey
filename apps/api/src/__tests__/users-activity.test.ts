/**
 * Draft: Users Activity API Integration Tests
 * Location target: apps/api/src/__tests__/users-activity.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_USER_IDS,
} from "./helpers/test-app";

interface UsersListResponse {
  users: Array<{ id: string }>;
  total: number;
}

describe("Users Activity API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  it("returns activity timeline for a known user", async () => {
    const usersResponse = await authRequest("GET", "/api/users?limit=1", TEST_USER_IDS.DEMO);
    const usersData = (await usersResponse.json()) as UsersListResponse;

    expect(usersResponse.status).toBe(200);

    if (!usersData.users.length) {
      return;
    }

    const userId = usersData.users[0].id;
    const response = await authRequest(
      "GET",
      `/api/users/${userId}/activity`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as {
      activities: unknown[];
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(data.activities)).toBe(true);
  });
});
