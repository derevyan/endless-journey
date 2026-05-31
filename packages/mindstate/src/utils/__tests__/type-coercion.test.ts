/**
 * Type Coercion Tests
 *
 * Tests for converting LLM string outputs to proper parameter types.
 * These tests focus on real-world LLM output scenarios.
 */

import { describe, it, expect } from "vitest";
import type { StateParameter } from "@journey/schemas";
import { coerceValue } from "../type-coercion";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createParameter(overrides: Partial<StateParameter> = {}): StateParameter {
  return {
    id: "test-param",
    name: "Test Parameter",
    category: "Test",
    description: "A test parameter",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: "test-agent",
    history: [],
    ...overrides,
  };
}

// =============================================================================
// TESTS: Real-world LLM output scenarios
// =============================================================================

describe("coerceValue", () => {
  describe("NUMERIC - LLM returns out-of-range values", () => {
    it("should clamp value below min to min", () => {
      const param = createParameter({ scaleType: "NUMERIC", min: 0, max: 10 });

      // LLM returns a value below valid range
      expect(coerceValue("-5", param)).toBe(0);
    });

    it("should clamp value above max to max", () => {
      const param = createParameter({ scaleType: "NUMERIC", min: 0, max: 10 });

      // LLM returns a value above valid range
      expect(coerceValue("15", param)).toBe(10);
    });

    it("should fallback to currentValue for invalid string", () => {
      const param = createParameter({ scaleType: "NUMERIC", currentValue: 5 });

      // LLM returns garbage instead of a number
      expect(coerceValue("not a number", param)).toBe(5);
      expect(coerceValue("seven", param)).toBe(5);
    });

    it("should handle special numeric strings like Infinity", () => {
      const param = createParameter({ scaleType: "NUMERIC", min: 0, max: 100 });

      // LLM might return these edge cases
      expect(coerceValue("Infinity", param)).toBe(100);
      expect(coerceValue("-Infinity", param)).toBe(0);
    });

    it("should handle numeric input values", () => {
      const param = createParameter({ scaleType: "NUMERIC", min: 0, max: 10 });

      expect(coerceValue(12, param)).toBe(10);
      expect(coerceValue(3, param)).toBe(3);
    });
  });

  describe("CATEGORICAL - LLM returns wrong case or whitespace", () => {
    const categoricalParam = createParameter({
      scaleType: "CATEGORICAL",
      options: ["low", "medium", "high"],
      currentValue: "medium",
    });

    it("should match case-insensitively and return canonical option", () => {
      // LLMs are inconsistent with casing - this is the bug fix we added
      expect(coerceValue("HIGH", categoricalParam)).toBe("high");
      expect(coerceValue("High", categoricalParam)).toBe("high");
      expect(coerceValue("hIgH", categoricalParam)).toBe("high");
    });

    it("should handle whitespace in LLM output", () => {
      // LLMs sometimes add leading/trailing whitespace
      expect(coerceValue("  high  ", categoricalParam)).toBe("high");
      expect(coerceValue(" HIGH ", categoricalParam)).toBe("high");
    });

    it("should fallback to currentValue for hallucinated option", () => {
      // LLM might hallucinate an option that doesn't exist
      expect(coerceValue("critical", categoricalParam)).toBe("medium");
      expect(coerceValue("extreme", categoricalParam)).toBe("medium");
    });
  });

  describe("BOOLEAN - LLM returns various true/false formats", () => {
    const boolParam = createParameter({
      scaleType: "BOOLEAN",
      currentValue: false,
    });

    it("should handle case-insensitive boolean strings", () => {
      // LLMs return booleans in various cases
      expect(coerceValue("TRUE", boolParam)).toBe(true);
      expect(coerceValue("True", boolParam)).toBe(true);
      expect(coerceValue("true", boolParam)).toBe(true);
      expect(coerceValue("FALSE", boolParam)).toBe(false);
      expect(coerceValue("False", boolParam)).toBe(false);
      expect(coerceValue("false", boolParam)).toBe(false);
    });

    it("should handle whitespace and common boolean aliases", () => {
      expect(coerceValue(" true ", boolParam)).toBe(true);
      expect(coerceValue("YES", boolParam)).toBe(true);
      expect(coerceValue("no", boolParam)).toBe(false);
      expect(coerceValue("0", boolParam)).toBe(false);
    });

    it("should accept boolean inputs directly", () => {
      expect(coerceValue(true, boolParam)).toBe(true);
      expect(coerceValue(false, boolParam)).toBe(false);
    });

    it("should fallback to currentValue for unrecognized boolean strings", () => {
      const param = createParameter({ scaleType: "BOOLEAN", currentValue: true });
      expect(coerceValue("maybe", param)).toBe(true);
    });
  });
});
