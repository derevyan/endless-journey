import { z } from "zod";
import { LLMProviderSchema, ReasoningEffortSchema } from "./providers";

// =============================================================================
// CANONICAL LLM RUNTIME CONFIGURATION
// =============================================================================

/**
 * Canonical LLM Runtime Configuration - single source of truth for LLM config.
 *
 * This unified schema combines all LLM configuration fields from:
 * - WorkflowLLMConfigSchema (workflow agents)
 * - AgentNodeLLMConfigSchema (journey agents)
 * - AgentLLMConfigSchema (mindstate agents)
 *
 * All other LLM config types should extend or reference this schema.
 *
 * @example
 * const config: LLMRuntimeConfig = {
 *   model: "gpt-4o",
 *   provider: "openai", // Optional - auto-detected from model name if omitted
 *   temperature: 0.7,
 *   maxTokens: 4096,
 * };
 */
export const LLMRuntimeConfigSchema = z.object({
  /**
   * Model identifier (required).
   * Examples: "gpt-4o", "claude-sonnet-4-5-20250929", "gemini-2.0-flash"
   */
  model: z.string().min(1).max(100),

  /**
   * LLM provider (optional).
   * If omitted, provider is auto-detected from the model name.
   * Explicit provider is recommended for unambiguous model names.
   */
  provider: LLMProviderSchema.optional(),

  /**
   * Sampling temperature (0-2).
   * Lower = more deterministic, Higher = more creative.
   * Note: Ignored for reasoning models (o1, o3) - use reasoningEffort instead.
   */
  temperature: z.number().min(0).max(2).optional(),

  /**
   * Maximum tokens to generate.
   * Provider-specific limits apply (e.g., 128K for GPT-4o).
   */
  maxTokens: z.number().int().min(1).max(128000).optional(),

  /**
   * Top-p (nucleus) sampling.
   * Alternative to temperature for controlling randomness.
   */
  topP: z.number().min(0).max(1).optional(),

  /**
   * Frequency penalty (-2 to 2).
   * Reduces repetition based on token frequency.
   */
  frequencyPenalty: z.number().min(-2).max(2).optional(),

  /**
   * Presence penalty (-2 to 2).
   * Encourages topic diversity.
   */
  presencePenalty: z.number().min(-2).max(2).optional(),

  /**
   * Reasoning effort for reasoning models (o1, o3).
   * Controls depth of reasoning chain.
   * Note: Temperature is ignored when this is set.
   */
  reasoningEffort: ReasoningEffortSchema.optional(),

  /**
   * Request timeout in seconds.
   */
  timeout: z.number().int().min(5).max(600).optional(),

  /**
   * Maximum retry attempts on transient errors.
   */
  maxRetries: z.number().int().min(0).max(10).optional(),
});

export type LLMRuntimeConfig = z.infer<typeof LLMRuntimeConfigSchema>;

/**
 * Minimal LLM config - just model name with optional provider.
 * Use when you only need model identification without generation params.
 */
export const LLMModelConfigSchema = z.object({
  model: z.string().min(1).max(100),
  provider: LLMProviderSchema.optional(),
});

export type LLMModelConfig = z.infer<typeof LLMModelConfigSchema>;
