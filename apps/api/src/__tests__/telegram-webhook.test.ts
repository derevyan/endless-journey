/**
 * Telegram Webhook Integration Tests
 *
 * Tests for the /webhook/telegram endpoint using real HTTP requests.
 * Requires API server running on localhost:3001
 *
 * Run with: pnpm test:webhook
 */

import { describe, expect, it, beforeAll } from "vitest";
import { API_BASE_URL, request, checkServerHealth } from "./helpers/test-app";

describe("Webhook - Telegram", () => {
  // Use valid UUID format for botId (even if bot doesn't exist)
  const testBotId = "00000000-0000-0000-0000-000000000099";
  const nonExistentBotId = "ffffffff-ffff-ffff-ffff-ffffffffffff";

  beforeAll(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error(
        `API server is not running at ${API_BASE_URL}. Start it with: pnpm --filter @journey/api dev`
      );
    }
  });

  // Sample Telegram update payloads
  const createTextMessageUpdate = (chatId: number, text: string) => ({
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      from: {
        id: chatId,
        is_bot: false,
        first_name: "Test",
        username: "testuser",
      },
      chat: {
        id: chatId,
        type: "private",
        first_name: "Test",
        username: "testuser",
      },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  });

  const createCallbackQueryUpdate = (chatId: number, callbackData: string) => ({
    update_id: Math.floor(Math.random() * 1000000),
    callback_query: {
      id: "test-callback-id",
      from: {
        id: chatId,
        is_bot: false,
        first_name: "Test",
        username: "testuser",
      },
      message: {
        message_id: 1,
        chat: {
          id: chatId,
          type: "private",
        },
        date: Math.floor(Date.now() / 1000),
      },
      data: callbackData,
    },
  });

  const createStartCommandUpdate = (chatId: number) => ({
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      from: {
        id: chatId,
        is_bot: false,
        first_name: "Test",
        username: "testuser",
      },
      chat: {
        id: chatId,
        type: "private",
        first_name: "Test",
        username: "testuser",
      },
      date: Math.floor(Date.now() / 1000),
      text: "/start",
      entities: [
        {
          offset: 0,
          length: 6,
          type: "bot_command",
        },
      ],
    },
  });

  describe("POST /webhook/telegram/:botId", () => {
    it("should accept POST requests (not 405)", async () => {
      const response = await request("POST", `/webhook/telegram/${testBotId}`, {
        body: createTextMessageUpdate(12345, "Hello"),
      });

      // Should not be 405 Method Not Allowed
      expect(response.status).not.toBe(405);
    });

    it("should return 404 for non-existent bot", async () => {
      const response = await request("POST", `/webhook/telegram/${nonExistentBotId}`, {
        body: createTextMessageUpdate(12345, "Hello bot"),
      });

      // Non-existent bot should return 404
      expect(response.status).toBe(404);
    });

    it("should handle malformed JSON gracefully", async () => {
      const response = await fetch(`${API_BASE_URL}/webhook/telegram/${testBotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      // Should return an error status (400 bad request, 404 bot not found, or 500 server error)
      expect([400, 404, 500]).toContain(response.status);
    });

    it("should handle empty body gracefully", async () => {
      const response = await request("POST", `/webhook/telegram/${testBotId}`, {
        body: {},
      });

      // Should handle gracefully - either 200 (no-op), 400 (bad request), or 404 (bot not found)
      expect([200, 400, 404]).toContain(response.status);
    });

    it("should require valid UUID format for botId", async () => {
      const invalidBotId = "not-a-uuid";
      const response = await request("POST", `/webhook/telegram/${invalidBotId}`, {
        body: createTextMessageUpdate(12345, "test"),
      });

      // Invalid UUID should cause error (400 or 500)
      expect([400, 500]).toContain(response.status);
    });
  });

  describe("Webhook Payload Parsing", () => {
    it("should handle webhook response for non-existent bot on photo update", async () => {
      const updateWithPhoto = {
        update_id: 123456,
        message: {
          message_id: 1,
          from: { id: 12345, is_bot: false, first_name: "Test" },
          chat: { id: 12345, type: "private" },
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: "small", width: 100, height: 100 }],
        },
      };

      const response = await request("POST", `/webhook/telegram/${nonExistentBotId}`, {
        body: updateWithPhoto,
      });

      // Non-existent bot should return 404
      expect(response.status).toBe(404);
    });
  });
});
