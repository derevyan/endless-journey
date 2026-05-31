/**
 * Model Call Limit Middleware
 *
 * Limits the number of model calls to prevent infinite loops or excessive costs.
 * Follows LangChain's ModelCallLimitMiddleware API.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#model-call-limit
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     createModelCallLimitMiddleware({
 *       runLimit: 10,
 *       exitBehavior: "end",
 *     }),
 *   ],
 * });
 * ```
 */

import { z } from "zod";
import { createMiddleware } from "../create-middleware";
import { createLogger } from "@journey/logger";
import { getStateNumber } from "../utils";

const log = createLogger("llm:middleware:model-call-limit");

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for Model Call Limit middleware
 */
export interface ModelCallLimitConfig {
  /**
   * Maximum model calls per single invocation (run)
   * Resets with each new agent invocation.
   * @default undefined (no run limit)
   */
  runLimit?: number;

  /**
   * Maximum model calls across all runs in a thread
   * Persists across multiple invocations with the same thread.
   * Requires state persistence (checkpointer) to work correctly.
   * @default undefined (no thread limit)
   */
  threadLimit?: number;

  /**
   * Behavior when limit is reached
   * - "end": Gracefully terminate agent (return current state)
   * - "error": Throw an error
   * @default "end"
   */
  exitBehavior?: "end" | "error";

  /**
   * Custom message when limit is reached
   */
  limitMessage?: string;
}

// ============================================================================
// State Schema
// ============================================================================

const modelCallLimitStateSchema = z.object({
  /** Model call count for current run */
  _mwModelCallCount: z.number().default(0),

  /** Model call count across thread (persisted) */
  _mwThreadModelCallCount: z.number().default(0),
});

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a Model Call Limit middleware
 *
 * Prevents runaway agents by limiting model calls per run and/or across threads.
 *
 * @example Basic usage
 * ```typescript
 * // Limit to 10 calls per run
 * createModelCallLimitMiddleware({ runLimit: 10 })
 * ```
 *
 * @example With thread limit
 * ```typescript
 * // Limit to 10 per run, 50 total across thread
 * createModelCallLimitMiddleware({
 *   runLimit: 10,
 *   threadLimit: 50,
 * })
 * ```
 *
 * @example Throw error on limit
 * ```typescript
 * createModelCallLimitMiddleware({
 *   runLimit: 5,
 *   exitBehavior: "error",
 * })
 * ```
 */
export function createModelCallLimitMiddleware(config: ModelCallLimitConfig) {
  const { runLimit, threadLimit, exitBehavior = "end", limitMessage } = config;

  if (runLimit === undefined && threadLimit === undefined) {
    throw new Error(
      "ModelCallLimitMiddleware requires at least one of runLimit or threadLimit"
    );
  }

  return createMiddleware({
    name: "ModelCallLimitMiddleware",
    priority: 20, // Run after input processing, before tool injection
    stateSchema: modelCallLimitStateSchema,

    beforeModel: (state) => {
      const runCount = getStateNumber(state, "_mwModelCallCount");
      const threadCount = getStateNumber(state, "_mwThreadModelCallCount");

      // Check run limit
      if (runLimit !== undefined && runCount >= runLimit) {
        const message =
          limitMessage || `Model call limit (${runLimit} per run) reached`;

        log.warn(
          { runCount, runLimit, threadCount, threadLimit },
          "middleware:modelCallLimit:runLimitReached"
        );

        if (exitBehavior === "error") {
          throw new Error(message);
        }

        return { jumpTo: "end" as const };
      }

      // Check thread limit
      if (threadLimit !== undefined && threadCount >= threadLimit) {
        const message =
          limitMessage || `Model call limit (${threadLimit} per thread) reached`;

        log.warn(
          { runCount, runLimit, threadCount, threadLimit },
          "middleware:modelCallLimit:threadLimitReached"
        );

        if (exitBehavior === "error") {
          throw new Error(message);
        }

        return { jumpTo: "end" as const };
      }

      log.trace(
        { runCount, runLimit, threadCount, threadLimit },
        "middleware:modelCallLimit:check:passed"
      );
    },

    afterModel: (state) => {
      // Increment counters after successful model call
      const runCount = getStateNumber(state, "_mwModelCallCount");
      const threadCount = getStateNumber(state, "_mwThreadModelCallCount");

      log.trace(
        {
          newRunCount: runCount + 1,
          newThreadCount: threadCount + 1,
        },
        "middleware:modelCallLimit:increment"
      );

      return {
        _mwModelCallCount: runCount + 1,
        _mwThreadModelCallCount: threadCount + 1,
      };
    },
  });
}
