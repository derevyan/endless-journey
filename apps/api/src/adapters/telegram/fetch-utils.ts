/**
 * Telegram Fetch Utilities
 *
 * Provides timeout-wrapped fetch and HTTP status classification
 * for robust Telegram API communication.
 *
 * @module adapters/telegram/fetch-utils
 */

import { ServiceUnavailableError } from "@journey/schemas";

// Default timeout for Telegram API calls (15 seconds)
export const TELEGRAM_TIMEOUT_MS = 15_000;

// Extended timeout for media uploads (30 seconds)
export const MEDIA_TIMEOUT_MS = 30_000;

// Timeout for external media fetch (10 seconds)
export const MEDIA_FETCH_TIMEOUT_MS = 10_000;

/**
 * Check if an HTTP status code indicates a retryable error.
 *
 * Retryable statuses:
 * - 5xx: Server errors (temporary failures)
 * - 429: Rate limit (retry after backoff)
 * - 408: Request timeout
 */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

/**
 * Fetch wrapper with AbortController timeout.
 *
 * Prevents indefinite hangs when Telegram API is unresponsive.
 * Throws ServiceUnavailableError on timeout (will trigger retry).
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (method, headers, body, etc.)
 * @param timeoutMs - Timeout in milliseconds (default: 15000)
 * @returns The fetch Response
 * @throws ServiceUnavailableError on timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = TELEGRAM_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceUnavailableError(
        `Telegram API request timed out after ${timeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
