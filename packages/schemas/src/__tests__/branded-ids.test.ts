/**
 * Branded ID Types - Unit Tests
 *
 * Tests for type guards, constructors, and Zod schemas for branded identifiers.
 */

import { describe, expect, it } from "vitest";
import {
  createJourneyIdOrSlug,
  createJourneySlug,
  createJourneyUuid,
  createOrganizationId,
  createSessionId,
  createUserId,
  isJourneySlug,
  isJourneyUuid,
  isSlug,
  isUuid,
  SLUG_REGEX,
  UUID_REGEX,
} from "../branded-ids";

// Test UUIDs
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_UPPER = "550E8400-E29B-41D4-A716-446655440000";
const INVALID_UUID = "not-a-uuid";
const INVALID_UUID_SHORT = "550e8400-e29b-41d4";

// Test slugs
const VALID_SLUG = "my-cool-journey";
const VALID_SLUG_NUMBERS = "journey-2024-test";
const VALID_SLUG_SINGLE = "simple";
const INVALID_SLUG_UPPERCASE = "My-Cool-Journey";
const INVALID_SLUG_SPECIAL = "my@cool#journey";

describe("branded-ids", () => {
  // ==========================================================================
  // TYPE GUARDS
  // ==========================================================================

  describe("isUuid", () => {
    it("should return true for valid UUIDs", () => {
      expect(isUuid(VALID_UUID)).toBe(true);
      expect(isUuid(VALID_UUID_UPPER)).toBe(true);
    });

    it("should return false for invalid UUIDs", () => {
      expect(isUuid(INVALID_UUID)).toBe(false);
      expect(isUuid(VALID_SLUG)).toBe(false);
    });
  });

  describe("isSlug", () => {
    it("should return true for valid slugs", () => {
      expect(isSlug(VALID_SLUG)).toBe(true);
      expect(isSlug(VALID_SLUG_NUMBERS)).toBe(true);
    });

    it("should return false for UUIDs (even though pattern matches)", () => {
      // This is the key distinction: isSlug excludes UUIDs
      expect(isSlug(VALID_UUID)).toBe(false);
    });

    it("should return false for invalid slugs", () => {
      expect(isSlug(INVALID_SLUG_UPPERCASE)).toBe(false);
      expect(isSlug(INVALID_SLUG_SPECIAL)).toBe(false);
    });
  });

  describe("isJourneyUuid", () => {
    it("should return false for slugs", () => {
      expect(isJourneyUuid(VALID_SLUG)).toBe(false);
    });
  });

  describe("isJourneySlug", () => {
    it("should return false for UUIDs", () => {
      expect(isJourneySlug(VALID_UUID)).toBe(false);
    });
  });

  // ==========================================================================
  // CONSTRUCTORS
  // ==========================================================================

  describe("createJourneyUuid", () => {
    it("should throw for invalid UUID", () => {
      expect(() => createJourneyUuid(INVALID_UUID)).toThrow(/Invalid JourneyUuid/);
      expect(() => createJourneyUuid(VALID_SLUG)).toThrow(/Invalid JourneyUuid/);
    });
  });

  describe("createJourneySlug", () => {
    it("should throw for invalid slug format", () => {
      expect(() => createJourneySlug(INVALID_SLUG_UPPERCASE)).toThrow(/Invalid JourneySlug/);
      expect(() => createJourneySlug(INVALID_SLUG_SPECIAL)).toThrow(/Invalid JourneySlug/);
    });

    it("should throw for UUID (cannot be a slug)", () => {
      expect(() => createJourneySlug(VALID_UUID)).toThrow(/cannot be a UUID/);
    });
  });

  describe("createJourneyIdOrSlug", () => {
    it("should throw for invalid format", () => {
      expect(() => createJourneyIdOrSlug(INVALID_SLUG_SPECIAL)).toThrow(/Invalid JourneyIdOrSlug/);
    });
  });

  describe("createOrganizationId", () => {
    it("should throw for invalid UUID", () => {
      expect(() => createOrganizationId(INVALID_UUID)).toThrow(/Invalid OrganizationId/);
    });
  });

  describe("createUserId", () => {
    it("should throw for invalid UUID", () => {
      expect(() => createUserId(INVALID_UUID)).toThrow(/Invalid UserId/);
    });
  });

  describe("createSessionId", () => {
    it("should throw for invalid UUID", () => {
      expect(() => createSessionId(INVALID_UUID)).toThrow(/Invalid SessionId/);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty string", () => {
      expect(isUuid("")).toBe(false);
      expect(isSlug("")).toBe(false);
      expect(() => createJourneyUuid("")).toThrow();
      expect(() => createJourneySlug("")).toThrow();
    });

    it("should handle whitespace", () => {
      expect(isUuid(" ")).toBe(false);
      expect(isSlug(" ")).toBe(false);
      expect(isSlug(VALID_SLUG + " ")).toBe(false);
    });

    it("should handle UUID with extra characters", () => {
      expect(isUuid(VALID_UUID + "x")).toBe(false);
      expect(isUuid("x" + VALID_UUID)).toBe(false);
    });

    it("should distinguish between similar looking strings", () => {
      // A slug that could be mistaken for a UUID without proper validation
      const almostUuid = "550e8400-xxxx-41d4-a716-446655440000";
      expect(isUuid(almostUuid)).toBe(false);
      expect(isSlug(almostUuid)).toBe(true); // It's a valid slug format
    });
  });
});
