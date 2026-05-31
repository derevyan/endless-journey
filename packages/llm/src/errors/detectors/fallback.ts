/**
 * Fallback Error Detector
 *
 * Uses string pattern matching to classify errors when SDK-specific
 * detection isn't available. This is the last resort detector.
 *
 * Patterns extracted from existing error handling across:
 * - llm-service.ts (wrapLLMError)
 * - model-fallback.ts (isRetryableError)
 * - audio-service.ts (wrapAudioError)
 */

import type { ErrorClassification, ErrorDetector } from "../types";
import { RETRYABLE_PATTERNS, AUTH_PATTERNS } from "../types";

// ============================================================================
// Pattern Matching Utilities
// ============================================================================

/**
 * Check if message contains any of the patterns (case-insensitive)
 */
function matchesAny(text: string, patterns: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

/**
 * Extract retry-after value from error message if present
 * Looks for patterns like "retry after 30" or "retry in 60 seconds"
 */
function extractRetryAfterMs(message: string): number | undefined {
  const retryMatch = message.match(/retry.+?(\d+)/i);
  if (retryMatch) {
    const value = parseInt(retryMatch[1], 10);
    // Assume seconds if value is small, milliseconds if large
    return value < 1000 ? value * 1000 : value;
  }
  return undefined;
}

/**
 * Extract HTTP status code from error message if present
 */
function extractStatusCode(message: string): number | undefined {
  // Look for common HTTP status codes in the message
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch) {
    return parseInt(statusMatch[1], 10);
  }
  return undefined;
}

// ============================================================================
// Fallback Detector
// ============================================================================

/**
 * Fallback detector using string pattern matching
 *
 * This detector always returns true for canHandle() since it's designed
 * to be the last detector in the chain - it handles everything.
 */
export const fallbackDetector: ErrorDetector = {
  name: "fallback",

  /**
   * Fallback detector handles all errors - it's the catch-all
   */
  canHandle(_error: unknown): boolean {
    return true;
  },

  /**
   * Classify error based on message pattern matching
   */
  classify(error: unknown): ErrorClassification {
    const message = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name.toLowerCase() : "";
    const lowerMessage = message.toLowerCase();
    const statusCode = extractStatusCode(message);

    // Rate limit detection
    if (matchesAny(lowerMessage, RETRYABLE_PATTERNS.rateLimit)) {
      return {
        type: "rate_limit",
        retryable: true,
        retryAfterMs: extractRetryAfterMs(message),
        statusCode: statusCode ?? 429,
        message: message || "Rate limit exceeded",
      };
    }

    // Auth error detection (non-retryable)
    if (matchesAny(lowerMessage, AUTH_PATTERNS)) {
      return {
        type: "auth",
        retryable: false,
        statusCode: statusCode ?? 401,
        message: message || "Authentication failed",
      };
    }

    // Timeout detection
    if (matchesAny(lowerMessage, RETRYABLE_PATTERNS.timeout) || errorName.includes("timeout")) {
      return {
        type: "timeout",
        retryable: true,
        message: message || "Request timed out",
      };
    }

    // Server error detection
    if (matchesAny(lowerMessage, RETRYABLE_PATTERNS.server)) {
      return {
        type: "server",
        retryable: true,
        statusCode: statusCode ?? 500,
        message: message || "Server error",
      };
    }

    // Connection error detection
    if (matchesAny(lowerMessage, RETRYABLE_PATTERNS.connection)) {
      return {
        type: "connection",
        retryable: true,
        message: message || "Connection error",
      };
    }

    // Unknown error type - default to non-retryable
    return {
      type: "unknown",
      retryable: false,
      statusCode,
      message: message || "Unknown error",
    };
  },
};
