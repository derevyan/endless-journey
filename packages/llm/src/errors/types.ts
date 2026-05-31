/**
 * Error Classification Types
 *
 * Defines the interface for provider-aware error detection and classification.
 */

// =============================================================================
// Error Types
// =============================================================================

/**
 * Classified error type for LLM errors
 */
export type LLMErrorType =
  | "rate_limit"
  | "auth"
  | "timeout"
  | "connection"
  | "server"
  | "circuit_open"
  | "unknown";

/**
 * Result of error classification
 */
export interface ErrorClassification {
  /** The type of error */
  type: LLMErrorType;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;
  /** HTTP status code if available */
  statusCode?: number;
  /** The provider that originated the error */
  provider?: string;
  /** Human-readable error message */
  message: string;
}

// =============================================================================
// Detector Interface
// =============================================================================

/**
 * Interface for provider-specific error detectors
 *
 * Each detector can check if it can handle an error and classify it.
 */
export interface ErrorDetector {
  /** Name of this detector (for logging) */
  name: string;

  /**
   * Check if this detector can handle the given error
   * @param error The error to check
   * @returns true if this detector can classify the error
   */
  canHandle(error: unknown): boolean;

  /**
   * Classify the error
   * @param error The error to classify
   * @returns The error classification
   */
  classify(error: unknown): ErrorClassification;
}

// =============================================================================
// Retryable Error Patterns
// =============================================================================

/**
 * Patterns for detecting retryable errors via string matching
 * Used by fallback detector when SDK-specific detection isn't available
 */
export const RETRYABLE_PATTERNS = {
  /** Rate limiting patterns */
  rateLimit: ["rate limit", "429", "too many requests", "quota exceeded"],

  /** Timeout patterns */
  timeout: ["timeout", "etimedout", "timed out", "deadline exceeded"],

  /** Server error patterns */
  server: ["overloaded", "unavailable", "503", "502", "500", "internal server error"],

  /** Connection error patterns */
  connection: ["econnreset", "econnrefused", "network", "socket hang up", "connection refused"],
} as const;

/**
 * Patterns for detecting auth errors (non-retryable)
 */
export const AUTH_PATTERNS = ["auth", "401", "api key", "unauthorized", "invalid key", "permission denied"] as const;
