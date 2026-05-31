/**
 * OpenAI Error Detector
 *
 * SDK-based error detection using OpenAI's error class hierarchy.
 * Provides accurate classification without relying on string matching.
 *
 * @see https://github.com/openai/openai-node#handling-errors
 */

import OpenAI from "openai";
import type { ErrorClassification, ErrorDetector } from "../types";

// ============================================================================
// OpenAI Detector
// ============================================================================

/**
 * Detect and classify OpenAI SDK errors
 *
 * OpenAI SDK provides a rich error hierarchy:
 * - APIError (base class with status, headers)
 *   - AuthenticationError (401)
 *   - RateLimitError (429)
 *   - BadRequestError (400)
 *   - NotFoundError (404)
 *   - UnprocessableEntityError (422)
 *   - InternalServerError (>=500)
 *   - APIConnectionError (network issues)
 */
export const openaiDetector: ErrorDetector = {
  name: "openai",

  /**
   * Check if error is from OpenAI SDK
   */
  canHandle(error: unknown): boolean {
    return error instanceof OpenAI.APIError;
  },

  /**
   * Classify OpenAI API error using SDK error types
   */
  classify(error: unknown): ErrorClassification {
    // Cast through unknown to access APIError properties
    const apiError = error as unknown as InstanceType<typeof OpenAI.APIError>;
    const message = apiError.message;
    const statusCode = apiError.status;

    // Rate limit error (429)
    if (error instanceof OpenAI.RateLimitError) {
      // Try to extract retry-after from headers (Headers uses .get() method)
      const retryAfter = apiError.headers?.get?.("retry-after");
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

      return {
        type: "rate_limit",
        retryable: true,
        retryAfterMs,
        statusCode: statusCode ?? 429,
        provider: "openai",
        message,
      };
    }

    // Authentication error (401)
    if (error instanceof OpenAI.AuthenticationError) {
      return {
        type: "auth",
        retryable: false,
        statusCode: statusCode ?? 401,
        provider: "openai",
        message,
      };
    }

    // Permission denied (403) - also auth-related
    if (error instanceof OpenAI.PermissionDeniedError) {
      return {
        type: "auth",
        retryable: false,
        statusCode: statusCode ?? 403,
        provider: "openai",
        message,
      };
    }

    // Internal server error (>=500)
    if (error instanceof OpenAI.InternalServerError) {
      return {
        type: "server",
        retryable: true,
        statusCode: statusCode ?? 500,
        provider: "openai",
        message,
      };
    }

    // Connection error (network issues)
    if (error instanceof OpenAI.APIConnectionError) {
      return {
        type: "connection",
        retryable: true,
        provider: "openai",
        message,
      };
    }

    // Timeout error
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return {
        type: "timeout",
        retryable: true,
        provider: "openai",
        message,
      };
    }

    // Default: treat other API errors based on status code
    if (statusCode && statusCode >= 500) {
      return {
        type: "server",
        retryable: true,
        statusCode,
        provider: "openai",
        message,
      };
    }

    // Unknown OpenAI error
    return {
      type: "unknown",
      retryable: false,
      statusCode,
      provider: "openai",
      message,
    };
  },
};
