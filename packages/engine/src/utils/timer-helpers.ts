/**
 * Timer Helper Functions
 *
 * Standardized utilities for scheduling timers and capturing timer metadata.
 * Eliminates duplication of timer scheduling logic and provides consistent
 * logging and metadata generation.
 *
 * Used by: message-handler, wait-handler, agent-handler, questionnaire-handler
 */

import type { ExecutionContext } from "../types";

/**
 * Complete timer metadata structure
 *
 * Captures all relevant timing information for observability and analytics.
 */
export interface TimerMetadata {
  timerId: string;
  delayMs: number;
  scheduledAt: string;
  expectedCompletionAt: string;
}

/**
 * Schedule timer and return complete metadata for storage
 *
 * Encapsulates timer scheduling, logging, and metadata generation.
 * Returns null for invalid durations to allow handlers to skip timer logic.
 *
 * @param context - Execution context with services and logging
 * @param seconds - Duration in seconds (converted to milliseconds)
 * @param edgeId - ID of the edge to transition when timer expires
 * @param logPrefix - Prefix for log messages (e.g., "message", "wait")
 * @returns Timer metadata object or null if seconds <= 0
 *
 * @example
 * const timerMeta = await scheduleTimerWithMetadata(
 *   context,
 *   5,
 *   "edge-123",
 *   "message"
 * );
 * // Returns: {
 * //   timerId: "...",
 * //   delayMs: 5000,
 * //   scheduledAt: "2024-01-15T10:30:45.123Z",
 * //   expectedCompletionAt: "2024-01-15T10:30:50.123Z"
 * // }
 */
export async function scheduleTimerWithMetadata(
  context: ExecutionContext,
  seconds: number,
  edgeId: string,
  logPrefix: string = "timer"
): Promise<TimerMetadata | null> {
  // Skip timer scheduling for zero or negative durations
  if (seconds <= 0) {
    return null;
  }

  const delayMs = seconds * 1000;
  const timerId = await context.services.timer.scheduleTimer(delayMs, edgeId);
  const now = new Date();
  const expectedCompletion = new Date(now.getTime() + delayMs);

  // Log timer scheduling for observability
  context.log.info(
    {
      nodeId: context.node.id,
      delayMs,
      edgeId,
      timerId,
      scheduledAt: now.toISOString(),
      expectedCompletionAt: expectedCompletion.toISOString(),
    },
    `${logPrefix}:timerScheduled`
  );

  return {
    timerId,
    delayMs,
    scheduledAt: now.toISOString(),
    expectedCompletionAt: expectedCompletion.toISOString(),
  };
}
