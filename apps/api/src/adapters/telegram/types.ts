/**
 * Telegram Types
 *
 * Type definitions for Telegram Bot API structures.
 *
 * @module adapters/telegram/types
 */

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  voice?: TelegramVoice;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram voice message (voice note)
 * @see https://core.telegram.org/bots/api#voice
 */
export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number; // Duration in seconds
  mime_type?: string; // Usually "audio/ogg"
  file_size?: number;
}

export interface TelegramApiResponse {
  ok: boolean;
  result?: TelegramMessage | boolean;
  description?: string;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/**
 * Parsed update info from Telegram
 */
export interface ParsedUpdate {
  chatId: number;
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  text?: string;
  isCallbackQuery: boolean;
}
