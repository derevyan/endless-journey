/**
 * Tests for usage tracking error classification
 *
 * Verifies that errors are correctly classified as permanent (drop) or
 * transient (retry) based on PostgreSQL error codes and messages.
 */

import { describe, it, expect } from "vitest";
import { classifyUsageTrackingError } from "../usage-tracking-error-classifier";

describe("classifyUsageTrackingError", () => {
  describe("Foreign Key Violations (23503)", () => {
    it("detects FK violations by PostgreSQL error code 23503", () => {
      const error = {
        code: "23503",
        constraint: "llm_usage_events_organization_id_organization_id_fk",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("fk_violation");
      expect(result.permanent).toBe(true);
      expect(result.retryable).toBe(false);
      expect(result.message).toContain("Entity referenced");
    });

    it("detects FK violations from wrapped Drizzle errors (error.cause)", () => {
      const error = {
        cause: { code: "23503" },
        message: "Database error",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("fk_violation");
      expect(result.permanent).toBe(true);
      expect(result.retryable).toBe(false);
    });

    it("detects FK violations by error message string (fallback)", () => {
      const error = new Error(
        "insert into \"llm_usage_events\" violates foreign key constraint \"llm_usage_events_organization_id_organization_id_fk\""
      );
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("fk_violation");
      expect(result.retryable).toBe(false);
    });

    it("includes constraint name in message when available", () => {
      const error = {
        code: "23503",
        constraint: "llm_usage_events_organization_id_organization_id_fk",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.message).toContain("llm_usage_events_organization_id_organization_id_fk");
    });
  });

  describe("Unique Constraint Violations (23505)", () => {
    it("detects unique violations by error code 23505", () => {
      const error = {
        code: "23505",
        constraint: "llm_usage_events_pkey",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("unique_violation");
      expect(result.permanent).toBe(true);
      expect(result.retryable).toBe(false);
    });

    it("detects unique violations by message string", () => {
      const error = new Error("violates unique constraint");
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("unique_violation");
      expect(result.permanent).toBe(true);
    });
  });

  describe("Check Constraint Violations (23514)", () => {
    it("detects check violations by error code 23514", () => {
      const error = {
        code: "23514",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("check_violation");
      expect(result.permanent).toBe(true);
      expect(result.retryable).toBe(false);
    });

    it("detects check violations by message string", () => {
      const error = new Error("violates check constraint");
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("check_violation");
    });
  });

  describe("NOT NULL Violations (23502)", () => {
    it("detects not-null violations by error code 23502", () => {
      const error = {
        code: "23502",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("not_null_violation");
      expect(result.permanent).toBe(true);
      expect(result.retryable).toBe(false);
    });

    it("detects not-null violations by message string", () => {
      const error = new Error("violates not-null constraint");
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("not_null_violation");
    });
  });

  describe("Transient Errors (should retry)", () => {
    it("treats unknown errors as transient (safe default)", () => {
      const error = new Error("Something unexpected happened");
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("transient");
      expect(result.permanent).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it("treats network errors as transient", () => {
      const error = {
        code: "ECONNREFUSED",
        message: "Connection refused",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.retryable).toBe(true);
      expect(result.permanent).toBe(false);
    });

    it("treats connection reset as transient", () => {
      const error = {
        code: "ECONNRESET",
        message: "Connection reset by peer",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.retryable).toBe(true);
    });

    it("treats connection timeout as transient", () => {
      const error = new Error("Connection timeout");
      const result = classifyUsageTrackingError(error);

      expect(result.retryable).toBe(true);
    });

    it("treats database busy errors as transient", () => {
      const error = new Error("FATAL: remaining connection slots reserved for non-replication superuser connections");
      const result = classifyUsageTrackingError(error);

      expect(result.retryable).toBe(true);
    });
  });

  describe("Error handling edge cases", () => {
    it("handles null/undefined error gracefully", () => {
      const result = classifyUsageTrackingError(null);

      expect(result.retryable).toBe(true);
      expect(result.type).toBe("transient");
    });

    it("handles non-Error objects", () => {
      const result = classifyUsageTrackingError("some string error");

      expect(result.retryable).toBe(true);
    });

    it("prefers error.code over error.cause.code", () => {
      const error = {
        code: "23503", // FK violation
        cause: {
          code: "28000", // Invalid auth
        },
      };
      const result = classifyUsageTrackingError(error);

      // Should use the direct error.code (23503)
      expect(result.type).toBe("fk_violation");
    });

    it("handles wrapped errors with cause.code", () => {
      const error = {
        cause: {
          code: "23503",
        },
        message: "Database error occurred",
      };
      const result = classifyUsageTrackingError(error);

      expect(result.type).toBe("fk_violation");
    });
  });

  describe("Classification properties consistency", () => {
    it("permanent errors have retryable=false", () => {
      const permanentErrors = [
        { code: "23503" }, // FK
        { code: "23505" }, // Unique
        { code: "23514" }, // Check
        { code: "23502" }, // Not null
      ];

      permanentErrors.forEach((error) => {
        const result = classifyUsageTrackingError(error);
        expect(result.permanent).toBe(true);
        expect(result.retryable).toBe(false);
      });
    });

    it("transient errors have permanent=false", () => {
      const transientErrors = [
        new Error("Connection timeout"),
        { code: "ECONNREFUSED" },
        { message: "Unknown error" },
      ];

      transientErrors.forEach((error) => {
        const result = classifyUsageTrackingError(error);
        expect(result.permanent).toBe(false);
        expect(result.retryable).toBe(true);
      });
    });

    it("always returns a valid message", () => {
      const errors = [
        { code: "23503" },
        { code: "23505" },
        new Error("Network error"),
        null,
      ];

      errors.forEach((error) => {
        const result = classifyUsageTrackingError(error);
        expect(result.message).toBeDefined();
        expect(typeof result.message).toBe("string");
        expect(result.message.length).toBeGreaterThan(0);
      });
    });
  });
});
