/**
 * Retry utility with exponential backoff
 *
 * Provides a generic retry mechanism for operations that may fail transiently.
 * Uses exponential backoff with configurable attempts and delays.
 */

import { serializeError, type createLogger } from "@journey/logger";

type Logger = ReturnType<typeof createLogger>;

export interface RetryOptions<T = unknown> {
  /** Maximum number of attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (default: 4000) */
  maxDelayMs: number;
  /** Optional error mapper for thrown errors */
  onError?: (error: unknown, attempt: number) => T;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
};

let sleepScale = 1;

/**
 * Set a global scale factor for sleep durations (testing only).
 */
export function setSleepScale(scale: number): void {
  if (!Number.isFinite(scale) || scale < 0) {
    sleepScale = 1;
    return;
  }
  sleepScale = scale;
}

/**
 * Get the current sleep scale factor.
 */
export function getSleepScale(): number {
  return sleepScale;
}

/**
 * Apply a scale factor to a duration with an optional minimum.
 */
export function scaleDuration(ms: number, scale: number = sleepScale, minMs = 0): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const normalizedScale = Number.isFinite(scale) && scale >= 0 ? scale : 1;
  const scaled = Math.round(ms * normalizedScale);
  return Math.max(minMs, scaled);
}

/**
 * Execute an async function with retry logic
 *
 * @param fn - The async function to execute
 * @param isSuccess - Function to determine if the result is successful
 * @param options - Retry configuration options
 * @param log - Optional logger for retry events
 * @returns The result of the function (successful or last failed attempt)
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => adapter.sendMessage(userId, message),
 *   (r) => r.success,
 *   { maxAttempts: 3, baseDelayMs: 1000 },
 *   log
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isSuccess: (result: T) => boolean,
  options: Partial<RetryOptions<T>> = {},
  log?: Logger
): Promise<T> {
  const opts: RetryOptions<T> = {
    maxAttempts: options.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts,
    baseDelayMs: options.baseDelayMs ?? DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs: options.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs,
    onError: options.onError,
  };
  let lastResult: T | undefined;
  let lastError: unknown;
  let hasResult = false;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      lastResult = await fn();
      hasResult = true;
    } catch (error) {
      lastError = error;
      if (opts.onError) {
        try {
          lastResult = opts.onError(error, attempt);
          hasResult = true;
        } catch (handlerError) {
          lastError = handlerError;
        }
      }

      log?.warn(
        { attempt, totalAttempts: opts.maxAttempts, err: serializeError(error) },
        "retry:attemptFailed:error"
      );
    }

    if (hasResult && isSuccess(lastResult as T)) {
      if (attempt > 1) {
        log?.info({ attempt, totalAttempts: opts.maxAttempts }, "retry:succeededAfterRetry");
      }
      return lastResult as T;
    }

    if (attempt < opts.maxAttempts) {
      // Exponential backoff: baseDelay * 2^(attempt-1), capped at maxDelay
      const delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs);
      log?.warn({ attempt, nextRetryMs: delay, totalAttempts: opts.maxAttempts }, "retry:attemptFailed");
      await sleep(delay);
    }
  }

  log?.error({ attempts: opts.maxAttempts }, "retry:allAttemptsFailed");
  if (hasResult) {
    return lastResult as T;
  }
  throw lastError ?? new Error("Retry failed without result");
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  const delay = scaleDuration(ms, sleepScale);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
