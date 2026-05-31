/**
 * CRM Messages API Integration Tests
 *
 * Tests for the /api/crm/clients/:clientId/messages endpoints using real HTTP requests.
 * Requires API server running on localhost:3001
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  authRequest,
  checkServerHealth,
  request,
  TEST_USER_IDS,
} from "./helpers/test-app";

interface ClientsListResponse {
  clients: Array<{ id: string }>;
  total: number;
}

interface MessagesListResponse {
  messages: unknown[];
}

const MISSING_CLIENT_ID = "00000000-0000-0000-0000-000000000999";

function randomChannelId(): string {
  return "00000000-0000-0000-0000-000000000111";
}

describe("CRM Messages API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(`API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`);
    }
  });

  it("should return 401 without authentication", async () => {
    const response = await request("GET", `/api/crm/clients/${MISSING_CLIENT_ID}/messages`);
    expect(response.status).toBe(401);
  });

  it("should return 404 for missing client history", async () => {
    const response = await authRequest("GET", `/api/crm/clients/${MISSING_CLIENT_ID}/messages`, TEST_USER_IDS.DEMO);
    expect(response.status).toBe(404);
  });

  it("should return 404 when sending to a missing client", async () => {
    const response = await authRequest("POST", `/api/crm/clients/${MISSING_CLIENT_ID}/messages`, TEST_USER_IDS.DEMO, {
      body: {
        channelId: randomChannelId(),
        content: "Hello from tests",
      },
    });

    expect(response.status).toBe(404);
  });

  it("should list message history for an existing client", async () => {
    const clientsResponse = await authRequest("GET", "/api/crm/clients?limit=1&offset=0", TEST_USER_IDS.DEMO);
    const clientsData = (await clientsResponse.json()) as ClientsListResponse;

    if (!clientsData.clients || clientsData.clients.length === 0) {
      return; // Skip - no clients available in test database
    }

    const clientId = clientsData.clients[0].id;

    const response = await authRequest("GET", `/api/crm/clients/${clientId}/messages`, TEST_USER_IDS.DEMO);
    const data = (await response.json()) as MessagesListResponse;

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("messages");
    expect(Array.isArray(data.messages)).toBe(true);
  });
});
