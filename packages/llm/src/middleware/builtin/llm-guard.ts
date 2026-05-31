/**
 * LLM Guard Middleware
 *
 * Checks user input against specialized safety guard models BEFORE
 * the agent processes the request. Follows the Question Understanding
 * worker pattern with parallel execution.
 *
 * Priority: 3 (runs FIRST, before model fallback at 5 and PII at 10)
 *
 * Available guards (via llmConfig.guards.workers):
 * - safety: meta-llama/llama-guard-4-12b - Violence, hate, sexual, illegal
 * - policy: openai/gpt-oss-safeguard-20b - Policy violations
 * - injection: meta-llama/llama-prompt-guard-2-86m - Prompt injection attacks
 * - spam: llama-3.1-8b-instant - Spam, advertising, scams (few-shot)
 *
 * @example
 * ```typescript
 * // Uses llmConfig.guards.workers as default
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [createLLMGuardMiddleware()],
 * });
 *
 * // Custom workers
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     createLLMGuardMiddleware({
 *       workers: [
 *         { id: "safety", model: "meta-llama/llama-guard-4-12b", provider: "groq" },
 *         { id: "spam", model: "llama-3.1-8b-instant", provider: "groq" },
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */

import { z } from "zod";
import { createMiddleware } from "../create-middleware";
import { createLogger } from "@journey/logger";
import { GUARD_WORKERS, GUARDS_CONFIG, type LLMGuardWorkerConfig } from "@journey/schemas/config";
import type { ConversationMessage } from "../types";

// Adapter to convert LLMGuardWorkerConfig to the expected format
function toGuardWorkerConfig(worker: LLMGuardWorkerConfig): Record<string, any> {
  return {
    id: worker.id,
    model: worker.model.id,
    provider: worker.model.provider,
    enabled: worker.enabled,
  };
}
import {
  evaluateGuards,
  type GuardEvaluationResult,
} from "../../services/guard-service";

const log = createLogger("llm:middleware:llm-guard");

// ============================================================================
// Types
// ============================================================================

export interface LLMGuardMiddlewareConfig {
  /**
   * Guard workers to use (defaults to GUARD_WORKERS from new config)
   * Each worker runs in parallel - if ANY blocks, request is denied
   */
  workers?: Record<string, any>[];

  /**
   * Timeout per guard call in milliseconds
   * @default llmConfig.guards.workerTimeoutMs
   */
  workerTimeoutMs?: number;

  /**
   * Message to return when safety/policy/injection guard blocks
   * @default llmConfig.guards.blockedMessage
   */
  blockedMessage?: string;

  /**
   * Message to return when spam guard blocks (friendlier)
   * @default llmConfig.guards.spamBlockedMessage
   */
  spamBlockedMessage?: string;
}

// ============================================================================
// State Schema
// ============================================================================

/**
 * Custom state fields added by this middleware
 */
const llmGuardStateSchema = z.object({
  /** Whether content was blocked by guards */
  llmGuardBlocked: z.boolean().default(false),
  /** Which worker IDs blocked (if any) */
  llmGuardBlockedBy: z.array(z.string()).optional(),
  /** Whether it was specifically a spam block */
  llmGuardIsSpamBlock: z.boolean().optional(),
  /** Guard evaluation result for logging/debugging */
  llmGuardResult: z.unknown().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract the last user message from conversation
 */
function getLastUserMessage(messages: ConversationMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content;
    }
  }
  return null;
}

/**
 * Get conversation context (last few messages for context)
 */
function getConversationContext(
  messages: ConversationMessage[],
  maxMessages = 4
): string {
  // Get messages before the last one (which is the current user message)
  const contextMessages = messages.slice(-maxMessages - 1, -1);
  if (contextMessages.length === 0) return "";

  return contextMessages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create an LLM Guard middleware
 *
 * Evaluates user input with guard workers in parallel BEFORE agent processes it.
 * If ANY guard flags the content as unsafe, the request is blocked.
 *
 * Uses beforeAgent hook (priority 3) to check before ANY processing.
 *
 * @param config - Guard configuration (uses llmConfig.guards as defaults)
 *
 * @example Basic usage with default guards
 * ```typescript
 * createLLMGuardMiddleware()
 * ```
 *
 * @example Custom blocked messages
 * ```typescript
 * createLLMGuardMiddleware({
 *   blockedMessage: "I'm unable to assist with this request.",
 *   spamBlockedMessage: "Let me help you with a genuine question instead.",
 * })
 * ```
 */
export function createLLMGuardMiddleware(
  config: LLMGuardMiddlewareConfig = {}
): ReturnType<typeof createMiddleware> {
  const {
    workers = GUARD_WORKERS.map(toGuardWorkerConfig),
    workerTimeoutMs = GUARDS_CONFIG.workerTimeoutMs,
    blockedMessage = GUARDS_CONFIG.blockedMessage,
    spamBlockedMessage = GUARDS_CONFIG.spamBlockedMessage,
  } = config;

  // Filter to enabled workers only
  const enabledWorkers = workers.filter((w) => w.enabled !== false);

  if (enabledWorkers.length === 0) {
    throw new Error("LLMGuardMiddleware requires at least one enabled guard worker");
  }

  return createMiddleware({
    name: "LLMGuardMiddleware",
    priority: 3, // Run very early, BEFORE model fallback (5) and PII (10)
    stateSchema: llmGuardStateSchema,

    // Use beforeAgent to check BEFORE any processing
    beforeAgent: async (state, runtime) => {
      // Get the user message to evaluate
      const userMessage = getLastUserMessage(state.messages);

      if (!userMessage) {
        log.debug(
          { nodeId: runtime.nodeId, sessionId: runtime.sessionId },
          "middleware:llmGuard:noUserMessage"
        );
        return undefined; // No user message, nothing to guard
      }

      // Get conversation context for better evaluation
      const context = getConversationContext(state.messages);

      log.debug(
        {
          workerCount: enabledWorkers.length,
          workers: enabledWorkers.map((w) => w.id),
          userMessageLength: userMessage.length,
          hasContext: context.length > 0,
          nodeId: runtime.nodeId,
        },
        "middleware:llmGuard:evaluating"
      );

      // Evaluate with all guard workers in parallel
      let result: GuardEvaluationResult;
      try {
        result = await evaluateGuards({
          workers: enabledWorkers,
          workerTimeoutMs,
          content: userMessage,
          conversationContext: context || undefined,
          organizationId: runtime.orgId,
        });
      } catch (err) {
        // On evaluation error, fail-open to avoid blocking due to guard issues
        log.error(
          { err, nodeId: runtime.nodeId },
          "middleware:llmGuard:evaluationError"
        );
        return {
          llmGuardBlocked: false,
          llmGuardResult: { error: "Evaluation failed" },
        };
      }

      // If allowed, continue normally
      if (result.allowed) {
        log.debug(
          {
            totalProcessingTimeMs: result.totalProcessingTimeMs,
            nodeId: runtime.nodeId,
          },
          "middleware:llmGuard:allowed"
        );
        return {
          llmGuardBlocked: false,
          llmGuardResult: result,
        };
      }

      // Content was BLOCKED by at least one guard
      log.warn(
        {
          blockedBy: result.blockedBy,
          isSpamBlock: result.isSpamBlock,
          totalProcessingTimeMs: result.totalProcessingTimeMs,
          nodeId: runtime.nodeId,
          sessionId: runtime.sessionId,
        },
        "middleware:llmGuard:blocked"
      );

      // Select appropriate message based on block type
      const responseMessage = result.isSpamBlock ? spamBlockedMessage : blockedMessage;

      // Silent strategy: Add safe response and end execution
      return {
        llmGuardBlocked: true,
        llmGuardBlockedBy: result.blockedBy,
        llmGuardIsSpamBlock: result.isSpamBlock,
        llmGuardResult: result,
        // Add the blocked message as assistant response
        messages: [
          ...state.messages,
          { role: "assistant" as const, content: responseMessage, timestamp: new Date() },
        ],
        // Signal to end agent execution immediately
        jumpTo: "end" as const,
      };
    },
  });
}
