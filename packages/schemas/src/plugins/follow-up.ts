import { z } from "zod";
import {
  DurationSchema,
  FollowUpStepSchema,
  FollowUpAiConfigSchema,
  type FollowUpAiConfig,
} from "../nodes/follow-up";
import { BasePluginDataSchema } from "./base";

// Re-export AI config from nodes/follow-up to maintain API surface
export { FollowUpAiConfigSchema, type FollowUpAiConfig };

// =============================================================================
// FOLLOW-UP PLUGIN DATA SCHEMA
// =============================================================================

/**
 * Follow-Up Plugin Data Schema
 *
 * Extracted from MessageNodeData.followUpSequence for the plugin system.
 * Reuses existing FollowUpStepSchema to maintain compatibility.
 *
 * Execution flow:
 * 1. Parent node executes, plugin handler schedules first follow-up timer
 * 2. If user responds: cancel all timers, route via button edge
 * 3. If timer fires: send follow-up message, schedule next timer
 * 4. After last step times out: transition to exitPath (or end journey)
 *
 * AI Mode (when ai.enabled = true):
 * - step.content becomes AI instructions
 * - LLM generates personalized message using context
 * - Fallback: step.fallbackContent ?? step.content
 */
export const FollowUpPluginDataSchema = BasePluginDataSchema.extend({
  /** Discriminator for plugin type */
  pluginType: z.literal("followup"),
  /** Follow-up steps - max 5 to prevent overly complex sequences */
  steps: z.array(FollowUpStepSchema).max(5),
  /** Where to transition when sequence exhausts without user response */
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

export type FollowUpPluginData = z.infer<typeof FollowUpPluginDataSchema>;

/**
 * Plugin Types - Discriminated union of all plugin types
 *
 * Currently only follow-up, but extensible for future plugins:
 * - Analytics: Track node-level metrics, drop-off rates
 * - Rate Limit: Throttle responses, prevent spam
 * - A/B Test: Split traffic between variations
 * - Schedule: Time-based activation (business hours)
 */
export const PluginDataSchema = z.discriminatedUnion("pluginType", [
  FollowUpPluginDataSchema,
  // Future plugins added here:
  // AnalyticsPluginDataSchema,
  // RateLimitPluginDataSchema,
]);

export type PluginData = z.infer<typeof PluginDataSchema>;
