/**
 * Telegram API Client Tests
 *
 * Unit tests for Telegram Bot API operations with mocked fetch.
 *
 * @module adapters/telegram/__tests__/api-client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTextMessage, sendPhoto, sendVideo, answerCallbackQuery, setWebhook, deleteWebhook } from "../api-client";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("telegram/api-client", () => {
  const TEST_BOT_TOKEN = "123456:ABC-DEF";
  const TEST_CHAT_ID = "987654321";

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sendTextMessage", () => {
    it("sends text message successfully", async () => {
      const mockMessage = {
        message_id: 123,
        chat: { id: parseInt(TEST_CHAT_ID), type: "private" },
        date: Date.now(),
        text: "Hello!",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: mockMessage }),
      });

      const result = await sendTextMessage(TEST_BOT_TOKEN, TEST_CHAT_ID, "Hello!");

      expect(result.message_id).toBe(123);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TEST_BOT_TOKEN}/sendMessage`,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );

      // Verify body
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.chat_id).toBe(TEST_CHAT_ID);
      expect(callBody.text).toBe("Hello!");
      expect(callBody.parse_mode).toBe("HTML");
    });

    it("sends text message with inline keyboard", async () => {
      const mockMessage = { message_id: 124, chat: { id: 123, type: "private" }, date: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: mockMessage }),
      });

      const keyboard = {
        inline_keyboard: [[{ text: "Click me", callback_data: "btn1" }]],
      };

      await sendTextMessage(TEST_BOT_TOKEN, TEST_CHAT_ID, "Choose:", keyboard);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.reply_markup).toEqual(keyboard);
    });

    it("throws error on Telegram API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, description: "Bad Request: chat not found" }),
      });

      await expect(sendTextMessage(TEST_BOT_TOKEN, "invalid-chat", "Hello!")).rejects.toThrow(
        "Telegram API error: Bad Request: chat not found"
      );
    });

    it("throws ServiceUnavailableError on HTTP 503 (retryable)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ ok: false, description: "Service Unavailable" }),
      });

      await expect(sendTextMessage(TEST_BOT_TOKEN, TEST_CHAT_ID, "Hello!")).rejects.toThrow(
        "Telegram API error: HTTP 503"
      );
    });

    it("throws ServiceUnavailableError on HTTP 500 (retryable)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ ok: false, description: "Internal Server Error" }),
      });

      await expect(sendTextMessage(TEST_BOT_TOKEN, TEST_CHAT_ID, "Hello!")).rejects.toThrow(
        "Telegram API error: HTTP 500"
      );
    });

    it("throws ServiceUnavailableError on HTTP 429 rate limit (retryable)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ ok: false, description: "Too Many Requests" }),
      });

      await expect(sendTextMessage(TEST_BOT_TOKEN, TEST_CHAT_ID, "Hello!")).rejects.toThrow(
        "Telegram API error: HTTP 429"
      );
    });
  });

  describe("sendPhoto", () => {
    it("sends photo by URL", async () => {
      const mockMessage = { message_id: 125, chat: { id: 123, type: "private" }, date: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: mockMessage }),
      });

      const result = await sendPhoto(
        TEST_BOT_TOKEN,
        TEST_CHAT_ID,
        "https://example.com/photo.jpg",
        "Nice photo!"
      );

      expect(result.message_id).toBe(125);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TEST_BOT_TOKEN}/sendPhoto`,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.photo).toBe("https://example.com/photo.jpg");
      expect(callBody.caption).toBe("Nice photo!");
    });

    it("sends photo as blob upload", async () => {
      const mockMessage = { message_id: 126, chat: { id: 123, type: "private" }, date: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: mockMessage }),
      });

      const blob = new Blob(["fake image data"], { type: "image/jpeg" });
      const result = await sendPhoto(TEST_BOT_TOKEN, TEST_CHAT_ID, blob, "Uploaded photo", "test.jpg");

      expect(result.message_id).toBe(126);

      // Should use FormData for blob upload
      const callOptions = mockFetch.mock.calls[0][1];
      expect(callOptions.body).toBeInstanceOf(FormData);
    });

    it("throws error on Telegram API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, description: "Bad Request: wrong file identifier" }),
      });

      await expect(sendPhoto(TEST_BOT_TOKEN, TEST_CHAT_ID, "invalid-url")).rejects.toThrow(
        "Telegram API error: Bad Request: wrong file identifier"
      );
    });

    it("throws ServiceUnavailableError on HTTP 503 (retryable)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ ok: false, description: "Service Unavailable" }),
      });

      await expect(sendPhoto(TEST_BOT_TOKEN, TEST_CHAT_ID, "https://example.com/photo.jpg")).rejects.toThrow(
        "Telegram API error: HTTP 503"
      );
    });
  });

  describe("sendVideo", () => {
    it("sends video by URL", async () => {
      const mockMessage = { message_id: 127, chat: { id: 123, type: "private" }, date: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: mockMessage }),
      });

      const result = await sendVideo(
        TEST_BOT_TOKEN,
        TEST_CHAT_ID,
        "https://example.com/video.mp4",
        "Check this out!"
      );

      expect(result.message_id).toBe(127);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.video).toBe("https://example.com/video.mp4");
      expect(callBody.caption).toBe("Check this out!");
      expect(callBody.supports_streaming).toBe(true);
    });

    it("sends video as blob upload", async () => {
      const mockMessage = { message_id: 128, chat: { id: 123, type: "private" }, date: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: mockMessage }),
      });

      const blob = new Blob(["fake video data"], { type: "video/mp4" });
      const result = await sendVideo(TEST_BOT_TOKEN, TEST_CHAT_ID, blob, "Uploaded video", "test.mp4");

      expect(result.message_id).toBe(128);

      const callOptions = mockFetch.mock.calls[0][1];
      expect(callOptions.body).toBeInstanceOf(FormData);
    });
  });

  describe("answerCallbackQuery", () => {
    it("answers callback query successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: true }),
      });

      // Should not throw
      await answerCallbackQuery(TEST_BOT_TOKEN, "callback-123");

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TEST_BOT_TOKEN}/answerCallbackQuery`,
        expect.objectContaining({
          method: "POST",
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.callback_query_id).toBe("callback-123");
    });

    it("handles API failure gracefully (no throw)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, description: "Query is too old" }),
      });

      // Should not throw, just log warning
      await expect(answerCallbackQuery(TEST_BOT_TOKEN, "old-callback")).resolves.toBeUndefined();
    });

    it("handles network error gracefully (no throw)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw, just log error
      await expect(answerCallbackQuery(TEST_BOT_TOKEN, "callback-123")).resolves.toBeUndefined();
    });
  });

  describe("setWebhook", () => {
    it("sets webhook successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: true }),
      });

      const result = await setWebhook(TEST_BOT_TOKEN, "https://myapp.com/webhook");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TEST_BOT_TOKEN}/setWebhook`,
        expect.objectContaining({
          method: "POST",
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.url).toBe("https://myapp.com/webhook");
    });

    it("sets webhook with secret token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: true }),
      });

      const result = await setWebhook(TEST_BOT_TOKEN, "https://myapp.com/webhook", "secret123");

      expect(result).toBe(true);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.url).toBe("https://myapp.com/webhook");
      expect(callBody.secret_token).toBe("secret123");
    });

    it("returns false on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, description: "Invalid URL" }),
      });

      const result = await setWebhook(TEST_BOT_TOKEN, "invalid-url");

      expect(result).toBe(false);
    });

    it("returns false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await setWebhook(TEST_BOT_TOKEN, "https://myapp.com/webhook");

      expect(result).toBe(false);
    });
  });

  describe("deleteWebhook", () => {
    it("deletes webhook successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: true }),
      });

      const result = await deleteWebhook(TEST_BOT_TOKEN);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TEST_BOT_TOKEN}/deleteWebhook`,
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("returns false on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, description: "Error" }),
      });

      const result = await deleteWebhook(TEST_BOT_TOKEN);

      expect(result).toBe(false);
    });

    it("returns false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await deleteWebhook(TEST_BOT_TOKEN);

      expect(result).toBe(false);
    });
  });
});
