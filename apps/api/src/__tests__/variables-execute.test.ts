/**
 * Draft: Variables Execute API Integration Tests
 * Location target: apps/api/src/__tests__/variables-execute.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_JOURNEY_IDS,
  TEST_USER_IDS,
} from "./helpers/test-app";

describe("Variables Execute API", () => {
  const createdGlobalKey = `exec-global-${Date.now()}`;
  const createdJourneyKey = `exec-journey-${Date.now()}`;

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  afterAll(async () => {
    await authRequest(
      "DELETE",
      `/api/variables/global/${createdGlobalKey}`,
      TEST_USER_IDS.DEMO
    );
    await authRequest(
      "DELETE",
      `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/${createdJourneyKey}`,
      TEST_USER_IDS.DEMO
    );
  });

  it("executes global variable operations", async () => {
    const response = await authRequest("POST", "/api/variables/execute", TEST_USER_IDS.DEMO, {
      body: {
        scope: "global",
        operations: [{ op: "set", key: createdGlobalKey, value: "hello" }],
      },
    });

    expect(response.status).toBe(200);

    const getResponse = await authRequest(
      "GET",
      `/api/variables/global/${createdGlobalKey}`,
      TEST_USER_IDS.DEMO
    );
    const data = (await getResponse.json()) as { variable: { value: unknown } };

    expect(getResponse.status).toBe(200);
    expect(data.variable.value).toBe("hello");
  });

  it("executes journey-scoped variable operations", async () => {
    const response = await authRequest("POST", "/api/variables/execute", TEST_USER_IDS.DEMO, {
      body: {
        scope: "journey",
        journeyId: TEST_JOURNEY_IDS.SAAS_ONBOARDING,
        operations: [{ op: "set", key: createdJourneyKey, value: 123 }],
      },
    });

    expect(response.status).toBe(200);

    const getResponse = await authRequest(
      "GET",
      `/api/variables/journey/${TEST_JOURNEY_IDS.SAAS_ONBOARDING}/${createdJourneyKey}`,
      TEST_USER_IDS.DEMO
    );
    const data = (await getResponse.json()) as { variable: { value: unknown } };

    expect(getResponse.status).toBe(200);
    expect(data.variable.value).toBe(123);
  });

  it("rejects journey scope without journeyId", async () => {
    const response = await authRequest("POST", "/api/variables/execute", TEST_USER_IDS.DEMO, {
      body: {
        scope: "journey",
        operations: [{ op: "set", key: "no-journey", value: true }],
      },
    });

    expect(response.status).toBe(400);
  });

  it("rejects global operations for foreign org", async () => {
    const response = await authRequest("POST", "/api/variables/execute", TEST_USER_IDS.DEMO, {
      body: {
        scope: "global",
        organizationId: "org-not-allowed",
        operations: [{ op: "set", key: "nope", value: true }],
      },
    });

    expect(response.status).toBe(403);
  });
});
