import { z } from "zod";
import { BaseNodeDataSchema, MediaSchema, TimerSchema } from "../../../base";
import { ButtonsSchema } from "../../../button";

// Response type determines how the node waits for user input
// - auto: Display message, auto-continue (informational, no input needed)
// - buttons: Wait for button click only
// - text: Wait for free-text message from user
// - any: Show buttons but also accept free-text as valid response
export const ResponseTypeSchema = z.enum(["auto", "buttons", "text", "any"]);
export type ResponseType = z.infer<typeof ResponseTypeSchema>;

// Voice mode determines how the bot responds to voice messages
// - text-only: Always respond with text (default)
// - voice-to-voice: Reply with voice if user sent voice message
// - voice-only: Always reply with voice message (TTS)
export const VoiceModeSchema = z.enum(["text-only", "voice-to-voice", "voice-only"]);
export type VoiceMode = z.infer<typeof VoiceModeSchema>;

// Voice profile (TTS voice) - accepts any voice ID string
// OpenAI voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
// ElevenLabs voices: voice UUIDs like "21m00Tcm4TlvDq8ikWAM"
export const VoiceProfileSchema = z.string().min(1);
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

// Content format for message node content
export const ContentFormatSchema = z.enum(["text", "markdown"]).default("text");
export type ContentFormat = z.infer<typeof ContentFormatSchema>;

// Message node - display content to user
// This is the most flexible node type, absorbing functionality of old DECISION and RETRY types:
// - With buttons: acts as a decision point
// - With timer: acts as a follow-up/retry message
// - With responseType: controls how user input is handled
export const MessageNodeDataSchemaV1 = BaseNodeDataSchema.extend({
  type: z.literal("message"),
  schemaVersion: z.literal(1).optional().default(1),
  // Max 4096 chars - Telegram message limit (1024 for media captions, handled at adapter level)
  content: z.string().min(1, "Content is required").max(4096, "Message must be 4096 characters or less"),
  media: MediaSchema.optional(),
  // Interactive buttons (makes it a decision point)
  // Each button has { id, text, edgeId } - routing uses edgeId, not text matching
  buttons: ButtonsSchema.optional(),
  // Note: Tags are now managed via tagAction in BaseNodeDataSchema (add/remove operations)
  timer: TimerSchema.optional(), // Timeout for follow-up (makes it a retry/follow-up)
  // Response type - determines how node waits for user input
  // If not set, inferred from buttons array (exists = "buttons", empty = "auto")
  responseType: ResponseTypeSchema.optional(),
  // Optional custom variable name to store user response (e.g., "selectedPlan")
  // Response is always stored in context.userResponse, this adds an alias
  storeResponseAs: z.string().optional(),
  // Optional delay before sending message (seconds, 0-60)
  // 0 means no delay, 1-60 adds typing pause for natural pacing
  delay: z.number().int().min(0).max(60).optional(),
  // Note: voiceMode is only supported on agent nodes, not message nodes
  // (message nodes display static content, voice output is for AI responses)
});

export const MessageNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("message"),
  schemaVersion: z.literal(2).default(2),
  // Max 4096 chars - Telegram message limit (1024 for media captions, handled at adapter level)
  content: z.string().min(1, "Content is required").max(4096, "Message must be 4096 characters or less"),
  contentFormat: ContentFormatSchema,
  media: MediaSchema.optional(),
  // Interactive buttons (makes it a decision point)
  // Each button has { id, text, edgeId } - routing uses edgeId, not text matching
  buttons: ButtonsSchema.optional(),
  // Note: Tags are now managed via tagAction in BaseNodeDataSchema (add/remove operations)
  timer: TimerSchema.optional(), // Timeout for follow-up (makes it a retry/follow-up)
  // Response type - determines how node waits for user input
  // If not set, inferred from buttons array (exists = "buttons", empty = "auto")
  responseType: ResponseTypeSchema.optional(),
  // Optional custom variable name to store user response (e.g., "selectedPlan")
  // Response is always stored in context.userResponse, this adds an alias
  storeResponseAs: z.string().optional(),
  // Optional delay before sending message (seconds, 0-60)
  // 0 means no delay, 1-60 adds typing pause for natural pacing
  delay: z.number().int().min(0).max(60).optional(),
  // Note: voiceMode is only supported on agent nodes, not message nodes
  // (message nodes display static content, voice output is for AI responses)
});

export type MessageNodeDataV1 = z.infer<typeof MessageNodeDataSchemaV1>;
export type MessageNodeData = z.infer<typeof MessageNodeDataSchema>;

// =============================================================================
// MESSAGE NODE OUTPUT SCHEMA
// Mirrors what message-handler.ts stores via storeNodeOutput()
// See: message-handler.ts:146-152
// =============================================================================

/**
 * Message node output schema - stored via storeNodeOutput()
 * Uses createMessageMetadata() pattern from output-helpers.ts
 */
export const MessageNodeOutputSchema = z.object({
  // From createMessageMetadata()
  message: z.string().nullable(),
  messageDelivered: z.boolean(),
  mediaAttached: z
    .object({
      type: z.string(),
      url: z.string(),
    })
    .nullable(),
  sentAt: z.string(),
  // Additional message-specific fields
  responseType: z.string(),
  buttonsDisplayed: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
      })
    )
    .nullable(),
  delayApplied: z.number().nullable(),
  timerScheduled: z.boolean(),
});

export type MessageNodeOutput = z.infer<typeof MessageNodeOutputSchema>;
