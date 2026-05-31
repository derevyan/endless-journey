/**
 * LLM Truncation Utilities
 *
 * Shared helpers for truncating LLM data in reports.
 * Used by both conversation-builder and workflow-builder.
 *
 * @module @journey/ai-report/builders/shared/llm-truncation
 */

import type { ReportOptions } from "../../schemas";

/**
 * Input message format from LLM usage events.
 */
export interface LLMInputMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
}

/**
 * Result of applying truncation rules to system prompt.
 */
export interface SystemPromptTruncationResult {
  /** Truncated system prompt (or undefined if excluded) */
  systemPrompt: string | undefined;
  /** Whether the prompt was truncated */
  systemPromptTruncated: boolean;
}

/**
 * Apply truncation rules to a system prompt.
 *
 * @param systemPrompt - Original system prompt (can be null/undefined)
 * @param maxChars - Max characters (0 = exclude, undefined = no limit)
 * @returns Truncation result with prompt and truncated flag
 *
 * @example
 * ```typescript
 * const { systemPrompt, systemPromptTruncated } = truncateSystemPrompt(
 *   event.systemPrompt,
 *   options.systemPromptMaxChars
 * );
 * ```
 */
export function truncateSystemPrompt(
  systemPrompt: string | null | undefined,
  maxChars: number | undefined
): SystemPromptTruncationResult {
  let result = systemPrompt || undefined;
  let truncated = false;

  if (result && maxChars && maxChars > 0) {
    if (result.length > maxChars) {
      result = result.substring(0, maxChars) + "... [truncated]";
      truncated = true;
    }
  } else if (maxChars === 0) {
    // If set to 0, exclude system prompt entirely
    result = undefined;
  }

  return { systemPrompt: result, systemPromptTruncated: truncated };
}

/**
 * Apply truncation rules to input messages.
 *
 * @param messages - Original input messages (can be null/undefined)
 * @param maxChars - Max characters per message content (undefined = no limit)
 * @param include - Whether to include messages at all
 * @returns Truncated messages or undefined if excluded
 *
 * @example
 * ```typescript
 * const inputMessages = truncateInputMessages(
 *   event.inputMessages,
 *   options.conversationHistoryMaxChars,
 *   options.includeInputMessages && options.includeLLMDetails
 * );
 * ```
 */
export function truncateInputMessages<T extends LLMInputMessage>(
  messages: T[] | null | undefined,
  maxChars: number | undefined,
  include: boolean = true
): T[] | undefined {
  if (!include || !messages) {
    return undefined;
  }

  if (!maxChars || maxChars <= 0) {
    return messages;
  }

  return messages.map((msg) => {
    if (msg.content.length > maxChars) {
      return {
        ...msg,
        content: msg.content.substring(0, maxChars) + "... [truncated]",
      };
    }
    return msg;
  });
}

/**
 * Combined truncation helper for common LLM data patterns.
 *
 * @param event - LLM usage event with systemPrompt and inputMessages
 * @param options - Report options with truncation settings
 * @returns Truncated data ready for report building
 */
export function applyLLMTruncationRules(
  event: {
    systemPrompt: string | null;
    inputMessages: LLMInputMessage[] | null;
  },
  options: ReportOptions
): {
  systemPrompt: string | undefined;
  systemPromptTruncated: boolean;
  inputMessages: LLMInputMessage[] | undefined;
} {
  const { systemPromptMaxChars, conversationHistoryMaxChars, includeInputMessages = true, includeLLMDetails = true } =
    options;

  const { systemPrompt, systemPromptTruncated } = truncateSystemPrompt(event.systemPrompt, systemPromptMaxChars);

  const inputMessages = truncateInputMessages(
    event.inputMessages,
    conversationHistoryMaxChars,
    includeInputMessages && includeLLMDetails
  );

  return {
    systemPrompt: includeLLMDetails ? systemPrompt : undefined,
    systemPromptTruncated,
    inputMessages,
  };
}
