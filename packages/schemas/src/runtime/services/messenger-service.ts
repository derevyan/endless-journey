import type { Media } from "../../nodes/base";
import type { ButtonConfig } from "../../nodes/button";
import type { VoiceMode } from "../../nodes/types/journey/message/schema";

/**
 * Result of a send operation.
 */
export interface SendResult {
  /** Whether the message was sent successfully */
  success: boolean;
  /** Platform-specific message ID (if available) */
  messageId?: string;
  /** Error message if send failed */
  error?: string;
}

/**
 * Voice configuration for TTS output.
 * Consolidates all voice-related settings into a single object.
 */
export interface VoiceConfig {
  /** Voice response mode - controls when to use voice */
  mode?: VoiceMode;
  /** Voice profile (TTS voice ID) */
  profile?: string;
  /** Voice provider */
  provider?: "openai" | "elevenlabs";
  /** ElevenLabs TTS model ID (e.g., "eleven_v3", "eleven_multilingual_v2") */
  elevenLabsModel?: string;
}

/**
 * Options for sending a message.
 */
export interface MessageOptions {
  /** Optional delay before sending (seconds) */
  delay?: number;
  /** Parse mode for formatting (platform-specific) */
  parseMode?: "markdown" | "html" | "plain";
  /** Disable link previews */
  disablePreview?: boolean;
  /** Disable notification sound */
  silent?: boolean;
  /** Voice configuration for TTS output */
  voice?: VoiceConfig;
}

/**
 * Options for sending buttons.
 */
export interface ButtonOptions extends MessageOptions {
  /** Text message to accompany the buttons */
  text?: string;
  /** Whether buttons should be inline or reply keyboard */
  inline?: boolean;
  /** Number of buttons per row */
  buttonsPerRow?: number;
}

/**
 * Options for sending media.
 */
export interface MediaOptions extends MessageOptions {
  /** Caption for the media */
  caption?: string;
}

/**
 * Messenger service interface for sending messages to users.
 *
 * This interface provides a unified API for user communication:
 * - Journey Engine: Send messages during journey execution
 * - Workflow Runner: Send AI-generated responses
 * - LLM Tools: Enable tools to communicate with users
 *
 * The implementation handles platform-specific details (Telegram, WhatsApp, etc.)
 * while providing a consistent API.
 *
 * @example
 * ```typescript
 * // Send a simple message
 * await services.messenger.sendMessage("Hello! How can I help?");
 *
 * // Send a message with buttons
 * await services.messenger.sendButtons(
 *   [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }],
 *   { text: "Would you like to continue?" }
 * );
 *
 * // Send media
 * await services.messenger.sendMedia({
 *   type: "image",
 *   url: "https://example.com/image.jpg"
 * });
 * ```
 */
export interface IMessengerService {
  // =========================================================================
  // Required Methods
  // =========================================================================

  /**
   * Send a message to the user with optional buttons and media.
   *
   * This is the primary method for all messaging operations, supporting:
   * - Plain text messages
   * - Messages with interactive buttons
   * - Messages with media attachments
   * - Or any combination
   *
   * @param content - The message content (supports markdown/HTML based on platform)
   * @param buttons - Optional buttons to include
   * @param media - Optional media attachment
   * @param prebuiltContext - Optional pre-built evaluation context for template substitution
   * @param options - Optional message configuration (voice settings, etc.)
   * @returns Result of the send operation
   */
  sendMessage(
    content: string,
    buttons?: ButtonConfig[],
    media?: Media,
    prebuiltContext?: Record<string, unknown>,
    options?: MessageOptions
  ): Promise<SendResult>;

  // =========================================================================
  // Optional Methods (convenience extensions)
  // =========================================================================

  /**
   * Send interactive buttons to the user.
   *
   * @param buttons - Array of button configurations
   * @param options - Optional button configuration including accompanying text
   * @returns Result of the send operation
   */
  sendButtons?(buttons: ButtonConfig[], options?: ButtonOptions): Promise<SendResult>;

  /**
   * Send media (image/video) to the user.
   *
   * @param media - Media configuration (type, url, filename)
   * @param options - Optional media configuration including caption
   * @returns Result of the send operation
   */
  sendMedia?(media: Media, options?: MediaOptions): Promise<SendResult>;

  /**
   * Edit a previously sent message.
   *
   * @param messageId - Platform-specific message ID
   * @param content - New message content
   * @param options - Optional message configuration
   * @returns Result of the edit operation
   */
  editMessage?(messageId: string, content: string, options?: MessageOptions): Promise<SendResult>;

  /**
   * Delete a previously sent message.
   *
   * @param messageId - Platform-specific message ID
   * @returns Result of the delete operation
   */
  deleteMessage?(messageId: string): Promise<SendResult>;

  /**
   * Send typing indicator to show the bot is "typing".
   * Useful for creating natural conversation pacing.
   *
   * @param durationMs - How long to show typing indicator (milliseconds)
   */
  sendTypingIndicator?(durationMs?: number): Promise<void>;
}
