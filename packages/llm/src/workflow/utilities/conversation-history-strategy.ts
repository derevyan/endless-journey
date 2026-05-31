/**
 * Conversation History Strategy
 *
 * Applies history management strategies to conversation messages.
 * Supports: simple truncation, sliding window, and summarization.
 *
 * @module workflow/utilities/conversation-history-strategy
 */

import type { ConversationHistoryConfig, ConversationMessage } from "@journey/schemas";
import { llmConfig } from "@journey/schemas";
import { createLogger, serializeError } from "@journey/logger";

import { generateChatResponse } from "../../services/llm-service";

const log = createLogger("llm:history-strategy");

// =============================================================================
// TYPES
// =============================================================================

export interface HistoryStrategyResult {
  /** Processed messages after strategy application */
  messages: ConversationMessage[];
  /** Whether a summary was generated (only true for "summarize" strategy) */
  summaryGenerated: boolean;
  /** Original message count before processing */
  originalCount: number;
  /** Which strategy was applied */
  appliedStrategy: "passthrough" | "none" | "simple" | "sliding_window" | "summarize" | "unknown";
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Applies a conversation history strategy to messages.
 *
 * This is the core function that connects config.history to actual message filtering.
 * Called by AgentNodeExecutor before passing messages to the LLM.
 *
 * @param messages - Raw conversation history messages
 * @param config - History configuration from AgentNodeConfig
 * @returns Processed messages with strategy result metadata
 *
 * @example
 * // Simple strategy - keeps last 5 messages
 * const result = await applyConversationHistoryStrategy(messages, {
 *   strategy: "simple",
 *   maxMessages: 5
 * });
 *
 * @example
 * // Summarize strategy - generates summary for older messages
 * const result = await applyConversationHistoryStrategy(messages, {
 *   strategy: "summarize",
 *   maxMessages: 10,
 *   summarizeAfter: 20
 * });
 */
export async function applyConversationHistoryStrategy(
  messages: ConversationMessage[],
  config: ConversationHistoryConfig | undefined
): Promise<HistoryStrategyResult> {
  const originalCount = messages.length;

  // No config = return all messages (passthrough)
  if (!config) {
    log.debug({ originalCount }, "history:noConfig");
    return {
      messages,
      summaryGenerated: false,
      originalCount,
      appliedStrategy: "passthrough",
    };
  }

  const { strategy = "simple", maxMessages = 12, summarizeAfter } = config;

  log.debug({ strategy, maxMessages, summarizeAfter, originalCount }, "history:applyStrategy");

  switch (strategy) {
    case "none":
      // Stateless mode: send no history at all
      log.debug({ originalCount }, "history:none:stateless");
      return {
        messages: [],
        summaryGenerated: false,
        originalCount,
        appliedStrategy: "none",
      };

    case "simple":
      return applySimpleStrategy(messages, maxMessages, originalCount);

    case "sliding_window":
      return applySlidingWindowStrategy(messages, maxMessages, originalCount);

    case "summarize":
      return applySummarizeStrategy(messages, maxMessages, summarizeAfter, originalCount);

    default:
      log.warn({ strategy }, "history:unknownStrategy");
      return {
        messages,
        summaryGenerated: false,
        originalCount,
        appliedStrategy: "unknown",
      };
  }
}

// =============================================================================
// STRATEGY IMPLEMENTATIONS
// =============================================================================

/**
 * Simple strategy: Keep the last N messages.
 *
 * This is the most common strategy. It simply truncates older messages
 * when the count exceeds maxMessages.
 */
function applySimpleStrategy(
  messages: ConversationMessage[],
  maxMessages: number,
  originalCount: number
): HistoryStrategyResult {
  if (messages.length <= maxMessages) {
    return {
      messages,
      summaryGenerated: false,
      originalCount,
      appliedStrategy: "simple",
    };
  }

  const truncated = messages.slice(-maxMessages);

  log.debug(
    { originalCount, keptCount: truncated.length, droppedCount: originalCount - truncated.length },
    "history:simple:truncated"
  );

  return {
    messages: truncated,
    summaryGenerated: false,
    originalCount,
    appliedStrategy: "simple",
  };
}

/**
 * Sliding window strategy: Keep the last N messages.
 *
 * Currently identical to simple strategy.
 * Can be extended to support overlap/stride options in the future.
 */
function applySlidingWindowStrategy(
  messages: ConversationMessage[],
  maxMessages: number,
  originalCount: number
): HistoryStrategyResult {
  if (messages.length <= maxMessages) {
    return {
      messages,
      summaryGenerated: false,
      originalCount,
      appliedStrategy: "sliding_window",
    };
  }

  const windowed = messages.slice(-maxMessages);

  log.debug(
    { originalCount, keptCount: windowed.length, droppedCount: originalCount - windowed.length },
    "history:slidingWindow:windowed"
  );

  return {
    messages: windowed,
    summaryGenerated: false,
    originalCount,
    appliedStrategy: "sliding_window",
  };
}

/**
 * Summarize strategy: Generate a summary of older messages.
 *
 * When message count exceeds summarizeAfter (or maxMessages if not set),
 * older messages are summarized into a single system message and prepended
 * to the most recent messages.
 *
 * Falls back to simple truncation if summarization fails.
 */
async function applySummarizeStrategy(
  messages: ConversationMessage[],
  maxMessages: number,
  summarizeAfter: number | undefined,
  originalCount: number
): Promise<HistoryStrategyResult> {
  const trigger = summarizeAfter ?? maxMessages;

  if (messages.length <= trigger) {
    return {
      messages,
      summaryGenerated: false,
      originalCount,
      appliedStrategy: "summarize",
    };
  }

  // Keep half of maxMessages as recent context, summarize the rest
  const keepCount = Math.max(Math.floor(maxMessages / 2), llmConfig.summarization.keepMessages);
  const toSummarize = messages.slice(0, -keepCount);
  const toKeep = messages.slice(-keepCount);

  log.debug(
    { originalCount, summarizeCount: toSummarize.length, keepCount: toKeep.length },
    "history:summarize:preparing"
  );

  try {
    const summary = await generateConversationSummary(toSummarize);

    const summaryMessage: ConversationMessage = {
      role: "system",
      content: `[Previous conversation summary]\n${summary}`,
      timestamp: new Date(),
    };

    log.info(
      {
        originalCount,
        summarizedCount: toSummarize.length,
        keptCount: toKeep.length,
        summaryLength: summary.length,
      },
      "history:summarize:success"
    );

    return {
      messages: [summaryMessage, ...toKeep],
      summaryGenerated: true,
      originalCount,
      appliedStrategy: "summarize",
    };
  } catch (error) {
    log.error(
      { err: serializeError(error), originalCount, keepCount },
      "history:summarize:failed"
    );

    // Fallback to simple truncation on error
    return applySimpleStrategy(messages, maxMessages, originalCount);
  }
}

// =============================================================================
// SUMMARIZATION HELPER
// =============================================================================

/**
 * Generates a concise summary of conversation messages.
 *
 * Uses a fast, cheap model (llama-3.1-8b-instant via Groq) for summarization.
 * Preserves key facts, user preferences, decisions, and current context.
 */
async function generateConversationSummary(messages: ConversationMessage[]): Promise<string> {
  // Filter out system messages and format for summarization
  const formatted = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const prompt = `Summarize this conversation in 2-4 sentences, preserving:
1. Key facts and information shared
2. User preferences and requirements
3. Important decisions or outcomes
4. Current conversation context

Conversation:
${formatted}

Summary:`;

  const response = await generateChatResponse(
    "You are a concise conversation summarizer. Provide brief, factual summaries.",
    [{ role: "user", content: prompt }],
    {
      model: llmConfig.summarization.model.id,
      provider: llmConfig.summarization.model.provider,
      temperature: llmConfig.summarization.temperature,
      maxTokens: 300,
    }
  );

  return response.result;
}
