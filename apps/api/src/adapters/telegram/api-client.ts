/**
 * Telegram API Client
 *
 * Low-level Telegram Bot API operations.
 *
 * @module adapters/telegram/api-client
 */

import { createLogger, serializeError } from "@journey/logger";
import { ServiceUnavailableError } from "@journey/schemas";
import type { TelegramApiResponse, TelegramMessage, TelegramInlineKeyboardMarkup } from "./types";
import {
  fetchWithTimeout,
  isRetryableStatus,
  MEDIA_TIMEOUT_MS,
  MEDIA_FETCH_TIMEOUT_MS,
} from "./fetch-utils";

const log = createLogger("telegram-api");

const DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org/bot";

function resolveTelegramApiBase(): string {
  const raw = process.env.TELEGRAM_API_BASE || DEFAULT_TELEGRAM_API_BASE;
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.endsWith("/bot") ? trimmed : `${trimmed}/bot`;
}

/**
 * Send a text message via Telegram API
 */
export async function sendTextMessage(
  botToken: string,
  chatId: string,
  text: string,
  keyboard?: TelegramInlineKeyboardMarkup
): Promise<TelegramMessage> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };

  if (keyboard) {
    body.reply_markup = keyboard;
  }

  const apiBase = resolveTelegramApiBase();
  const response = await fetchWithTimeout(`${apiBase}${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Check HTTP status first - throw for retryable errors (5xx, 429)
  if (!response.ok && isRetryableStatus(response.status)) {
    log.warn({ chatId, httpStatus: response.status }, "telegram:sendTextMessage:retryableError");
    throw new ServiceUnavailableError(`Telegram API error: HTTP ${response.status}`);
  }

  const result = (await response.json()) as TelegramApiResponse;

  if (!result.ok) {
    log.error({ chatId, error: result.description }, "telegram:sendTextMessage:failed");
    throw new ServiceUnavailableError(`Telegram API error: ${result.description}`);
  }

  return result.result as TelegramMessage;
}

/**
 * Send a photo via Telegram API
 */
export async function sendPhoto(
  botToken: string,
  chatId: string,
  photo: string | Blob,
  caption?: string,
  filename?: string
): Promise<TelegramMessage> {
  let response: Response;

  if (typeof photo === "string") {
    // URL-based photo
    const body: Record<string, unknown> = {
      chat_id: chatId,
      photo,
      parse_mode: "HTML",
    };
    if (caption) {
      body.caption = caption;
    }

    const apiBase = resolveTelegramApiBase();
    response = await fetchWithTimeout(`${apiBase}${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else {
    // Blob upload - use extended timeout for media
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("photo", photo, filename || "photo.jpg");
    formData.append("parse_mode", "HTML");
    if (caption) {
      formData.append("caption", caption);
    }

    const apiBase = resolveTelegramApiBase();
    response = await fetchWithTimeout(
      `${apiBase}${botToken}/sendPhoto`,
      { method: "POST", body: formData },
      MEDIA_TIMEOUT_MS
    );
  }

  // Check HTTP status first - throw for retryable errors (5xx, 429)
  if (!response.ok && isRetryableStatus(response.status)) {
    log.warn({ chatId, httpStatus: response.status }, "telegram:sendPhoto:retryableError");
    throw new ServiceUnavailableError(`Telegram API error: HTTP ${response.status}`);
  }

  const result = (await response.json()) as TelegramApiResponse;

  if (!result.ok) {
    log.error({ chatId, error: result.description }, "telegram:sendPhoto:failed");
    throw new ServiceUnavailableError(`Telegram API error: ${result.description}`);
  }

  return result.result as TelegramMessage;
}

/**
 * Send a video via Telegram API
 */
export async function sendVideo(
  botToken: string,
  chatId: string,
  video: string | Blob,
  caption?: string,
  filename?: string
): Promise<TelegramMessage> {
  let response: Response;

  if (typeof video === "string") {
    // URL-based video
    const body: Record<string, unknown> = {
      chat_id: chatId,
      video,
      parse_mode: "HTML",
      supports_streaming: true,
    };
    if (caption) {
      body.caption = caption;
    }

    const apiBase = resolveTelegramApiBase();
    response = await fetchWithTimeout(`${apiBase}${botToken}/sendVideo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else {
    // Blob upload - use extended timeout for media
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("video", video, filename || "video.mp4");
    formData.append("parse_mode", "HTML");
    formData.append("supports_streaming", "true");
    if (caption) {
      formData.append("caption", caption);
    }

    const apiBase = resolveTelegramApiBase();
    response = await fetchWithTimeout(
      `${apiBase}${botToken}/sendVideo`,
      { method: "POST", body: formData },
      MEDIA_TIMEOUT_MS
    );
  }

  // Check HTTP status first - throw for retryable errors (5xx, 429)
  if (!response.ok && isRetryableStatus(response.status)) {
    log.warn({ chatId, httpStatus: response.status }, "telegram:sendVideo:retryableError");
    throw new ServiceUnavailableError(`Telegram API error: HTTP ${response.status}`);
  }

  const result = (await response.json()) as TelegramApiResponse;

  if (!result.ok) {
    log.error({ chatId, error: result.description }, "telegram:sendVideo:failed");
    throw new ServiceUnavailableError(`Telegram API error: ${result.description}`);
  }

  return result.result as TelegramMessage;
}

/**
 * Send a voice message via Telegram API
 * Supports OGG/Opus (preferred) and MP3 formats
 * @see https://core.telegram.org/bots/api#sendvoice
 */
export async function sendVoice(
  botToken: string,
  chatId: string,
  voice: Buffer | Blob,
  options?: { caption?: string; duration?: number }
): Promise<TelegramMessage> {
  const formData = new FormData();
  formData.append("chat_id", chatId);

  // Detect format from magic bytes and set appropriate MIME type
  let mimeType = "audio/ogg";
  let filename = "voice.ogg";

  if (voice instanceof Buffer || voice instanceof Uint8Array) {
    const header = voice.slice(0, 4);
    // MP3 magic bytes: 0xFF 0xFB or "ID3"
    if ((header[0] === 0xff && (header[1] & 0xe0) === 0xe0) || header.toString().startsWith("ID3")) {
      mimeType = "audio/mpeg";
      filename = "voice.mp3";
    }
  }

  // Convert Buffer to Blob if needed
  const voiceBlob = voice instanceof Blob ? voice : new Blob([voice], { type: mimeType });
  formData.append("voice", voiceBlob, filename);

  log.debug({ chatId, mimeType, filename, size: voice instanceof Blob ? voice.size : voice.length }, "telegram:sendVoice:preparing");

  if (options?.caption) {
    formData.append("caption", options.caption);
    formData.append("parse_mode", "HTML");
  }
  if (options?.duration) {
    formData.append("duration", String(options.duration));
  }

  const apiBase = resolveTelegramApiBase();
  const response = await fetchWithTimeout(
    `${apiBase}${botToken}/sendVoice`,
    { method: "POST", body: formData },
    MEDIA_TIMEOUT_MS
  );

  // Check HTTP status first - throw for retryable errors (5xx, 429)
  if (!response.ok && isRetryableStatus(response.status)) {
    log.warn({ chatId, httpStatus: response.status }, "telegram:sendVoice:retryableError");
    throw new ServiceUnavailableError(`Telegram API error: HTTP ${response.status}`);
  }

  const result = (await response.json()) as TelegramApiResponse;

  if (!result.ok) {
    log.error({ chatId, error: result.description }, "telegram:sendVoice:failed");
    throw new ServiceUnavailableError(`Telegram API error: ${result.description}`);
  }

  log.debug({ chatId }, "telegram:sendVoice:success");
  return result.result as TelegramMessage;
}

/**
 * Send chat action (typing indicator, etc.)
 * Telegram's typing indicator auto-expires after ~5 seconds.
 * For long operations, call this every 4 seconds to keep indicator visible.
 * @see https://core.telegram.org/bots/api#sendchataction
 */
export async function sendChatAction(
  botToken: string,
  chatId: string,
  action: "typing" | "upload_photo" | "record_audio" | "upload_audio" | "upload_document" | "find_location" | "record_video_note" | "upload_video_note" = "typing"
): Promise<void> {
  const apiBase = resolveTelegramApiBase();
  const response = await fetchWithTimeout(`${apiBase}${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });

  if (!response.ok) {
    log.warn({ chatId, action, httpStatus: response.status }, "telegram:sendChatAction:failed");
    throw new ServiceUnavailableError(`Telegram sendChatAction failed: HTTP ${response.status}`);
  }

  log.debug({ chatId, action }, "telegram:sendChatAction:success");
}

/**
 * Answer a callback query (removes loading indicator on button)
 */
export async function answerCallbackQuery(botToken: string, callbackQueryId: string): Promise<void> {
  try {
    const apiBase = resolveTelegramApiBase();
    const response = await fetchWithTimeout(`${apiBase}${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });

    const result = (await response.json()) as TelegramApiResponse;

    if (!result.ok) {
      log.warn({ callbackQueryId, error: result.description }, "telegram:answerCallbackQuery:failed");
    }
  } catch (error) {
    // Intentionally swallow errors - UX optimization to not block on callback acknowledgment
    log.error({ callbackQueryId, err: serializeError(error) }, "telegram:answerCallbackQuery:error");
  }
}

/**
 * Set webhook for a Telegram bot
 */
export async function setWebhook(botToken: string, webhookUrl: string, secretToken?: string): Promise<boolean> {
  try {
    const body: Record<string, string> = { url: webhookUrl };
    if (secretToken) {
      body.secret_token = secretToken;
    }

    const apiBase = resolveTelegramApiBase();
    const response = await fetchWithTimeout(`${apiBase}${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as TelegramApiResponse;
    log.info({ webhookUrl, ok: result.ok, hasSecret: !!secretToken }, "telegram:setWebhook");
    return result.ok;
  } catch (error) {
    log.error({ webhookUrl, err: serializeError(error) }, "telegram:setWebhook:error");
    return false;
  }
}

/**
 * Delete webhook for a Telegram bot
 */
export async function deleteWebhook(botToken: string): Promise<boolean> {
  try {
    const apiBase = resolveTelegramApiBase();
    const response = await fetchWithTimeout(`${apiBase}${botToken}/deleteWebhook`, {
      method: "POST",
    });

    const result = (await response.json()) as TelegramApiResponse;
    log.info({ ok: result.ok }, "telegram:deleteWebhook");
    return result.ok;
  } catch (error) {
    log.error({ err: serializeError(error) }, "telegram:deleteWebhook:error");
    return false;
  }
}

// ============================================================================
// File Operations (for voice messages)
// ============================================================================

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface TelegramGetFileResponse {
  ok: boolean;
  result?: TelegramFile;
  description?: string;
}

/**
 * Get file path from Telegram servers
 * Use this to get the download path for voice messages and other files
 * @see https://core.telegram.org/bots/api#getfile
 */
export async function getFile(botToken: string, fileId: string): Promise<string> {
  const apiBase = resolveTelegramApiBase();
  const response = await fetchWithTimeout(`${apiBase}${botToken}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });

  // Check HTTP status first - throw for retryable errors (5xx, 429)
  if (!response.ok && isRetryableStatus(response.status)) {
    log.warn({ fileId, httpStatus: response.status }, "telegram:getFile:retryableError");
    throw new ServiceUnavailableError(`Telegram API error: HTTP ${response.status}`);
  }

  const result = (await response.json()) as TelegramGetFileResponse;

  if (!result.ok || !result.result?.file_path) {
    log.error({ fileId, error: result.description }, "telegram:getFile:failed");
    throw new ServiceUnavailableError(`Telegram API error: ${result.description ?? "No file path returned"}`);
  }

  log.debug({ fileId, filePath: result.result.file_path }, "telegram:getFile:success");
  return result.result.file_path;
}

/**
 * Download file content from Telegram servers
 * @param botToken - Bot token
 * @param filePath - File path returned by getFile()
 * @returns File content as Buffer
 */
export async function downloadFile(botToken: string, filePath: string): Promise<Buffer> {
  // Telegram file download URL format: https://api.telegram.org/file/bot<token>/<file_path>
  const baseUrl = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
  const downloadUrl = `${baseUrl}/file/bot${botToken}/${filePath}`;

  const response = await fetchWithTimeout(downloadUrl, {}, MEDIA_FETCH_TIMEOUT_MS);

  // Check HTTP status - throw for retryable errors (5xx, 429)
  if (!response.ok) {
    if (isRetryableStatus(response.status)) {
      log.warn({ filePath, httpStatus: response.status }, "telegram:downloadFile:retryableError");
      throw new ServiceUnavailableError(`Telegram API error: HTTP ${response.status}`);
    }
    log.error({ filePath, status: response.status }, "telegram:downloadFile:failed");
    throw new ServiceUnavailableError(`Failed to download file: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  log.debug({ filePath, size: buffer.length }, "telegram:downloadFile:success");
  return buffer;
}
