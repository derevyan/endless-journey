/**
 * Sampling Configuration Helper
 *
 * Provides centralized logic for selecting the correct sampling mode
 * (temperature vs reasoningEffort) based on model capabilities.
 *
 * Key principle: Model capabilities drive configuration, not the caller.
 *
 * @module llm/utils/sampling-config
 */

import { getModelMetadata } from "@journey/schemas";
import type { ReasoningEffort } from "@journey/schemas";

/**
 * Sampling configuration result - either temperature OR reasoningEffort
 */
export interface SamplingConfig {
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
}

/**
 * Options for building sampling configuration
 */
export interface SamplingOptions {
  /** Model ID to get capabilities for */
  model: string;
  /** Preferred temperature (used only if model supports it) */
  temperature?: number;
  /** Preferred reasoning effort (used only if model supports it) */
  reasoningEffort?: ReasoningEffort;
  /** Default reasoning effort for reasoning models (default: "high") */
  defaultReasoningEffort?: ReasoningEffort;
  /** Default temperature for standard models (default: 0.7) */
  defaultTemperature?: number;
}

/**
 * Build the correct sampling configuration based on model capabilities.
 *
 * Logic:
 * 1. If model requires reasoning (supportsTemperature: false) → use reasoningEffort
 * 2. If model supports reasoning (supportsReasoning: true) → PREFER reasoningEffort
 * 3. Otherwise → use temperature
 * 4. For unknown models → default to temperature (safe fallback)
 *
 * KEY: When a model supports BOTH temperature and reasoning, we ALWAYS prefer
 * reasoningEffort as it provides better control over model thinking.
 *
 * @example
 * ```typescript
 * // Gemini Flash 3 (reasoning-only model)
 * buildModelSamplingConfig({ model: "gemini-3-flash-preview" })
 * // → { reasoningEffort: "high" }
 *
 * // GPT-4o (standard model)
 * buildModelSamplingConfig({ model: "gpt-4o" })
 * // → { temperature: 0.7 }
 *
 * // Hybrid model (supports both) - prefers reasoning
 * buildModelSamplingConfig({ model: "some-hybrid-model" })
 * // → { reasoningEffort: "high" }
 *
 * // With custom defaults
 * buildModelSamplingConfig({
 *   model: "gemini-3-flash-preview",
 *   defaultReasoningEffort: "medium"
 * })
 * // → { reasoningEffort: "medium" }
 * ```
 */
export function buildModelSamplingConfig(options: SamplingOptions): SamplingConfig {
  const {
    model,
    temperature,
    reasoningEffort,
    defaultReasoningEffort = "high",
    defaultTemperature = 0.7,
  } = options;

  const metadata = getModelMetadata(model);

  // Case 1: Reasoning-only model (no temperature support)
  // These models REQUIRE reasoningEffort instead of temperature
  if (metadata?.supportsTemperature === false) {
    return {
      reasoningEffort: reasoningEffort ?? defaultReasoningEffort,
    };
  }

  // Case 2: Hybrid model (supports both temperature AND reasoning)
  // We PREFER reasoningEffort when available - it gives better control
  if (metadata?.supportsReasoning === true) {
    return {
      reasoningEffort: reasoningEffort ?? defaultReasoningEffort,
    };
  }

  // Case 3: Standard model or unknown model
  // Use temperature for standard models and as safe fallback for unknown models
  return {
    temperature: temperature ?? defaultTemperature,
  };
}

/**
 * Check if a model should use reasoning effort instead of temperature.
 *
 * Returns true for:
 * - Reasoning-only models (supportsTemperature: false)
 * - Hybrid models that support reasoning (supportsReasoning: true)
 *
 * @example
 * ```typescript
 * isReasoningModel("gemini-3-flash-preview") // → true (reasoning-only)
 * isReasoningModel("gpt-4o") // → false (standard)
 * isReasoningModel("hybrid-model") // → true if supportsReasoning: true
 * isReasoningModel("unknown-model") // → false (safe default)
 * ```
 */
export function isReasoningModel(model: string): boolean {
  const metadata = getModelMetadata(model);
  // Reasoning-only OR hybrid with reasoning support
  return metadata?.supportsTemperature === false || metadata?.supportsReasoning === true;
}
