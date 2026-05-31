/**
 * Telegram Adapter
 *
 * Implements the MessagingAdapter interface for Telegram Bot API.
 *
 * @module adapters/telegram/adapter
 */

import type { JourneyEvent, JourneyMessage, MessagingAdapter, SendMessageResult } from "@journey/engine";
import { generateSpeech, transcribeAudio } from "@journey/llm/server";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError } from "@journey/schemas";
import { getDefaultVoiceForProvider } from "@journey/schemas/config";
import { cancelTimer, createTimerJobData, getActiveTimerBySessionAndEdge, scheduleTimer, type TimerJobData } from "../../services/timers";

import * as telegramApi from "./api-client";
import { getCachedFileId, saveFileIdToCache } from "./file-cache-service";
import { buildInlineKeyboard, extractChatId, isLocalUrl, truncateCaption } from "./helpers";
import type { TelegramMessage, TelegramUpdate } from "./types";

/**
 * Interval for refreshing typing indicator (4 seconds).
 * Telegram's typing indicator expires after ~5 seconds.
 */
const TYPING_REFRESH_INTERVAL_MS = 4000;

export class TelegramAdapter implements MessagingAdapter {
  readonly adapterType = "telegram" as const;
  private botToken: string;
  private botId: string;
  private sessionId: string;
  private clientId: string;
  private organizationId: string;
  private journeyId: string;
  private messageHandler: ((event: JourneyEvent) => Promise<void>) | null = null;
  private log: ReturnType<typeof createLogger>;
  private timerMap: Map<string, string> = new Map(); // edgeId -> jobId
  private typingIntervals: Map<string, NodeJS.Timeout> = new Map(); // chatId -> interval

  constructor(botToken: string, botId: string, sessionId: string, clientId: string, organizationId: string, journeyId: string, logger = createLogger("telegram-adapter")) {
    this.botToken = botToken;
    this.botId = botId;
    this.sessionId = sessionId;
    this.clientId = clientId;
    this.organizationId = organizationId;
    this.journeyId = journeyId;
    this.log = logger.child({ adapterType: "telegram", botId, sessionId });
  }

  /**
   * Send a message to a Telegram user
   * Supports voice output when message.voice config is set
   */
  async sendMessage(userId: string, message: JourneyMessage): Promise<SendMessageResult> {
    const chatId = extractChatId(userId);
    const stripMedia = process.env.TELEGRAM_PARITY_STRIP_MEDIA === "true";
    const hasMedia = !stripMedia && message.media && message.media.url;
    const hasButtons = message.buttons && message.buttons.length > 0;
    const messageContent = stripMedia && message.media?.url && !message.content.trim() ? "[media omitted]" : message.content;
    const messageIds: SendMessageResult["messageIds"] = [];

    this.log.info(
      { chatId, type: message.type, buttons: message.buttons?.length ?? 0, hasMedia, hasVoice: !!message.voice },
      "telegram:sendMessage"
    );
    if (stripMedia && message.media?.url) {
      this.log.debug({ chatId, mediaUrl: message.media.url }, "telegram:sendMessage:stripMedia");
    }

    try {
      // Handle voice output (TTS) - only for text messages without media
      // Voice config is only set when voice output is needed (based on voice mode and user input type)
      if (message.voice && messageContent && !hasMedia) {
        // Determine provider (defaults to "openai" if not specified)
        const voiceProvider = message.voice.provider ?? "openai";

        // Use voice profile from message or provider's default
        const voiceProfile = message.voice.profile || getDefaultVoiceForProvider(voiceProvider);

        this.log.info({ chatId, contentLength: messageContent.length, voiceProfile, voiceProvider, elevenLabsModel: message.voice.elevenLabsModel }, "telegram:sendMessage:voiceMode");

        try {
          // Start typing indicator during TTS generation (can take 2-10 seconds)
          await this.startTypingIndicator(chatId);

          // Generate speech from text using the specified provider
          // OpenAI returns OGG/Opus (works with Telegram), ElevenLabs returns raw Opus (not OGG container)
          // Use MP3 for ElevenLabs as fallback since Telegram also accepts MP3 for voice messages
          const format = voiceProvider === "elevenlabs" ? "mp3" : "opus";
          const audioBuffer = await generateSpeech(messageContent, {
            voice: voiceProfile,
            provider: voiceProvider,
            format,
            model: message.voice.elevenLabsModel,
            organizationId: this.organizationId,
            journeySessionId: this.sessionId,
            journeyId: this.journeyId,
          });
          const voiceBuffer = Buffer.from(audioBuffer);

          // Stop typing before sending voice message (message arrival clears indicator)
          this.stopTypingIndicator(chatId);

          // Debug: Log audio format header to verify container type
          const header = voiceBuffer.subarray(0, 4);
          this.log.debug({
            provider: voiceProvider,
            format,
            headerHex: header.toString("hex"),
            headerAscii: header.toString("ascii"),
            audioSize: voiceBuffer.length,
          }, "telegram:sendMessage:voiceFormat");

          // Send voice message
          const voiceResult = await telegramApi.sendVoice(this.botToken, chatId, voiceBuffer, {
            caption: undefined, // Voice notes don't typically need captions
          });

          messageIds.push({
            platformMessageId: String(voiceResult.message_id),
            messageType: "text", // Using "text" type for compatibility with existing message type enum
          });

          // If there are buttons, send them as a separate message after the voice
          if (hasButtons) {
            const btnResult = await this.sendButtonsMessage(chatId, message.buttons!);
            messageIds.push({
              platformMessageId: String(btnResult.messageId),
              messageType: "buttons",
            });
          }

          return { success: true, messageIds };
        } catch (voiceError) {
          // Stop typing on error
          this.stopTypingIndicator(chatId);

          // Voice sending failed (e.g., VOICE_MESSAGES_FORBIDDEN) - fall back to text
          this.log.warn({ chatId, err: serializeError(voiceError), voiceProfile }, "telegram:sendMessage:voiceFallback");
          // Continue to standard text flow below
        }
      }

      // Standard text/media flow
      if (hasMedia && message.media) {
        // Send media with caption
        const mediaResult = await this.sendMediaWithCaption(chatId, message.media, message.content);
        messageIds.push({
          platformMessageId: String(mediaResult.messageId),
          messageType: mediaResult.messageType,
        });

        // If there are buttons, send them as a separate message
        if (hasButtons) {
          const btnResult = await this.sendButtonsMessage(chatId, message.buttons!);
          messageIds.push({
            platformMessageId: String(btnResult.messageId),
            messageType: "buttons",
          });
        }
      } else {
        // No media - send regular text message (with or without buttons)
        const keyboard = hasButtons ? buildInlineKeyboard(message.buttons!) : undefined;
        const result = await telegramApi.sendTextMessage(this.botToken, chatId, messageContent, keyboard);
        messageIds.push({
          platformMessageId: String(result.message_id),
          messageType: hasButtons ? "buttons" : "text",
        });
      }

      return { success: true, messageIds };
    } catch (error) {
      this.log.error({ chatId, err: serializeError(error) }, "telegram:sendMessage:error");
      return { success: false, messageIds, error: String(error) };
    }
  }

  /**
   * Send a message with only inline keyboard buttons
   */
  private async sendButtonsMessage(chatId: string, buttons: Array<{ id: string; label: string }>): Promise<{ messageId: number }> {
    const keyboard = buildInlineKeyboard(buttons);
    const result = await telegramApi.sendTextMessage(this.botToken, chatId, "👇", keyboard);
    return { messageId: result.message_id };
  }

  /**
   * Send media (photo/video) with caption
   * Uses file_id caching for efficient re-sending of previously uploaded media
   */
  private async sendMediaWithCaption(
    chatId: string,
    media: { type: "image" | "video"; url: string; mediaId?: string },
    caption: string
  ): Promise<{ messageId: number; messageType: "photo" | "video" }> {
    const truncatedCaption = truncateCaption(caption);
    const messageType = media.type === "image" ? "photo" : "video";

    // Check file cache if we have a mediaId
    if (media.mediaId) {
      const cached = await getCachedFileId(this.botId, media.mediaId);
      if (cached) {
        this.log.debug({ mediaId: media.mediaId, fileId: cached.fileId.slice(0, 20) + "..." }, "telegram:sendMedia:cacheHit");
        return this.sendMediaByFileId(chatId, cached.fileId, media.type, truncatedCaption);
      }
    }

    // For local URLs, fetch and upload
    if (isLocalUrl(media.url)) {
      return this.sendMediaAsUpload(chatId, media, truncatedCaption);
    }

    // For public URLs, send the URL directly
    if (media.type === "image") {
      const result = await telegramApi.sendPhoto(this.botToken, chatId, media.url, truncatedCaption);
      await this.cacheMediaResult(media, result);
      return { messageId: result.message_id, messageType };
    } else {
      const result = await telegramApi.sendVideo(this.botToken, chatId, media.url, truncatedCaption);
      await this.cacheMediaResult(media, result);
      return { messageId: result.message_id, messageType };
    }
  }

  /**
   * Send media using a cached file_id (instant, no upload needed)
   */
  private async sendMediaByFileId(
    chatId: string,
    fileId: string,
    type: "image" | "video",
    caption: string
  ): Promise<{ messageId: number; messageType: "photo" | "video" }> {
    const messageType = type === "image" ? "photo" : "video";

    if (type === "image") {
      const result = await telegramApi.sendPhoto(this.botToken, chatId, fileId, caption);
      return { messageId: result.message_id, messageType };
    } else {
      const result = await telegramApi.sendVideo(this.botToken, chatId, fileId, caption);
      return { messageId: result.message_id, messageType };
    }
  }

  /**
   * Cache a file_id after successful upload
   */
  private async cacheFileId(mediaId: string, mediaType: "image" | "video", fileId: string, fileUniqueId?: string): Promise<void> {
    try {
      await saveFileIdToCache({
        channelId: this.botId,
        mediaId,
        mediaType,
        fileId,
        fileUniqueId,
      });
    } catch (error) {
      this.log.warn({ mediaId, err: serializeError(error) }, "telegram:cacheFileId:failed");
    }
  }

  /**
   * Cache file_id from a Telegram API response (photo or video)
   * Extracts the appropriate file_id based on media type and stores it for future use
   */
  private async cacheMediaResult(media: { type: "image" | "video"; mediaId?: string }, result: TelegramMessage): Promise<void> {
    if (!media.mediaId) return;

    if (media.type === "image" && result.photo?.length) {
      const largest = result.photo[result.photo.length - 1];
      await this.cacheFileId(media.mediaId, media.type, largest.file_id, largest.file_unique_id);
    } else if (media.type === "video" && result.video) {
      await this.cacheFileId(media.mediaId, media.type, result.video.file_id, result.video.file_unique_id);
    }
  }

  /**
   * Send media by fetching the file and uploading directly
   */
  private async sendMediaAsUpload(
    chatId: string,
    media: { type: "image" | "video"; url: string; mediaId?: string },
    caption: string
  ): Promise<{ messageId: number; messageType: "photo" | "video" }> {
    const messageType = media.type === "image" ? "photo" : "video";

    // Fetch the file
    const fileResponse = await fetch(media.url);
    if (!fileResponse.ok) {
      throw new BadRequestError("Failed to fetch media", {
        url: media.url,
        httpStatus: fileResponse.status,
      });
    }

    const fileBlob = await fileResponse.blob();
    const urlPath = new URL(media.url).pathname;
    const filename = urlPath.split("/").pop() || `media.${media.type === "image" ? "jpg" : "mp4"}`;

    if (media.type === "image") {
      const result = await telegramApi.sendPhoto(this.botToken, chatId, fileBlob, caption, filename);
      await this.cacheMediaResult(media, result);
      return { messageId: result.message_id, messageType };
    } else {
      const result = await telegramApi.sendVideo(this.botToken, chatId, fileBlob, caption, filename);
      await this.cacheMediaResult(media, result);
      return { messageId: result.message_id, messageType };
    }
  }

  /**
   * Register callback for incoming events
   */
  onMessage(callback: (event: JourneyEvent) => Promise<void>): void {
    this.messageHandler = callback;
  }

  /**
   * Unregister callback for incoming events
   */
  offMessage(callback: (event: JourneyEvent) => Promise<void>): void {
    if (this.messageHandler === callback) {
      this.messageHandler = null;
    }
  }

  /**
   * Cleanup adapter resources
   */
  dispose(): void {
    this.messageHandler = null;
    this.timerMap.clear();
    // Clear all typing intervals
    for (const interval of this.typingIntervals.values()) {
      clearInterval(interval);
    }
    this.typingIntervals.clear();
  }

  /**
   * Start typing indicator with auto-refresh every 4 seconds.
   * Telegram's typing indicator expires after ~5 seconds, so we re-send
   * periodically to keep it visible during long LLM operations.
   *
   * @param chatId - The chat ID to show typing in
   */
  async startTypingIndicator(chatId: string): Promise<void> {
    // Stop any existing typing for this chat
    this.stopTypingIndicator(chatId);

    // Send initial typing action
    try {
      await telegramApi.sendChatAction(this.botToken, chatId, "typing");
      this.log.debug({ chatId }, "telegram:typingIndicator:started");
    } catch (error) {
      this.log.warn({ chatId, err: serializeError(error) }, "telegram:typingIndicator:startFailed");
      return; // Don't set up interval if initial send fails
    }

    // Set up interval to re-send every 4 seconds
    const interval = setInterval(async () => {
      try {
        await telegramApi.sendChatAction(this.botToken, chatId, "typing");
      } catch (error) {
        this.log.warn({ chatId, err: serializeError(error) }, "telegram:typingIndicator:refreshFailed");
        // Don't clear interval - try again next time
      }
    }, TYPING_REFRESH_INTERVAL_MS);

    this.typingIntervals.set(chatId, interval);
  }

  /**
   * Stop typing indicator for a chat.
   * Just clears the interval - typing will auto-expire.
   *
   * @param chatId - The chat ID to stop typing for
   */
  stopTypingIndicator(chatId: string): void {
    const interval = this.typingIntervals.get(chatId);
    if (interval) {
      clearInterval(interval);
      this.typingIntervals.delete(chatId);
      this.log.debug({ chatId }, "telegram:typingIndicator:stopped");
    }
  }

  /**
   * Process an incoming Telegram update
   * @param clientId - Internal client UUID (not the Telegram platform user ID)
   */
  async processUpdate(update: TelegramUpdate, clientId: string): Promise<void> {
    this.log.debug({ updateId: update.update_id }, "telegram:processUpdate");

    let event: JourneyEvent | null = null;

    if (update.callback_query) {
      event = {
        type: "button_click",
        userId: clientId,
        sessionId: this.sessionId,
        payload: { buttonId: update.callback_query.data },
        timestamp: new Date().toISOString(),
      };

      await telegramApi.answerCallbackQuery(this.botToken, update.callback_query.id);
    } else if (update.message?.voice) {
      // Handle voice message - download and transcribe
      const voice = update.message.voice;
      this.log.info({ fileId: voice.file_id, duration: voice.duration }, "telegram:processUpdate:voice");

      try {
        // Download voice file from Telegram
        const filePath = await telegramApi.getFile(this.botToken, voice.file_id);
        const audioBuffer = await telegramApi.downloadFile(this.botToken, filePath);

        // Transcribe using LLM audio service
        const result = await transcribeAudio(audioBuffer, "voice.ogg", {
          organizationId: this.organizationId,
          journeySessionId: this.sessionId,
          journeyId: this.journeyId,
        });

        this.log.info({ transcriptLength: result.transcript.length }, "telegram:processUpdate:voice:transcribed");

        event = {
          type: "message",
          userId: clientId,
          sessionId: this.sessionId,
          payload: {
            text: result.transcript,
            inputType: "voice",
            voiceDuration: voice.duration, // Audio duration in seconds from Telegram
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        this.log.error({ err: serializeError(error), fileId: voice.file_id }, "telegram:processUpdate:voice:error");
        // Notify user that transcription failed
        const chatId = String(update.message?.chat.id);
        try {
          await telegramApi.sendTextMessage(this.botToken, chatId, "Sorry, I couldn't understand that voice message. Please try again or type your message.");
        } catch (notifyError) {
          this.log.warn({ err: serializeError(notifyError), chatId }, "telegram:processUpdate:voice:notifyFailed");
        }
      }
    } else if (update.message?.text) {
      event = {
        type: "message",
        userId: clientId,
        sessionId: this.sessionId,
        payload: { text: update.message.text },
        timestamp: new Date().toISOString(),
      };
    }

    if (event && this.messageHandler) {
      await this.messageHandler(event);
    }
  }

  /**
   * Schedule a timer using BullMQ
   */
  async scheduleTimer(sessionId: string, durationMs: number, edgeId: string): Promise<string> {
    const jobData = createTimerJobData({
      sessionId,
      edgeId,
      channelId: this.botId,
    });

    try {
      const jobId = await scheduleTimer(jobData, durationMs);
      this.timerMap.set(edgeId, jobId);
      this.log.info({ sessionId, edgeId, durationMs, jobId }, "telegram:scheduleTimer:success");
      return jobId;
    } catch (error) {
      this.log.error({ sessionId, edgeId, durationMs, err: serializeError(error) }, "telegram:scheduleTimer:error");
      throw error;
    }
  }

  /**
   * Cancel a timer
   */
  async cancelTimer(timerId: string, edgeId: string, sessionId: string): Promise<boolean> {
    // Fast path: try in-memory lookup
    const jobId = this.timerMap.get(edgeId);

    if (jobId) {
      try {
        const cancelled = await cancelTimer(jobId);
        if (cancelled) {
          this.timerMap.delete(edgeId);
          this.log.info({ timerId, jobId, edgeId, sessionId }, "telegram:cancelTimer:success:memory");
        }
        return cancelled;
      } catch (error) {
        this.log.error({ timerId, jobId, edgeId, err: serializeError(error) }, "telegram:cancelTimer:error");
        throw error;
      }
    }

    // Fallback: query database
    try {
      const timer = await getActiveTimerBySessionAndEdge(sessionId, edgeId);
      if (timer?.bullmqJobId) {
        const cancelled = await cancelTimer(timer.bullmqJobId);
        if (cancelled) {
          this.log.info({ timerId, edgeId, sessionId, jobId: timer.bullmqJobId }, "telegram:cancelTimer:success:db");
        }
        return cancelled;
      }
      return false;
    } catch (error) {
      this.log.error({ timerId, edgeId, sessionId, err: serializeError(error) }, "telegram:cancelTimer:dbError");
      throw error;
    }
  }

  /**
   * Handle a timer firing
   */
  handleTimerFired(data: TimerJobData): void {
    if (this.messageHandler) {
      const event: JourneyEvent = {
        type: "timeout",
        userId: this.clientId,
        sessionId: data.sessionId,
        payload: { timerId: data.timerId },
        timestamp: new Date().toISOString(),
      };
      this.messageHandler(event);
    }
  }
}
