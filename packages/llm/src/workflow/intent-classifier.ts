/**
 * Intent Classifier Service
 *
 * Classifies user messages into predefined intents using LLM.
 * Uses Groq's gpt-oss-120b model by default for fast, cost-effective classification.
 *
 * @module workflow/intent-classifier
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { INTENT_CONFIG } from "@journey/schemas/config";
import { generateStructuredOutput } from "../services/llm-service";
import type { LLMConfig } from "../types";

const log = createLogger("intent-classifier");

// ============================================================================
// Types
// ============================================================================

/**
 * Result of intent classification
 */
export interface IntentClassificationResult {
  /** Whether an intent was matched with sufficient confidence */
  matched: boolean;
  /** The selected intent (null if no match) */
  intent: string | null;
  /** Confidence score 0-1 */
  confidence: number;
  /** LLM's reasoning for the classification */
  reasoning: string;
}

// ============================================================================
// Schema
// ============================================================================

const IntentClassificationSchema = z.object({
  selectedIntent: z.string().nullable().describe("The best matching intent, or null if none match well"),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
  reasoning: z.string().describe("Brief explanation of the classification decision"),
});

// ============================================================================
// Prompts
// ============================================================================

const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classifier. Analyze the user's message and classify it into ONE of the provided intents.

Available intents: {intents}

Rules:
1. Select the BEST matching intent from the list, or null if none match well
2. Provide a confidence score between 0 and 1:
   - 0.9-1.0: Very confident, clear match
   - 0.7-0.9: Confident, good match
   - 0.5-0.7: Moderate confidence, possible match
   - Below 0.5: Low confidence, poor match
3. Explain your reasoning briefly (1-2 sentences)

IMPORTANT: Only return intents from the provided list. If the message doesn't clearly match any intent, return null.`;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default LLM config for intent classification
 * Uses configuration from @journey/schemas/config/llm/services
 * Groq gpt-oss-120b for fast, cheap classification
 */
const DEFAULT_INTENT_CONFIG: Partial<LLMConfig> = {
  model: INTENT_CONFIG.model.id,
  provider: INTENT_CONFIG.model.provider,
  temperature: INTENT_CONFIG.temperature,
  maxTokens: INTENT_CONFIG.maxTokens,
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Classify a user message into one of the provided intents
 *
 * @param message - User message to classify
 * @param intents - List of possible intents
 * @param minConfidence - Minimum confidence threshold (0-1)
 * @param config - Optional LLM config override
 * @returns Classification result with matched flag, intent, confidence, and reasoning
 *
 * @example
 * ```typescript
 * const result = await classifyIntent(
 *   "I need help with billing",
 *   ["support", "sales", "general"],
 *   0.7
 * );
 * // { matched: true, intent: "support", confidence: 0.85, reasoning: "..." }
 * ```
 */
export async function classifyIntent(
  message: string,
  intents: string[],
  minConfidence: number,
  config?: Partial<LLMConfig>
): Promise<IntentClassificationResult> {
  // Validate inputs
  if (!message.trim()) {
    log.warn({}, "intentClassifier:emptyMessage");
    return {
      matched: false,
      intent: null,
      confidence: 0,
      reasoning: "Empty message cannot be classified",
    };
  }

  if (intents.length === 0) {
    log.warn({}, "intentClassifier:noIntents");
    return {
      matched: false,
      intent: null,
      confidence: 0,
      reasoning: "No intents provided for classification",
    };
  }

  try {
    const systemPrompt = CLASSIFICATION_SYSTEM_PROMPT.replace("{intents}", intents.join(", "));

    const mergedConfig: LLMConfig = {
      ...DEFAULT_INTENT_CONFIG,
      ...config,
      model: config?.model ?? DEFAULT_INTENT_CONFIG.model!,
    };

    const response = await generateStructuredOutput(
      systemPrompt,
      message,
      IntentClassificationSchema,
      mergedConfig
    );

    const result = response.result;

    // Determine if the intent matched
    const intentIsValid = result.selectedIntent !== null && intents.includes(result.selectedIntent);
    const confidenceIsSufficient = result.confidence >= minConfidence;
    const matched = intentIsValid && confidenceIsSufficient;

    log.info(
      {
        intent: result.selectedIntent,
        confidence: result.confidence,
        minConfidence,
        matched,
        intentsCount: intents.length,
      },
      "intentClassifier:classified"
    );

    return {
      matched,
      intent: result.selectedIntent,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  } catch (error) {
    log.error({ err: serializeError(error), intents, minConfidence }, "intentClassifier:error");

    // Graceful fallback - don't throw, return unmatched
    return {
      matched: false,
      intent: null,
      confidence: 0,
      reasoning: `Classification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
