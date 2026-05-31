/**
 * Telegram Helpers Tests
 *
 * Unit tests for pure utility functions in the Telegram adapter.
 *
 * @module adapters/telegram/__tests__/helpers
 */

import { describe, it, expect } from "vitest";
import { parseUpdate, isLocalUrl, extractChatId, buildInlineKeyboard, truncateCaption } from "../helpers";
import type { TelegramUpdate } from "../types";

describe("telegram/helpers", () => {
  describe("parseUpdate", () => {
    it("parses a regular message update", () => {
      const update: TelegramUpdate = {
        update_id: 123,
        message: {
          message_id: 456,
          chat: { id: 789, type: "private" },
          from: {
            id: 111,
            first_name: "John",
            last_name: "Doe",
            username: "johndoe",
          },
          date: Date.now(),
          text: "Hello, bot!",
        },
      };

      const result = parseUpdate(update);

      expect(result).not.toBeNull();
      expect(result?.chatId).toBe(789);
      expect(result?.userId).toBe(111);
      expect(result?.firstName).toBe("John");
      expect(result?.lastName).toBe("Doe");
      expect(result?.username).toBe("johndoe");
      expect(result?.text).toBe("Hello, bot!");
      expect(result?.isCallbackQuery).toBe(false);
    });

    it("parses a callback query update", () => {
      const update: TelegramUpdate = {
        update_id: 123,
        callback_query: {
          id: "callback-123",
          from: {
            id: 222,
            first_name: "Jane",
            username: "jane",
          },
          message: {
            message_id: 456,
            chat: { id: 333, type: "private" },
            date: Date.now(),
          },
          data: "button_clicked",
        },
      };

      const result = parseUpdate(update);

      expect(result).not.toBeNull();
      expect(result?.chatId).toBe(333);
      expect(result?.userId).toBe(222);
      expect(result?.firstName).toBe("Jane");
      expect(result?.text).toBe("button_clicked");
      expect(result?.isCallbackQuery).toBe(true);
    });

    it("uses from.id as chatId when message is missing in callback", () => {
      const update: TelegramUpdate = {
        update_id: 123,
        callback_query: {
          id: "callback-123",
          from: {
            id: 444,
            first_name: "User",
          },
          data: "action",
        },
      };

      const result = parseUpdate(update);

      expect(result).not.toBeNull();
      expect(result?.chatId).toBe(444);
      expect(result?.userId).toBe(444);
    });

    it("handles message without from field", () => {
      const update: TelegramUpdate = {
        update_id: 123,
        message: {
          message_id: 456,
          chat: { id: 555, type: "group" },
          date: Date.now(),
          text: "Anonymous message",
        },
      };

      const result = parseUpdate(update);

      expect(result).not.toBeNull();
      expect(result?.chatId).toBe(555);
      expect(result?.userId).toBe(555); // Falls back to chat.id
      expect(result?.firstName).toBe("Unknown");
    });

    it("returns null for empty update", () => {
      const update: TelegramUpdate = {
        update_id: 123,
      };

      const result = parseUpdate(update);

      expect(result).toBeNull();
    });
  });

  describe("isLocalUrl", () => {
    it("identifies localhost URLs", () => {
      expect(isLocalUrl("http://localhost:3000/image.jpg")).toBe(true);
      expect(isLocalUrl("https://localhost/file.pdf")).toBe(true);
    });

    it("identifies 127.0.0.1 URLs", () => {
      expect(isLocalUrl("http://127.0.0.1:8080/api/file")).toBe(true);
      expect(isLocalUrl("https://127.0.0.1/image.png")).toBe(true);
    });

    it("identifies private network URLs (192.168.x.x)", () => {
      expect(isLocalUrl("http://192.168.1.1/file.jpg")).toBe(true);
      expect(isLocalUrl("http://192.168.0.100:3000/upload")).toBe(true);
    });

    it("identifies private network URLs (10.x.x.x)", () => {
      expect(isLocalUrl("http://10.0.0.1/resource")).toBe(true);
      expect(isLocalUrl("http://10.255.255.255/file")).toBe(true);
    });

    it("identifies .local domain URLs", () => {
      expect(isLocalUrl("http://myserver.local/file.jpg")).toBe(true);
      expect(isLocalUrl("https://dev.local:3000/api")).toBe(true);
    });

    it("returns false for public URLs", () => {
      expect(isLocalUrl("https://example.com/image.jpg")).toBe(false);
      expect(isLocalUrl("https://cdn.telegram.org/file.jpg")).toBe(false);
      expect(isLocalUrl("http://api.service.com/resource")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(isLocalUrl("not-a-url")).toBe(false);
      expect(isLocalUrl("")).toBe(false);
    });
  });

  describe("extractChatId", () => {
    it("extracts chat ID from telegram_ prefixed string", () => {
      expect(extractChatId("telegram_12345")).toBe("12345");
      expect(extractChatId("telegram_987654321")).toBe("987654321");
    });

    it("returns original string if no prefix", () => {
      expect(extractChatId("12345")).toBe("12345");
      expect(extractChatId("user-abc")).toBe("user-abc");
    });

    it("handles empty string", () => {
      expect(extractChatId("")).toBe("");
    });

    it("handles telegram_ prefix with empty id", () => {
      expect(extractChatId("telegram_")).toBe("");
    });
  });

  describe("buildInlineKeyboard", () => {
    it("builds single button keyboard", () => {
      const buttons = [{ id: "btn1", label: "Click Me" }];

      const result = buildInlineKeyboard(buttons);

      expect(result.inline_keyboard).toHaveLength(1);
      expect(result.inline_keyboard[0]).toHaveLength(1);
      expect(result.inline_keyboard[0][0]).toEqual({
        text: "Click Me",
        callback_data: "btn1",
      });
    });

    it("builds multiple buttons as separate rows", () => {
      const buttons = [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
        { id: "maybe", label: "Maybe" },
      ];

      const result = buildInlineKeyboard(buttons);

      expect(result.inline_keyboard).toHaveLength(3);
      expect(result.inline_keyboard[0][0].text).toBe("Yes");
      expect(result.inline_keyboard[1][0].text).toBe("No");
      expect(result.inline_keyboard[2][0].text).toBe("Maybe");
    });

    it("handles empty button array", () => {
      const result = buildInlineKeyboard([]);

      expect(result.inline_keyboard).toHaveLength(0);
    });

    it("preserves button id as callback_data", () => {
      const buttons = [{ id: "action:confirm:123", label: "Confirm" }];

      const result = buildInlineKeyboard(buttons);

      expect(result.inline_keyboard[0][0].callback_data).toBe("action:confirm:123");
    });
  });

  describe("truncateCaption", () => {
    it("returns original caption if within limit", () => {
      const caption = "Short caption";

      expect(truncateCaption(caption)).toBe(caption);
    });

    it("truncates caption at 1024 characters by default", () => {
      const longCaption = "a".repeat(1500);

      const result = truncateCaption(longCaption);

      expect(result.length).toBe(1024);
      expect(result.endsWith("...")).toBe(true);
    });

    it("truncates at custom limit", () => {
      const caption = "This is a longer caption that needs truncation";

      const result = truncateCaption(caption, 20);

      expect(result.length).toBe(20);
      expect(result).toBe("This is a longer ...");
    });

    it("handles empty caption", () => {
      expect(truncateCaption("")).toBe("");
    });

    it("handles caption exactly at limit", () => {
      const caption = "a".repeat(1024);

      expect(truncateCaption(caption)).toBe(caption);
      expect(truncateCaption(caption).length).toBe(1024);
    });

    it("handles caption one character over limit", () => {
      const caption = "a".repeat(1025);

      const result = truncateCaption(caption);

      expect(result.length).toBe(1024);
      expect(result.endsWith("...")).toBe(true);
    });
  });
});
