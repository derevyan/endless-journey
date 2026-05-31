import { z } from "zod";
import { MediaSchema } from "./base";
import { CONTENT_REF_PREFIX } from "../runtime/content";
import { AIContextSettingsSchema } from "./ai-context";

// =============================================================================
// AI CONFIGURATION SCHEMA
// =============================================================================

/**
 * Follow-Up AI Configuration Schema
 *
 * Extends the shared AIContextSettingsSchema with an `enabled` toggle.
 * Enables AI-generated personalized messages for follow-up notifications.
 * When enabled, step.content becomes AI instructions (e.g., "send friendly reminder").
 *
 * The system prompt structure:
 * 1. User's custom system prompt (full control - persona/brand voice)
 * 2. Current task (step.content - what to generate)
 * 3. Context data (auto-appended with user profile, session state)
 * 4. Output guidelines (minimal rules for clean output)
 *
 * @example
 * ai: {
 *   enabled: true,
 *   systemPrompt: "You are Luna, a friendly assistant for TechCorp...",
 *   includeUserProfile: true,     // User's name and username (default: ON)
 *   includeNodeContext: true,     // Parent node output, current state (default: ON)
 *   includeSessionContext: false, // Full context - variables, history, tags (default: OFF)
 * }
 */
export const FollowUpAiConfigSchema = AIContextSettingsSchema.extend({
  /** Enable AI-generated messages for all steps in this plugin */
  enabled: z.boolean().default(false),
  /**
   * Default instructions used when step.content is empty.
   * Provides baseline AI behavior without requiring task instructions for every step.
   */
  defaultInstructions: z.string().max(1000).optional(),
});

export type FollowUpAiConfig = z.infer<typeof FollowUpAiConfigSchema>;

/**
 * Duration Schema - Flexible time specification
 *
 * Allows specifying time in multiple units for user-friendly configuration.
 * At least one unit must be specified.
 * Max 7 days to prevent runaway sequences.
 */
export const DurationSchema = z
  .object({
    seconds: z.number().min(0).optional(),
    minutes: z.number().min(0).optional(),
    hours: z.number().min(0).optional(),
    days: z.number().min(0).max(7).optional(),
  })
  .refine((d) => d.seconds || d.minutes || d.hours || d.days, {
    message: "At least one duration unit required",
  });

export type Duration = z.infer<typeof DurationSchema>;

/**
 * Duration to milliseconds conversion utility
 */
export function durationToMs(duration: Duration): number {
  let ms = 0;
  if (duration.seconds) ms += duration.seconds * 1000;
  if (duration.minutes) ms += duration.minutes * 60 * 1000;
  if (duration.hours) ms += duration.hours * 60 * 60 * 1000;
  if (duration.days) ms += duration.days * 24 * 60 * 60 * 1000;
  return ms;
}

/**
 * Follow-up Button Schema
 *
 * Unlike regular buttons which use edgeId for routing,
 * follow-up buttons directly target nodes by ID.
 * This is because follow-up sequences don't create visible edges.
 */
const BUTTON_TEXT_MAX_LENGTH = 35;

export const FollowUpButtonSchema = z.object({
  /** Unique button identifier */
  id: z.string(),
  /** Display text - auto-truncated to 35 chars for Telegram */
  text: z.string().transform((val) => {
    // Don't truncate content references - they'll be resolved later
    if (val.startsWith(CONTENT_REF_PREFIX)) {
      return val;
    }
    if (val.length > BUTTON_TEXT_MAX_LENGTH) {
      return val.slice(0, BUTTON_TEXT_MAX_LENGTH - 3) + "...";
    }
    return val;
  }),
  /** Target node ID - routes directly to this node when clicked */
  targetNodeId: z.string(),
});

export type FollowUpButton = z.infer<typeof FollowUpButtonSchema>;

/**
 * Follow-up Step Schema
 *
 * A single step in a follow-up sequence.
 * Each step sends a message after a delay.
 */
export const FollowUpStepSchema = z.object({
  /** Unique step identifier */
  id: z.string(),
  /** Delay before sending this step (after previous step or main message) */
  delay: DurationSchema,
  /**
   * Message content OR AI instructions.
   * - Static mode: This is the message text (same 4096 char limit as regular messages)
   * - AI mode: This is the prompt/instructions for AI generation
   *
   * When AI is enabled and content is empty, defaultInstructions (or system default) is used.
   */
  content: z.string().max(4096).default(""),
  /**
   * Fallback message if AI generation fails.
   * Only used when AI mode is enabled at plugin level.
   * If not set and AI fails, 'content' is used as the fallback message.
   */
  fallbackContent: z.string().max(4096).optional(),
  /** Optional media attachment */
  media: MediaSchema.optional(),
  /** Optional buttons - max 4 per follow-up step for cleaner UX */
  buttons: z.array(FollowUpButtonSchema).max(4).optional(),
  /** If true, end sequence and transition to exitPath after this step times out */
  exitOnTimeout: z.boolean().default(false),
  /**
   * Per-step response behavior (overrides sequence-level cancelOnAnyResponse).
   * - "cancel": Stop all follow-ups, stay on node
   * - "continue": Keep follow-ups running, process response
   * - "exit": Stop follow-ups AND navigate to exit path
   * - undefined: Use sequence-level cancelOnAnyResponse setting
   */
  onResponse: z.enum(["cancel", "continue", "exit"]).optional(),
});

export type FollowUpStep = z.infer<typeof FollowUpStepSchema>;

/**
 * Follow-up Sequence Schema
 *
 * Complete configuration for an inline follow-up sequence.
 * Embedded directly in MESSAGE node data.
 *
 * Execution flow:
 * 1. Main message sent, first follow-up timer scheduled
 * 2. If user responds: cancel all timers, route via button edge
 * 3. If timer fires: send follow-up message, schedule next timer
 * 4. After last step times out: wait for user response (response timeout)
 * 5. If response timeout fires: transition to exitPath (or stay on node)
 */
export const FollowUpSequenceSchema = z.object({
  /** Master toggle - sequence only active when enabled */
  enabled: z.boolean().default(false),
  /** Follow-up steps - max 5 to prevent overly complex sequences */
  steps: z.array(FollowUpStepSchema).max(5),
  /** Where to transition when sequence ends without user response */
  exitPath: z
    .object({
      /** Target node ID (e.g., exit-message, dropout-handler) */
      nodeId: z.string(),
      /** How long to wait for user response before auto-exiting (default: 59 sec) */
      timeout: DurationSchema.optional(),
    })
    .optional(),
  /** If true, any user response cancels the sequence (default: true) */
  cancelOnAnyResponse: z.boolean().default(true),
  /**
   * AI configuration for generating personalized follow-up messages.
   * When enabled, step.content is used as AI instructions instead of literal text.
   */
  ai: FollowUpAiConfigSchema.optional(),
});

export type FollowUpSequence = z.infer<typeof FollowUpSequenceSchema>;
