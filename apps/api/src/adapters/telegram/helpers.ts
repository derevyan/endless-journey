/**
 * Telegram Helpers
 *
 * Utility functions for Telegram adapter.
 *
 * @module adapters/telegram/helpers
 */

import type { TelegramUpdate, TelegramInlineKeyboardMarkup, ParsedUpdate } from "./types";

/**
 * Parse a Telegram update and extract user info
 */
export function parseUpdate(update: TelegramUpdate): ParsedUpdate | null {
  if (update.callback_query) {
    const cq = update.callback_query;
    return {
      chatId: cq.message?.chat.id ?? cq.from.id,
      userId: cq.from.id,
      firstName: cq.from.first_name,
      lastName: cq.from.last_name,
      username: cq.from.username,
      text: cq.data,
      isCallbackQuery: true,
    };
  }

  if (update.message) {
    const msg = update.message;
    return {
      chatId: msg.chat.id,
      userId: msg.from?.id ?? msg.chat.id,
      firstName: msg.from?.first_name ?? "Unknown",
      lastName: msg.from?.last_name,
      username: msg.from?.username,
      text: msg.text,
      isCallbackQuery: false,
    };
  }

  return null;
}

/**
 * Check if URL is a local/internal URL that Telegram can't access
 */
export function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.startsWith("192.168.") ||
      parsed.hostname.startsWith("10.") ||
      parsed.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Extract numeric chat ID from userId string
 * userId format: "telegram_12345" -> "12345"
 */
export function extractChatId(userId: string): string {
  if (userId.startsWith("telegram_")) {
    return userId.replace("telegram_", "");
  }
  return userId;
}

/**
 * Build inline keyboard markup from button array
 */
export function buildInlineKeyboard(buttons: Array<{ id: string; label: string }>): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: buttons.map((btn) => [{ text: btn.label, callback_data: btn.id }]),
  };
}

/**
 * Truncate caption to Telegram's limit (1024 characters)
 */
export function truncateCaption(caption: string, limit = 1024): string {
  if (caption.length <= limit) return caption;
  return caption.slice(0, limit - 3) + "...";
}
