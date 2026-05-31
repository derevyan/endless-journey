/**
 * Google (Gemini) Error Detector
 *
 * SDK-based error detection for Google's Generative AI / Gemini errors.
 * Uses @langchain/google-genai which wraps the Google SDK.
 *
 * Note: Google errors are often wrapped by LangChain, so we use
 * a combination of property checking and message-based detection.
 */

import type { ErrorClassification, ErrorDetector } from "../types";

// ============================================================================
// Google Error Detection
// ============================================================================

/**
 * Check if error looks like a Google/Gemini error
 *
 * Google errors typically have:
 * - error.status (gRPC status or HTTP status)
 * - Message mentioning "google", "gemini", or "generativeai"
 */
function isGoogleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();

  // Check for Google/Gemini specific messages
  if (
    msg.includes("google") ||
    msg.includes("gemini") ||
    msg.includes("generativeai") ||
    msg.includes("googleapis")
  ) {
    return true;
  }

  // Check error name
  if (
    error.name.includes("Google") ||
    error.name.includes("Gemini")
  ) {
    return true;
  }

  // Check for Google-specific error properties
  const anyError = error as unknown as Record<string, unknown>;
  if (anyError.errorDetails && Array.isArray(anyError.errorDetails)) {
    return true;
  }

  return false;
}

/**
 * Extract status code from Google error
 */
function getStatusCode(error: unknown): number | undefined {
  const anyError = error as Record<string, unknown>;

  // HTTP status
  if (typeof anyError.status === "number") {
    return anyError.status;
  }
  if (typeof anyError.statusCode === "number") {
    return anyError.statusCode;
  }

  // gRPC status to HTTP mapping (common cases)
  if (typeof anyError.code === "number") {
    const grpcCode = anyError.code;
    const grpcToHttp: Record<number, number> = {
      1: 499,  // CANCELLED
      2: 500,  // UNKNOWN
      3: 400,  // INVALID_ARGUMENT
      4: 504,  // DEADLINE_EXCEEDED
      5: 404,  // NOT_FOUND
      7: 403,  // PERMISSION_DENIED
      8: 429,  // RESOURCE_EXHAUSTED (rate limit)
      13: 500, // INTERNAL
      14: 503, // UNAVAILABLE
      16: 401, // UNAUTHENTICATED
    };
    return grpcToHttp[grpcCode];
  }

  return undefined;
}

/**
 * Check error message for specific patterns
 */
function matchesPattern(message: string, patterns: string[]): boolean {
  const lower = message.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

// ============================================================================
// Google Detector
// ============================================================================

/**
 * Detect and classify Google/Gemini SDK errors
 *
 * Google uses gRPC status codes internally:
 * - RESOURCE_EXHAUSTED (8) → rate limit
 * - UNAUTHENTICATED (16) → auth error
 * - PERMISSION_DENIED (7) → auth error
 * - DEADLINE_EXCEEDED (4) → timeout
 * - UNAVAILABLE (14) → server error
 * - INTERNAL (13) → server error
 */
export const googleDetector: ErrorDetector = {
  name: "google",

  /**
   * Check if error is from Google/Gemini
   */
  canHandle(error: unknown): boolean {
    return isGoogleError(error);
  },

  /**
   * Classify Google/Gemini error
   */
  classify(error: unknown): ErrorClassification {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = getStatusCode(error);
    const anyError = error as Record<string, unknown>;
    const grpcCode = typeof anyError.code === "number" ? anyError.code : undefined;

    // Rate limit (gRPC RESOURCE_EXHAUSTED or HTTP 429)
    if (grpcCode === 8 || statusCode === 429 || matchesPattern(message, ["quota", "rate limit", "resource exhausted"])) {
      return {
        type: "rate_limit",
        retryable: true,
        statusCode: statusCode ?? 429,
        provider: "google-genai",
        message,
      };
    }

    // Auth errors (gRPC UNAUTHENTICATED or PERMISSION_DENIED)
    if (
      grpcCode === 16 ||
      grpcCode === 7 ||
      statusCode === 401 ||
      statusCode === 403 ||
      matchesPattern(message, ["api key", "unauthorized", "unauthenticated", "permission denied"])
    ) {
      return {
        type: "auth",
        retryable: false,
        statusCode: statusCode ?? 401,
        provider: "google-genai",
        message,
      };
    }

    // Timeout (gRPC DEADLINE_EXCEEDED)
    if (grpcCode === 4 || statusCode === 504 || matchesPattern(message, ["timeout", "deadline exceeded"])) {
      return {
        type: "timeout",
        retryable: true,
        statusCode: statusCode ?? 504,
        provider: "google-genai",
        message,
      };
    }

    // Server errors (gRPC UNAVAILABLE or INTERNAL)
    if (
      grpcCode === 14 ||
      grpcCode === 13 ||
      grpcCode === 2 ||
      (statusCode && statusCode >= 500) ||
      matchesPattern(message, ["unavailable", "internal error", "server error"])
    ) {
      return {
        type: "server",
        retryable: true,
        statusCode: statusCode ?? 500,
        provider: "google-genai",
        message,
      };
    }

    // Default: unknown Google error
    return {
      type: "unknown",
      retryable: false,
      statusCode,
      provider: "google-genai",
      message,
    };
  },
};
