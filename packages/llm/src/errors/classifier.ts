/**
 * Error Classifier
 *
 * Central error classification logic that orchestrates multiple detectors.
 * Tries SDK-specific detectors first, falls back to string matching.
 *
 * @example
 * ```typescript
 * import { classifyError, isRetryableError } from "@journey/llm/errors";
 *
 * try {
 *   await llm.invoke(messages);
 * } catch (error) {
 *   const classification = classifyError(error);
 *   if (classification.retryable) {
 *     // Retry with backoff
 *   }
 * }
 * ```
 */

import { CircuitOpenError } from "@journey/infra";
import type { ErrorClassification, ErrorDetector } from "./types";
import { openaiDetector, anthropicDetector, googleDetector, fallbackDetector } from "./detectors";

// ============================================================================
// Detector Registry
// ============================================================================

/**
 * Ordered list of error detectors
 *
 * Priority order:
 * 1. SDK-specific detectors (most accurate)
 * 2. Fallback detector (string matching)
 *
 * The first detector that returns true for canHandle() is used.
 */
const detectors: ErrorDetector[] = [
  openaiDetector,
  anthropicDetector,
  googleDetector,
  fallbackDetector, // Always last - handles everything
];

// ============================================================================
// Classification Functions
// ============================================================================

/**
 * Classify an error using the detector chain
 *
 * Iterates through detectors in priority order, using the first one
 * that can handle the error. Falls back to the fallback detector
 * which always handles any error.
 *
 * @param error - The error to classify
 * @returns Error classification with type, retryable flag, etc.
 */
export function classifyError(error: unknown): ErrorClassification {
  // Handle circuit breaker errors specially
  if (error instanceof CircuitOpenError) {
    return {
      type: "circuit_open",
      retryable: false, // Don't retry when circuit is open
      message: `Circuit breaker open for ${error.serviceName}`,
      provider: error.serviceType,
    };
  }

  // Try each detector in order
  for (const detector of detectors) {
    if (detector.canHandle(error)) {
      return detector.classify(error);
    }
  }

  // Should never reach here since fallbackDetector.canHandle() always returns true
  return fallbackDetector.classify(error);
}

/**
 * Check if an error is retryable
 *
 * Convenience function for retry logic in middleware and services.
 *
 * @param error - The error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return classifyError(error).retryable;
}

/**
 * Get the error type for an error
 *
 * Convenience function for error handling logic.
 *
 * @param error - The error to check
 * @returns The classified error type
 */
export function getErrorType(error: unknown): ErrorClassification["type"] {
  return classifyError(error).type;
}

/**
 * Get retry delay suggestion for an error
 *
 * Returns the suggested retry delay from error headers/response,
 * or undefined if no suggestion is available.
 *
 * @param error - The error to check
 * @returns Suggested retry delay in milliseconds, or undefined
 */
export function getRetryAfterMs(error: unknown): number | undefined {
  return classifyError(error).retryAfterMs;
}
