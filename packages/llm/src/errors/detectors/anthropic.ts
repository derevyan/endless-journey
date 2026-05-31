/**
 * Anthropic Error Detector
 *
 * SDK-based error detection using Anthropic's error class hierarchy.
 * Uses @langchain/anthropic which wraps the Anthropic SDK.
 *
 * Note: LangChain wraps Anthropic errors, so we check both the
 * wrapped error and fall back to message-based detection.
 */

import type { ErrorClassification, ErrorDetector } from "../types";

// ============================================================================
// Anthropic Error Detection
// ============================================================================

/**
 * Check if error looks like an Anthropic error
 *
 * Anthropic errors typically have:
 * - error.status (HTTP status code)
 * - error.type (e.g., "rate_limit_error", "authentication_error")
 * - Message mentioning "anthropic" or "claude"
 */
function isAnthropicError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Check for Anthropic-specific properties
  const anyError = error as unknown as Record<string, unknown>;

  // Check for Anthropic error type property
  if (typeof anyError.type === "string" && anyError.type.includes("error")) {
    const msg = error.message.toLowerCase();
    if (msg.includes("anthropic") || msg.includes("claude")) {
      return true;
    }
  }

  // Check for status property with Anthropic mention
  if (typeof anyError.status === "number") {
    const msg = error.message.toLowerCase();
    if (msg.includes("anthropic") || msg.includes("claude")) {
      return true;
    }
  }

  // Check error name
  if (error.name.includes("Anthropic")) {
    return true;
  }

  return false;
}

/**
 * Extract Anthropic error type from error object
 */
function getAnthropicErrorType(error: unknown): string | undefined {
  const anyError = error as Record<string, unknown>;
  if (typeof anyError.type === "string") {
    return anyError.type;
  }
  return undefined;
}

/**
 * Extract status code from error object
 */
function getStatusCode(error: unknown): number | undefined {
  const anyError = error as Record<string, unknown>;
  if (typeof anyError.status === "number") {
    return anyError.status;
  }
  if (typeof anyError.statusCode === "number") {
    return anyError.statusCode;
  }
  return undefined;
}

// ============================================================================
// Anthropic Detector
// ============================================================================

/**
 * Detect and classify Anthropic SDK errors
 *
 * Anthropic error types (from their API):
 * - rate_limit_error (429)
 * - authentication_error (401)
 * - permission_error (403)
 * - not_found_error (404)
 * - invalid_request_error (400)
 * - overloaded_error (529)
 * - api_error (500)
 */
export const anthropicDetector: ErrorDetector = {
  name: "anthropic",

  /**
   * Check if error is from Anthropic
   */
  canHandle(error: unknown): boolean {
    return isAnthropicError(error);
  },

  /**
   * Classify Anthropic error
   */
  classify(error: unknown): ErrorClassification {
    const message = error instanceof Error ? error.message : String(error);
    const errorType = getAnthropicErrorType(error);
    const statusCode = getStatusCode(error);

    // Rate limit error
    if (errorType === "rate_limit_error" || statusCode === 429) {
      return {
        type: "rate_limit",
        retryable: true,
        statusCode: statusCode ?? 429,
        provider: "anthropic",
        message,
      };
    }

    // Authentication error
    if (errorType === "authentication_error" || statusCode === 401) {
      return {
        type: "auth",
        retryable: false,
        statusCode: statusCode ?? 401,
        provider: "anthropic",
        message,
      };
    }

    // Permission error
    if (errorType === "permission_error" || statusCode === 403) {
      return {
        type: "auth",
        retryable: false,
        statusCode: statusCode ?? 403,
        provider: "anthropic",
        message,
      };
    }

    // Overloaded error (Anthropic-specific: 529)
    if (errorType === "overloaded_error" || statusCode === 529) {
      return {
        type: "server",
        retryable: true,
        statusCode: statusCode ?? 529,
        provider: "anthropic",
        message,
      };
    }

    // API error (server error)
    if (errorType === "api_error" || (statusCode && statusCode >= 500)) {
      return {
        type: "server",
        retryable: true,
        statusCode: statusCode ?? 500,
        provider: "anthropic",
        message,
      };
    }

    // Default: unknown Anthropic error
    return {
      type: "unknown",
      retryable: false,
      statusCode,
      provider: "anthropic",
      message,
    };
  },
};
