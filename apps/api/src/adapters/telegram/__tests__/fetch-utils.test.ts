/**
 * Telegram Fetch Utilities Tests
 *
 * Unit tests for timeout wrapper and HTTP status classification.
 *
 * @module adapters/telegram/__tests__/fetch-utils
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchWithTimeout,
  isRetryableStatus,
  TELEGRAM_TIMEOUT_MS,
  MEDIA_TIMEOUT_MS,
  MEDIA_FETCH_TIMEOUT_MS,
} from "../fetch-utils";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("telegram/fetch-utils", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("isRetryableStatus", () => {
    it("returns true for 5xx server errors", () => {
      expect(isRetryableStatus(500)).toBe(true);
      expect(isRetryableStatus(502)).toBe(true);
      expect(isRetryableStatus(503)).toBe(true);
      expect(isRetryableStatus(504)).toBe(true);
      expect(isRetryableStatus(599)).toBe(true);
    });

    it("returns true for 429 rate limit", () => {
      expect(isRetryableStatus(429)).toBe(true);
    });

    it("returns true for 408 request timeout", () => {
      expect(isRetryableStatus(408)).toBe(true);
    });

    it("returns false for 4xx client errors (except 408, 429)", () => {
      expect(isRetryableStatus(400)).toBe(false);
      expect(isRetryableStatus(401)).toBe(false);
      expect(isRetryableStatus(403)).toBe(false);
      expect(isRetryableStatus(404)).toBe(false);
    });

    it("returns false for 2xx success codes", () => {
      expect(isRetryableStatus(200)).toBe(false);
      expect(isRetryableStatus(201)).toBe(false);
      expect(isRetryableStatus(204)).toBe(false);
    });

    it("returns false for 3xx redirect codes", () => {
      expect(isRetryableStatus(301)).toBe(false);
      expect(isRetryableStatus(302)).toBe(false);
      expect(isRetryableStatus(304)).toBe(false);
    });
  });

  describe("fetchWithTimeout", () => {
    it("returns response on successful fetch within timeout", async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithTimeout("https://api.telegram.org/test", {
        method: "POST",
      });

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telegram.org/test",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("throws ServiceUnavailableError on timeout", async () => {
      // Mock a fetch that respects the AbortSignal
      mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal | undefined;
          if (signal) {
            signal.addEventListener("abort", () => {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            });
          }
          // Never resolves naturally - will only abort
        });
      });

      // Use very short timeout for fast test
      await expect(
        fetchWithTimeout("https://api.telegram.org/test", {}, 50)
      ).rejects.toThrow("timed out after 50ms");
    }, 10000);

    it("passes through network errors", async () => {
      const networkError = new Error("ECONNRESET");
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(
        fetchWithTimeout("https://api.telegram.org/test")
      ).rejects.toThrow("ECONNRESET");
    });

    it("uses default timeout when not specified", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await fetchWithTimeout("https://api.telegram.org/test");

      // Verify signal was passed (indicates AbortController was used)
      expect(mockFetch.mock.calls[0][1]).toHaveProperty("signal");
    });

    it("uses custom timeout when specified", async () => {
      // Mock a fetch that respects the AbortSignal
      mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal | undefined;
          if (signal) {
            signal.addEventListener("abort", () => {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            });
          }
          // Never resolves naturally - will only abort
        });
      });

      // Custom 30ms timeout should trigger
      await expect(
        fetchWithTimeout("https://api.telegram.org/test", {}, 30)
      ).rejects.toThrow("timed out after 30ms");
    }, 10000);
  });

  describe("timeout constants", () => {
    it("exports correct default timeout values", () => {
      expect(TELEGRAM_TIMEOUT_MS).toBe(15_000);
      expect(MEDIA_TIMEOUT_MS).toBe(30_000);
      expect(MEDIA_FETCH_TIMEOUT_MS).toBe(10_000);
    });
  });
});
