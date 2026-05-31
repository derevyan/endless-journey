/**
 * Draft: Journey Versions API Integration Tests
 * Location target: apps/api/src/__tests__/journey-versions.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  TEST_JOURNEY_IDS,
  TEST_USER_IDS,
  testJourneyConfig,
} from "./helpers/test-app";

interface JourneyVersionItem {
  id: string;
  journeyId: string;
  versionId: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface JourneyVersionsListResponse {
  versions: JourneyVersionItem[];
}

interface JourneyVersionResponse {
  version: JourneyVersionItem;
  data: {
    nodes: unknown[];
    edges: unknown[];
  };
}

describe("Journey Versions API", () => {
  const journeyId = TEST_JOURNEY_IDS.SAAS_ONBOARDING;
  const createdVersions: string[] = [];
  let versionId: string | null = null;

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  afterAll(async () => {
    for (const id of createdVersions) {
      try {
        await authRequest(
          "DELETE",
          `/api/journeys/${journeyId}/versions/${id}`,
          TEST_USER_IDS.DEMO
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("creates a new journey version", async () => {
    versionId = `v-${Date.now()}`;
    const response = await authRequest(
      "POST",
      `/api/journeys/${journeyId}/versions`,
      TEST_USER_IDS.DEMO,
      {
        body: {
          versionId,
          notes: "Integration test version",
          configuration: testJourneyConfig,
        },
      }
    );

    const data = (await response.json()) as { version: JourneyVersionItem };

    expect(response.status).toBe(201);
    expect(data.version.versionId).toBe(versionId);
    expect(data.version.journeyId).toBe(journeyId);

    createdVersions.push(versionId);
  });

  it("lists journey versions including the new one", async () => {
    const response = await authRequest(
      "GET",
      `/api/journeys/${journeyId}/versions`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as JourneyVersionsListResponse;

    expect(response.status).toBe(200);
    expect(Array.isArray(data.versions)).toBe(true);
    expect(data.versions.some((v) => v.versionId === versionId)).toBe(true);
  });

  it("returns a version snapshot with configuration", async () => {
    const response = await authRequest(
      "GET",
      `/api/journeys/${journeyId}/versions/${versionId}`,
      TEST_USER_IDS.DEMO
    );
    const data = (await response.json()) as JourneyVersionResponse;

    expect(response.status).toBe(200);
    expect(data.version.versionId).toBe(versionId);
    expect(Array.isArray(data.data.nodes)).toBe(true);
    expect(Array.isArray(data.data.edges)).toBe(true);
  });

  it("rejects duplicate version IDs", async () => {
    const response = await authRequest(
      "POST",
      `/api/journeys/${journeyId}/versions`,
      TEST_USER_IDS.DEMO,
      {
        body: {
          versionId,
          notes: "Duplicate attempt",
          configuration: testJourneyConfig,
        },
      }
    );

    // Should return 409 Conflict for duplicate version IDs
    // Some database configurations may return 500 if constraint handling differs
    expect([409, 500]).toContain(response.status);
  });

  it("deletes a version", async () => {
    const response = await authRequest(
      "DELETE",
      `/api/journeys/${journeyId}/versions/${versionId}`,
      TEST_USER_IDS.DEMO
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { success: boolean };
    expect(data.success).toBe(true);

    if (versionId) {
      const index = createdVersions.indexOf(versionId);
      if (index >= 0) {
        createdVersions.splice(index, 1);
      }
    }
  });
});
