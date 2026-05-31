/**
 * Timeout Utilities
 *
 * Shared timeout handling for async operations.
 *
 * @module utils/timeout
 */

/**
 * Run an async function with a timeout
 *
 * Uses proper cleanup to avoid memory leaks - the timeout is cleared
 * when the promise resolves, preventing timer accumulation in Node's event loop.
 *
 * @param promise - The promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Description for error message
 * @returns The promise result
 * @throws Error if timeout exceeded
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetch("https://api.example.com"),
 *   5000,
 *   "API fetch"
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
