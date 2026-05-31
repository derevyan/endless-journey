/**
 * Error classification for usage tracking failures
 *
 * Distinguishes permanent errors (drop events) from transient errors (retry).
 * Uses PostgreSQL error codes for robust detection.
 *
 * This module provides structured error analysis for the UsageTrackingService,
 * enabling intelligent decisions about whether to retry failed database operations.
 *
 * @example
 * ```typescript
 * import { classifyUsageTrackingError } from "./usage-tracking-error-classifier";
 *
 * try {
 *   await db.insert(llmUsageEvents).values(events);
 * } catch (error) {
 *   const classification = classifyUsageTrackingError(error);
 *   if (classification.retryable) {
 *     // Retry transient errors
 *   } else {
 *     // Drop permanently failed events
 *   }
 * }
 * ```
 */

export interface UsageTrackingErrorClassification {
  /** Error type identifier */
  type: "fk_violation" | "unique_violation" | "check_violation" | "not_null_violation" | "transient" | "unknown";

  /** Is this a permanent error? (data/constraint violation) */
  permanent: boolean;

  /** Should events be retried? */
  retryable: boolean;

  /** Human-readable description */
  message: string;
}

/**
 * Classify database errors from usage tracking flush operations
 *
 * PostgreSQL Error Codes:
 * - 23503: foreign_key_violation (entity doesn't exist)
 * - 23505: unique_violation (duplicate data)
 * - 23514: check_violation (validation failed)
 * - 23502: not_null_violation (required field missing)
 *
 * Handles both direct errors and Drizzle ORM wrapped errors (error.cause).
 * Falls back to string message matching for compatibility with different
 * PostgreSQL driver versions.
 *
 * @param error - Error from db.insert() operation
 * @returns Classification with retry guidance and description
 */
export function classifyUsageTrackingError(error: unknown): UsageTrackingErrorClassification {
  // Handle null/undefined errors gracefully
  if (!error) {
    return {
      type: "transient",
      permanent: false,
      retryable: true,
      message: "Transient database error (will retry)",
    };
  }

  // Handle Drizzle ORM error wrapping
  // Some errors come wrapped in error.cause, others are direct
  const dbError = error as {
    code?: string;
    cause?: { code?: string };
    message?: string;
    constraint?: string;
  };

  const errorCode = dbError.code || dbError.cause?.code;
  const errorMessage = dbError.message || String(error);

  // =========================================================================
  // PERMANENT ERRORS (data/constraint violations - non-recoverable)
  // =========================================================================

  // Foreign Key Violation (23503)
  // Most common: organization/user/journey no longer exists
  // Happens when: DB was reset, entity was deleted, stale buffered events
  if (errorCode === "23503" || errorMessage.includes("violates foreign key constraint")) {
    return {
      type: "fk_violation",
      permanent: true,
      retryable: false,
      message: `Entity referenced in event no longer exists (FK constraint: ${dbError.constraint || "unknown"})`,
    };
  }

  // Unique Violation (23505)
  // Event ID collision or duplicate tracking
  if (errorCode === "23505" || errorMessage.includes("violates unique constraint")) {
    return {
      type: "unique_violation",
      permanent: true,
      retryable: false,
      message: "Duplicate event detected",
    };
  }

  // Check Constraint Violation (23514)
  // Event data failed validation constraints
  if (errorCode === "23514" || errorMessage.includes("violates check constraint")) {
    return {
      type: "check_violation",
      permanent: true,
      retryable: false,
      message: "Event data failed validation constraints",
    };
  }

  // NOT NULL Violation (23502)
  // Required field is missing
  if (errorCode === "23502" || errorMessage.includes("violates not-null constraint")) {
    return {
      type: "not_null_violation",
      permanent: true,
      retryable: false,
      message: "Required field is missing from event",
    };
  }

  // =========================================================================
  // TRANSIENT ERRORS (temporary issues - should be retried)
  // =========================================================================

  // All other errors are considered transient:
  // - Network errors (ECONNREFUSED, ECONNRESET, etc.)
  // - Database busy (deadlock, lock timeout)
  // - Connection pool exhaustion
  // - Unknown errors (conservative: safer to retry than drop data)
  return {
    type: "transient",
    permanent: false,
    retryable: true,
    message: "Transient database error (will retry)",
  };
}
