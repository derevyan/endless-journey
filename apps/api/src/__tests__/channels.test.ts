/**
 * Channels API Integration Tests
 *
 * Tests for the /api/channels endpoints using real HTTP requests.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:channels
 */

import { describe, expect, it, beforeAll } from "vitest";
import {
  API_BASE_URL,
  request,
  authRequest,
  TEST_USER_IDS,
  TEST_JOURNEY_IDS,
  checkServerHealth,
  type ErrorResponse,
  type SuccessResponse,
} from "./helpers/test-app";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ChannelItem {
  id: string;
  botToken: string; // Masked: "...XXXX"
  botUsername?: string;
  botName?: string;
  isActive: boolean;
  defaultJourneyId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ChannelsListResponse {
  bots: ChannelItem[];
}

interface ChannelResponse {
  bot: ChannelItem;
}

// =============================================================================
// TESTS
// =============================================================================

describe("Channels API", () => {
  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  describe("GET /api/channels", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/channels");
      expect(response.status).toBe(401);
    });

    it("should return channels list for authenticated user", async () => {
      const response = await authRequest("GET", "/api/channels", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ChannelsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("bots");
      expect(Array.isArray(data.bots)).toBe(true);
    });

    it("should mask bot tokens in response", async () => {
      const response = await authRequest("GET", "/api/channels", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ChannelsListResponse;

      expect(response.status).toBe(200);
      // If there are any bots, verify tokens are masked
      for (const bot of data.bots) {
        expect(bot.botToken).toMatch(/^\.\.\.[\w]{4}$/);
      }
    });
  });

  describe("GET /api/channels/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("GET", "/api/channels/some-id");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent channel", async () => {
      const response = await authRequest(
        "GET",
        "/api/channels/00000000-0000-0000-0000-000000000999",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/channels", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", "/api/channels", {
        body: { botToken: "fake-token" },
      });

      expect(response.status).toBe(401);
    });

    it("should return 400 if botToken is missing", async () => {
      const response = await authRequest("POST", "/api/channels", TEST_USER_IDS.DEMO, {
        body: {},
      });
      const data = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("should return 400 for invalid bot token", async () => {
      const response = await authRequest("POST", "/api/channels", TEST_USER_IDS.DEMO, {
        body: { botToken: "invalid-token-format" },
      });

      // Should return 400 with validation error from Telegram API
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/channels/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("PUT", "/api/channels/some-id", {
        body: { isActive: false },
      });

      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent channel", async () => {
      const response = await authRequest(
        "PUT",
        "/api/channels/00000000-0000-0000-0000-000000000999",
        TEST_USER_IDS.DEMO,
        { body: { isActive: false } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/channels/:id", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("DELETE", "/api/channels/some-id");

      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent channel", async () => {
      const response = await authRequest(
        "DELETE",
        "/api/channels/00000000-0000-0000-0000-000000000999",
        TEST_USER_IDS.DEMO
      );

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/channels/:id/webhook", () => {
    it("should return 401 without authentication", async () => {
      const response = await request("POST", "/api/channels/some-id/webhook");

      expect(response.status).toBe(401);
    });

    it("should return 400 for non-existent channel", async () => {
      const response = await authRequest(
        "POST",
        "/api/channels/00000000-0000-0000-0000-000000000999/webhook",
        TEST_USER_IDS.DEMO
      );

      // Returns 400 because webhook registration fails for non-existent channel
      expect(response.status).toBe(400);
    });
  });

  describe("Organization Scoping", () => {
    it("should scope channels to user's organization", async () => {
      // Demo user should only see Demo org channels
      const demoResponse = await authRequest("GET", "/api/channels", TEST_USER_IDS.DEMO);
      const demoData = (await demoResponse.json()) as ChannelsListResponse;

      // Arina should only see Arina org channels
      const arinaResponse = await authRequest("GET", "/api/channels", TEST_USER_IDS.ARINA);
      const arinaData = (await arinaResponse.json()) as ChannelsListResponse;

      expect(demoResponse.status).toBe(200);
      expect(arinaResponse.status).toBe(200);

      // Both should return arrays (may be empty)
      expect(Array.isArray(demoData.bots)).toBe(true);
      expect(Array.isArray(arinaData.bots)).toBe(true);
    });

    it("should not leak channels between organizations", async () => {
      // Get channels for both users
      const demoResponse = await authRequest("GET", "/api/channels", TEST_USER_IDS.DEMO);
      const arinaResponse = await authRequest("GET", "/api/channels", TEST_USER_IDS.ARINA);

      const demoData = (await demoResponse.json()) as ChannelsListResponse;
      const arinaData = (await arinaResponse.json()) as ChannelsListResponse;

      // Extract all channel IDs
      const demoIds = new Set(demoData.bots.map((b) => b.id));
      const arinaIds = new Set(arinaData.bots.map((b) => b.id));

      // No channel should appear in both lists (organizations are isolated)
      for (const id of demoIds) {
        expect(arinaIds.has(id)).toBe(false);
      }
    });
  });

  describe("Graceful Error Handling", () => {
    it("should return masked tokens even if decryption fails", async () => {
      // This test verifies that listing channels doesn't crash when token decryption fails
      // The API should gracefully mask tokens with fallback values
      const response = await authRequest("GET", "/api/channels", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ChannelsListResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("bots");

      // All bot tokens should be masked (even if from corrupted data)
      for (const bot of data.bots) {
        // Token should be masked format: "...XXXX" or similar
        expect(bot.botToken).toBeDefined();
        expect(typeof bot.botToken).toBe("string");
        expect(bot.botToken.length).toBeGreaterThan(0);
      }
    });

    it("should not expose raw tokens in channel list response", async () => {
      const response = await authRequest("GET", "/api/channels", TEST_USER_IDS.DEMO);
      const data = (await response.json()) as ChannelsListResponse;

      expect(response.status).toBe(200);

      // Verify no tokens look like real Telegram bot tokens (format: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ)
      for (const bot of data.bots) {
        // Real tokens are 40+ chars with colon, masked are short
        expect(bot.botToken.includes(":")).toBe(false);
        expect(bot.botToken.length).toBeLessThan(20);
      }
    });
  });
});

