/**
 * Follow-Up AI Service Implementation
 *
 * Provides the LLM-backed implementation of FollowUpAIService for generating
 * AI-enhanced follow-up messages.
 *
 * This implementation:
 * - Uses @journey/llm for chat completion
 * - Supports model fallback for resilience
 * - Handles temperature vs reasoning effort based on model capabilities
 * - Tracks token usage for billing/analytics
 *
 * @module @journey/engine-integrations
 */

import { generateChatResponse, buildModelSamplingConfig } from "@journey/llm";
import { LLM_DEFAULTS } from "@journey/llm/config";
import { PRIMARY_MODEL } from "@journey/schemas";
import type {
  FollowUpAIService,
  FollowUpAIGenerationConfig,
  FollowUpAIGenerationResult,
} from "@journey/engine";

/**
 * Create a FollowUpAIService backed by @journey/llm.
 *
 * This service abstracts LLM calls from the engine core, allowing
 * the engine to generate AI-enhanced follow-up messages without
 * directly depending on @journey/llm.
 *
 * @example
 * ```typescript
 * import { createFollowUpAIService } from "@journey/engine-integrations";
 *
 * const followUpAI = createFollowUpAIService();
 *
 * const engine = new SessionEngine(session, journey, adapter, {
 *   // Pass to ServiceFactory via config
 * });
 *
 * // Or wire directly in service-factory.ts
 * ```
 */
export function createFollowUpAIService(): FollowUpAIService {
  return {
    async generateContent(
      systemPrompt: string,
      userMessage: string,
      config?: FollowUpAIGenerationConfig
    ): Promise<FollowUpAIGenerationResult> {
      // Use provided model or default to PRIMARY_MODEL
      const model = config?.model ?? PRIMARY_MODEL.id;

      // Build sampling config based on model capabilities
      // Uses buildModelSamplingConfig to handle temperature vs reasoningEffort
      const samplingConfig = buildModelSamplingConfig({
        model,
        defaultTemperature: config?.temperature ?? LLM_DEFAULTS.TEMPERATURE_CHAT,
        defaultReasoningEffort: config?.reasoningEffort ?? "high",
      });

      // Call LLM with system prompt and user message
      const response = await generateChatResponse(
        systemPrompt,
        [{ role: "user", content: userMessage }],
        {
          model,
          ...samplingConfig,
          maxTokens: config?.maxTokens ?? 500,
          fallbackModels: config?.fallbackModels,
          organizationId: config?.organizationId,
        }
      );

      return {
        // response.result should always be present for successful completions
        content: response.result ?? "",
        modelUsed: response.modelUsed,
        tokenUsage: response.tokenUsage
          ? {
              totalTokens: response.tokenUsage.totalTokens,
              costUSD: response.tokenUsage.costUSD,
            }
          : undefined,
      };
    },
  };
}
