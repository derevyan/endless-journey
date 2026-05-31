/**
 * Telegram Adapter Module
 *
 * Unified export for Telegram Bot API integration.
 *
 * @module adapters/telegram
 */

// Main adapter class
export { TelegramAdapter } from "./adapter";

// API client functions
export { setWebhook, deleteWebhook } from "./api-client";

// File cache service
export { getCachedFileId, saveFileIdToCache, clearChannelCache, clearMediaCache } from "./file-cache-service";

// Helper functions
export { parseUpdate, extractChatId, isLocalUrl, buildInlineKeyboard, truncateCaption } from "./helpers";

// Types
export type {
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramUser,
  TelegramChat,
  TelegramPhotoSize,
  TelegramVideo,
  TelegramApiResponse,
  TelegramInlineKeyboardButton,
  TelegramInlineKeyboardMarkup,
  ParsedUpdate,
} from "./types";
