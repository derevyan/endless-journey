/**
 * Summarization Middleware
 *
 * Compresses long conversation histories by generating summaries of older messages.
 * Follows LangChain's SummarizationMiddleware API.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#summarization
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     createSummarizationMiddleware({
 *       model: "gpt-4o-mini",           // Fast model for summaries
 *       trigger: { messages: 20 },       // Summarize after 20 messages
 *       keep: { messages: 6 },           // Always keep last 6 messages
 *     }),
 *   ],
 * });
 * ```
 */

import { z } from "zod";
import { createMiddleware } from "../create-middleware";
import { generateChatResponse } from "../../services/llm-service";
import { createLogger, serializeError } from "@journey/logger";
import { getStateNumber, getStateString } from "../utils";
import type { ConversationMessage } from "../types";

const log = createLogger("llm:middleware:summarization");

// ============================================================================
// Types
// ============================================================================

/**
 * Trigger conditions for when to summarize
 * Only one needs to be met
 */
export interface SummarizationTrigger {
  /**
   * Summarize when total message count exceeds this
   */
  messages?: number;

  /**
   * Summarize when estimated token count exceeds this
   */
  tokens?: number;

  /**
   * Summarize when context usage exceeds this fraction (0-1)
   * Requires knowing the model's context window
   */
  fraction?: number;
}

/**
 * What to keep after summarization
 */
export interface SummarizationKeep {
  /**
   * Keep this many recent messages verbatim
   */
  messages?: number;

  /**
   * Keep messages that fit within this token budget
   */
  tokens?: number;

  /**
   * Keep this fraction of the context window for recent messages (0-1)
   */
  fraction?: number;
}

/**
 * Configuration for Summarization middleware
 */
export interface SummarizationMiddlewareConfig {
  /**
   * Model to use for generating summaries
   * Recommend using a fast, cheap model like gpt-4o-mini
   */
  model: string;

  /**
   * Conditions that trigger summarization
   * At least one condition must be specified
   */
  trigger: SummarizationTrigger;

  /**
   * What to preserve after summarization
   * @default { messages: 6 }
   */
  keep?: SummarizationKeep;

  /**
   * Custom prompt for summarization
   * Use {messages} placeholder for the messages to summarize
   * Use {previous_summary} placeholder for existing summary (if any)
   */
  summaryPrompt?: string;

  /**
   * Prefix added to summary when inserted as system message
   * @default "[Summary of previous conversation]\n"
   */
  summaryPrefix?: string;

  /**
   * Maximum tokens for generated summary
   * @default 400
   */
  summaryMaxTokens?: number;

  /**
   * Temperature for summary generation
   * Lower = more deterministic/factual
   * @default 0.3
   */
  summaryTemperature?: number;

  /**
   * Context window size of the primary model (for fraction-based triggers)
   * @default 128000 (gpt-4o default)
   */
  contextWindow?: number;

  /**
   * Preserve original system messages (persona, instructions, tool context)
   * When true, original system messages are prepended before the summary.
   * @default true
   */
  preserveSystemMessages?: boolean;
}

// ============================================================================
// State Schema
// ============================================================================

/**
 * State schema for tracking summarization across turns
 */
const summarizationStateSchema = z.object({
  /** Rolling summary of older conversation */
  _mwConversationSummary: z.string().optional(),

  /** Index up to which messages have been summarized */
  _mwSummarizedUpToIndex: z.number().default(0),

  /** When summarization last occurred */
  _mwLastSummarizedAt: z.string().optional(),
});

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for messages
 *
 * Uses heuristic: ~4 characters per token + overhead per message.
 * This approximation works reasonably well for most English text.
 */
function estimateTokenCount(messages: ConversationMessage[]): number {
  return messages.reduce((total, msg) => {
    // ~4 chars per token + 10 tokens overhead per message (role, formatting)
    return total + Math.ceil(msg.content.length / 4) + 10;
  }, 0);
}

// ============================================================================
// Summarization Logic
// ============================================================================

const DEFAULT_SUMMARY_PROMPT = `Summarize this conversation concisely in 2-4 sentences, preserving:
1. Key facts and information shared by the user
2. User preferences and requirements mentioned
3. Important decisions or outcomes reached
4. Current context and conversation state

Keep it objective and factual. Focus on information essential to continue the conversation.

{previous_summary}

Messages to summarize:
{messages}

Summary:`;

/**
 * Check if summarization should be triggered
 */
function shouldSummarize(
  messages: ConversationMessage[],
  config: SummarizationMiddlewareConfig,
  summarizedUpToIndex: number
): boolean {
  const { trigger, keep = { messages: 6 }, contextWindow = 128000 } = config;

  // Calculate unsummarized message count
  const unsummarizedCount = messages.length - summarizedUpToIndex;

  // Don't summarize if we don't have enough new messages
  const keepMessages = keep.messages || 6;
  if (unsummarizedCount <= keepMessages) {
    return false;
  }

  // Check message count trigger
  if (trigger.messages && messages.length >= trigger.messages) {
    log.trace(
      { messageCount: messages.length, trigger: trigger.messages },
      "middleware:summarization:triggerMet:messages"
    );
    return true;
  }

  // Check token count trigger
  if (trigger.tokens) {
    const tokenCount = estimateTokenCount(messages);
    if (tokenCount >= trigger.tokens) {
      log.trace(
        { tokenCount, trigger: trigger.tokens },
        "middleware:summarization:triggerMet:tokens"
      );
      return true;
    }
  }

  // Check fraction trigger
  if (trigger.fraction) {
    const tokenCount = estimateTokenCount(messages);
    const fractionUsed = tokenCount / contextWindow;
    if (fractionUsed >= trigger.fraction) {
      log.trace(
        { fractionUsed, trigger: trigger.fraction },
        "middleware:summarization:triggerMet:fraction"
      );
      return true;
    }
  }

  return false;
}

/**
 * Generate a summary of messages
 */
async function generateSummary(
  messages: ConversationMessage[],
  existingSummary: string | undefined,
  config: SummarizationMiddlewareConfig,
  keepCount: number
): Promise<string> {
  // Get messages to summarize (all except the ones we're keeping)
  const messagesToSummarize = messages.slice(0, -keepCount);
  if (messagesToSummarize.length === 0) {
    return existingSummary || "";
  }

  // Format messages for summarization
  const formatted = messagesToSummarize
    .filter((m) => m.role !== "system") // Skip system messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  // Build prompt
  const previousSummarySection = existingSummary
    ? `Previous summary (incorporate this context):\n${existingSummary}\n`
    : "";

  const prompt = (config.summaryPrompt || DEFAULT_SUMMARY_PROMPT)
    .replace("{messages}", formatted)
    .replace("{previous_summary}", previousSummarySection);

  log.debug(
    {
      messageCount: messagesToSummarize.length,
      hasExistingSummary: !!existingSummary,
    },
    "middleware:summarization:generating"
  );

  const response = await generateChatResponse(
    "You are a concise summarizer. Create factual, objective summaries that preserve important context.",
    [{ role: "user", content: prompt }],
    {
      model: config.model,
      temperature: config.summaryTemperature ?? 0.3,
      maxTokens: config.summaryMaxTokens ?? 400,
    }
  );

  log.debug(
    { summaryLength: response.result.length },
    "middleware:summarization:generated"
  );

  return response.result;
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a Summarization middleware
 *
 * Automatically compresses conversation history when it grows too long.
 * Generates rolling summaries of older messages while keeping recent ones intact.
 *
 * @param config - Summarization configuration
 *
 * @example Basic usage with message trigger
 * ```typescript
 * createSummarizationMiddleware({
 *   model: "gpt-4o-mini",
 *   trigger: { messages: 20 },
 *   keep: { messages: 6 },
 * })
 * ```
 *
 * @example Token-based trigger
 * ```typescript
 * createSummarizationMiddleware({
 *   model: "gpt-4o-mini",
 *   trigger: { tokens: 4000 },
 *   keep: { tokens: 1000 },
 * })
 * ```
 *
 * @example Fraction-based trigger
 * ```typescript
 * createSummarizationMiddleware({
 *   model: "gpt-4o-mini",
 *   trigger: { fraction: 0.8 },   // Summarize at 80% context usage
 *   keep: { fraction: 0.2 },      // Keep 20% for recent messages
 *   contextWindow: 128000,
 * })
 * ```
 *
 * @example Custom summary prompt
 * ```typescript
 * createSummarizationMiddleware({
 *   model: "gpt-4o-mini",
 *   trigger: { messages: 15 },
 *   summaryPrompt: "Create a brief summary:\n{messages}",
 *   summaryPrefix: "[Context]\n",
 * })
 * ```
 */
export function createSummarizationMiddleware(
  config: SummarizationMiddlewareConfig
): ReturnType<typeof createMiddleware> {
  const {
    trigger,
    keep = { messages: 6 },
    summaryPrefix = "[Summary of previous conversation]\n",
    preserveSystemMessages = true,
  } = config;

  // Validate config
  if (!trigger.messages && !trigger.tokens && !trigger.fraction) {
    throw new Error(
      "SummarizationMiddleware requires at least one trigger condition (messages, tokens, or fraction)"
    );
  }

  return createMiddleware({
    name: "SummarizationMiddleware",
    priority: 15, // Run after PII detection, before model call limits
    stateSchema: summarizationStateSchema,

    beforeModel: async (state) => {
      // Get state values
      const existingSummary = getStateString(state, "_mwConversationSummary") || undefined;
      const summarizedUpToIndex = getStateNumber(state, "_mwSummarizedUpToIndex");

      // Extract original system messages (persona, instructions, tool context)
      const originalSystemMessages = preserveSystemMessages
        ? state.messages.filter((m) => m.role === "system")
        : [];

      // Filter to non-system messages for processing
      const messages = state.messages.filter((m) => m.role !== "system");

      // Check if summarization is needed
      if (!shouldSummarize(messages, config, summarizedUpToIndex)) {
        // No summarization needed, but prepend existing summary if we have one
        if (existingSummary) {
          const summaryMessage: ConversationMessage = {
            role: "system",
            content: summaryPrefix + existingSummary,
            timestamp: new Date(),
          };

          const keepMessages = keep.messages || 6;
          const recentMessages = messages.slice(-keepMessages);

          log.trace(
            {
              hasExistingSummary: true,
              recentCount: recentMessages.length,
              preservedSystemCount: originalSystemMessages.length,
            },
            "middleware:summarization:prependExisting"
          );

          // Preserve: original system messages → summary → recent messages
          return {
            messages: [...originalSystemMessages, summaryMessage, ...recentMessages],
          };
        }

        return undefined;
      }

      // Perform summarization
      try {
        const keepMessages = keep.messages || 6;

        const newSummary = await generateSummary(
          messages,
          existingSummary,
          config,
          keepMessages
        );

        // Keep only recent messages
        const recentMessages = messages.slice(-keepMessages);

        // Create summary message
        const summaryMessage: ConversationMessage = {
          role: "system",
          content: summaryPrefix + newSummary,
          timestamp: new Date(),
        };

        log.info(
          {
            originalCount: messages.length,
            keptCount: recentMessages.length,
            summaryLength: newSummary.length,
            preservedSystemCount: originalSystemMessages.length,
          },
          "middleware:summarization:applied"
        );

        // Preserve: original system messages → summary → recent messages
        return {
          messages: [...originalSystemMessages, summaryMessage, ...recentMessages],
          _mwConversationSummary: newSummary,
          _mwSummarizedUpToIndex: messages.length - keepMessages,
          _mwLastSummarizedAt: new Date().toISOString(),
        };
      } catch (error) {
        // Summarization failed - log and continue without summarization
        log.error(
          { err: serializeError(error) },
          "middleware:summarization:failed"
        );

        // Fallback: just keep recent messages (with preserved system messages)
        const keepMessages = keep.messages || 6;
        const recentMessages = messages.slice(-keepMessages);

        return { messages: [...originalSystemMessages, ...recentMessages] };
      }
    },
  });
}
