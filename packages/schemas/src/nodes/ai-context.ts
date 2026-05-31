import { z } from "zod";

/**
 * AI Context Settings Schema - Shared across node types
 *
 * Used by:
 * - Agent Node: Additional context appended to workflow system prompts
 * - Follow-up Plugin: AI-generated personalized messages
 *
 * The schema defines how AI context is built from journey data:
 * - includeUserProfile: User's name, email, etc.
 * - includeNodeContext: Previous node outputs (smart extraction)
 * - includeSessionContext: Full session (tags, variables, history)
 * - customContext: Template with {{variable}} support for custom instructions/persona
 */
export const AIContextSettingsSchema = z.object({
  /**
   * LLM model ID (e.g., "gemini-3-flash-preview", "gpt-4o-mini").
   * If not specified, uses PRIMARY_MODEL from config.
   */
  model: z.string().optional(),
  /**
   * Include user profile (firstName, username, email) in AI context.
   * Provides basic personalization with minimal token usage.
   * Default: true
   */
  includeUserProfile: z.boolean().default(true),
  /**
   * Include node context (parent node output, current node info).
   * Provides relevant node-specific data without full session dump.
   * Default: true
   */
  includeNodeContext: z.boolean().default(true),
  /**
   * Include full session context (variables, conversation history, tags).
   * Enables rich personalization but uses more tokens.
   * Default: false (opt-in for token efficiency)
   */
  includeSessionContext: z.boolean().default(false),
  /**
   * Custom context template with variable support.
   * Allows users to construct their own context using {{variables}}.
   * This is appended after other context sections.
   *
   * @example "Order: {{order.id}} - Status: {{order.status}}\nUser tier: {{user.tier}}"
   */
  customContext: z.string().max(2000).optional(),
});

export type AIContextSettings = z.infer<typeof AIContextSettingsSchema>;
