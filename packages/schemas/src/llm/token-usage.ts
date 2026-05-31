import { z } from "zod";

// =============================================================================
// CANONICAL TOKEN USAGE SCHEMA
// The ONLY TokenUsage definition - all other files must import from here
// =============================================================================

/**
 * TokenUsage - Canonical schema for LLM token consumption and cost
 *
 * Field naming convention: OpenAI-style (promptTokens, completionTokens)
 * - Matches LangChain's response_metadata.tokenUsage format
 * - Consistent with industry standard naming
 *
 * @example
 * const usage: TokenUsage = {
 *   promptTokens: 150,
 *   completionTokens: 50,
 *   totalTokens: 200,
 *   costUSD: 0.0003,
 * };
 */
export const TokenUsageSchema = z.object({
  /** Input/prompt tokens consumed */
  promptTokens: z.number().int().min(0),
  /** Output/completion tokens generated */
  completionTokens: z.number().int().min(0),
  /** Total tokens (prompt + completion) */
  totalTokens: z.number().int().min(0),
  /** Cost in USD (calculated from model pricing) */
  costUSD: z.number().min(0).optional(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

// =============================================================================
// AGGREGATED USAGE SCHEMA
// For summaries, billing, and analytics
// =============================================================================

/**
 * AggregatedUsage - Accumulated usage across multiple LLM calls
 *
 * Used for:
 * - Billing summaries
 * - Usage analytics
 * - Cost tracking dashboards
 */
export const AggregatedUsageSchema = z.object({
  /** Total input tokens across all calls */
  totalPromptTokens: z.number().int().min(0),
  /** Total output tokens across all calls */
  totalCompletionTokens: z.number().int().min(0),
  /** Total tokens across all calls */
  totalTokens: z.number().int().min(0),
  /** Total cost in USD across all calls */
  totalCostUSD: z.number().min(0),
  /** Number of LLM calls made */
  callCount: z.number().int().min(0),
});

export type AggregatedUsage = z.infer<typeof AggregatedUsageSchema>;

// =============================================================================
// USAGE CONTEXT SCHEMA
// Flexible dimensions for tracking
// =============================================================================

/**
 * UsageContext - Dimensions for tracking LLM usage
 *
 * All fields are optional to allow tracking at any granularity.
 * Pass what you have - the service handles missing dimensions gracefully.
 */
export const UsageContextSchema = z.object({
  // === DIMENSIONS (all optional for flexibility) ===

  /** Organization making the call */
  organizationId: z.string().optional(),
  /** User making the call (if applicable) */
  userId: z.string().optional(),
  /** Journey being executed (if applicable) */
  journeyId: z.string().optional(),
  /**
   * Session within journey (if applicable)
   * IMPORTANT: Only set for real journey executions. Workflow tests and
   * agent-only calls should leave this undefined to avoid FK violations.
   */
  journeySessionId: z.string().optional(),
  /** Client/end-user interacting (if applicable) */
  clientId: z.string().optional(),

  // === SERVICE CONTEXT ===

  /** Service that made the call (e.g., 'agent-handler', 'question-understanding') */
  service: z.string(),
  /** Module within service (e.g., 'worker-1', 'evaluator', 'summarizer') */
  module: z.string().optional(),
  /** Tool name if called via tool (e.g., 'web-search', 'calculator') */
  tool: z.string().optional(),

  // === MODEL INFO ===

  /** Model used (e.g., 'gpt-4o-mini', 'claude-haiku-4-5') */
  model: z.string(),
  /** Provider (e.g., 'openai', 'anthropic', 'google-genai') */
  provider: z.string().optional(),

  // === OPTIONAL METADATA ===

  /** Response latency in milliseconds */
  durationMs: z.number().int().min(0).optional(),
  /** Additional service-specific context */
  metadata: z.record(z.string(), z.unknown()).optional(),

  // === I/O CONTENT (for debugging) ===

  /** System prompt used for this call */
  systemPrompt: z.string().optional(),
  /** Input messages (conversation history sent to model) */
  inputMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.string(),
        toolCallId: z.string().optional(),
      })
    )
    .optional(),
  /** Model response content */
  outputContent: z.string().optional(),
  /** Tool calls made by the model (if any) */
  outputToolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        args: z.unknown(),
      })
    )
    .optional(),
  /** Why the model stopped: 'stop' | 'tool_calls' | 'length' | 'error' */
  finishReason: z.string().optional(),
  /** Error message if the call failed */
  errorMessage: z.string().optional(),
});

export type UsageContext = z.infer<typeof UsageContextSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create an empty TokenUsage object
 */
export function emptyTokenUsage(): TokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUSD: 0,
  };
}

/**
 * Add two TokenUsage objects together
 */
export function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    costUSD: (a.costUSD ?? 0) + (b.costUSD ?? 0),
  };
}

/**
 * Create an empty AggregatedUsage object
 */
export function emptyAggregatedUsage(): AggregatedUsage {
  return {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUSD: 0,
    callCount: 0,
  };
}

/**
 * Add TokenUsage to AggregatedUsage
 */
export function aggregateUsage(
  aggregated: AggregatedUsage,
  usage: TokenUsage
): AggregatedUsage {
  return {
    totalPromptTokens: aggregated.totalPromptTokens + usage.promptTokens,
    totalCompletionTokens: aggregated.totalCompletionTokens + usage.completionTokens,
    totalTokens: aggregated.totalTokens + usage.totalTokens,
    totalCostUSD: aggregated.totalCostUSD + (usage.costUSD ?? 0),
    callCount: aggregated.callCount + 1,
  };
}
