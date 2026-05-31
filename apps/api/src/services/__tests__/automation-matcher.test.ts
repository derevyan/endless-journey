/**
 * Automation Matcher Service - Unit Tests
 *
 * Tests the expression evaluation logic used for automation triggers.
 * Uses JEXL for expression evaluation with full type support.
 *
 * Run with: pnpm vitest run src/services/__tests__/automation-matcher.test.ts
 */

import { describe, expect, it } from "vitest";
import { evaluateExpression } from "../automation-matcher";

describe("automation-matcher", () => {
  // ===========================================================================
  // evaluateExpression - Expression Evaluation (JEXL-based)
  // ===========================================================================

  describe("evaluateExpression", () => {
    describe("null/empty expression handling", () => {
      it("returns false for null expression", () => {
        expect(evaluateExpression(null, 100)).toBe(false);
      });

      it("returns false for empty string expression", () => {
        expect(evaluateExpression("", 100)).toBe(false);
      });
    });

    describe("comparison operators with numbers", () => {
      it("handles >= operator", () => {
        expect(evaluateExpression("value >= 100", 100)).toBe(true);
        expect(evaluateExpression("value >= 100", 150)).toBe(true);
        expect(evaluateExpression("value >= 100", 50)).toBe(false);
      });

      it("handles <= operator", () => {
        expect(evaluateExpression("value <= 100", 100)).toBe(true);
        expect(evaluateExpression("value <= 100", 50)).toBe(true);
        expect(evaluateExpression("value <= 100", 150)).toBe(false);
      });

      it("handles > operator", () => {
        expect(evaluateExpression("value > 100", 101)).toBe(true);
        expect(evaluateExpression("value > 100", 100)).toBe(false);
      });

      it("handles < operator", () => {
        expect(evaluateExpression("value < 100", 99)).toBe(true);
        expect(evaluateExpression("value < 100", 100)).toBe(false);
      });

      it("handles == operator", () => {
        expect(evaluateExpression("value == 100", 100)).toBe(true);
        expect(evaluateExpression("value == 100", 99)).toBe(false);
      });

      it("handles != operator", () => {
        expect(evaluateExpression("value != 100", 99)).toBe(true);
        expect(evaluateExpression("value != 100", 100)).toBe(false);
      });
    });

    describe("string comparisons", () => {
      it("handles string equality with single quotes", () => {
        expect(evaluateExpression("value == 'gold'", "gold")).toBe(true);
        expect(evaluateExpression("value == 'gold'", "silver")).toBe(false);
      });

      it("handles string equality with double quotes", () => {
        expect(evaluateExpression('value == "premium"', "premium")).toBe(true);
        expect(evaluateExpression('value == "premium"', "basic")).toBe(false);
      });

      it("handles string inequality", () => {
        expect(evaluateExpression("value != 'draft'", "active")).toBe(true);
        expect(evaluateExpression("value != 'draft'", "draft")).toBe(false);
      });
    });

    describe("boolean value handling - JEXL native boolean support", () => {
      it("correctly evaluates true boolean values", () => {
        // JEXL handles booleans natively
        expect(evaluateExpression("value == true", true)).toBe(true);
        expect(evaluateExpression("value == false", true)).toBe(false);
      });

      it("correctly evaluates false boolean values", () => {
        expect(evaluateExpression("value == false", false)).toBe(true);
        expect(evaluateExpression("value == true", false)).toBe(false);
      });

      it("can use boolean values in truthy checks", () => {
        expect(evaluateExpression("value", true)).toBe(true);
        expect(evaluateExpression("value", false)).toBe(false);
        expect(evaluateExpression("!value", false)).toBe(true);
      });
    });

    describe("arithmetic expressions", () => {
      it("handles addition in expressions", () => {
        expect(evaluateExpression("value + 10 > 100", 95)).toBe(true);
        expect(evaluateExpression("value + 10 > 100", 85)).toBe(false);
      });

      it("handles multiplication in expressions", () => {
        expect(evaluateExpression("value * 2 >= 100", 50)).toBe(true);
        expect(evaluateExpression("value * 2 >= 100", 40)).toBe(false);
      });
    });

    describe("logical operators (JEXL uses && and ||)", () => {
      it("handles && operator", () => {
        expect(evaluateExpression("value > 10 && value < 100", 50)).toBe(true);
        expect(evaluateExpression("value > 10 && value < 100", 5)).toBe(false);
        expect(evaluateExpression("value > 10 && value < 100", 150)).toBe(false);
      });

      it("handles || operator", () => {
        expect(evaluateExpression("value < 10 || value > 100", 5)).toBe(true);
        expect(evaluateExpression("value < 10 || value > 100", 150)).toBe(true);
        expect(evaluateExpression("value < 10 || value > 100", 50)).toBe(false);
      });

      it("handles ! (not) operator", () => {
        expect(evaluateExpression("!(value > 100)", 50)).toBe(true);
        expect(evaluateExpression("!(value > 100)", 150)).toBe(false);
      });
    });

    describe("edge cases and error handling", () => {
      it("handles null value", () => {
        // JEXL handles null natively
        expect(evaluateExpression("value == null", null)).toBe(true);
        expect(evaluateExpression("value != null", null)).toBe(false);
      });

      it("handles undefined value", () => {
        // undefined is passed through and treated as falsy
        expect(evaluateExpression("!value", undefined)).toBe(true);
      });

      it("returns false for invalid expression syntax", () => {
        // Invalid expression should return false, not throw
        expect(evaluateExpression("value >>>= invalid", 100)).toBe(false);
      });

      it("returns false for expression with undefined variable", () => {
        // Using undefined variable should fail gracefully
        expect(evaluateExpression("unknownVar > 100", 50)).toBe(false);
      });
    });

    describe("JEXL-specific features", () => {
      it("supports ternary expressions (returns truthy for non-empty results)", () => {
        // Note: evaluateExpression returns Boolean(result), so ternary results are coerced
        // Both 'high' and 'low' are truthy strings, so both return true
        expect(evaluateExpression("value > 50 ? 'high' : 'low'", 75)).toBe(true);
        expect(evaluateExpression("value > 50 ? 'high' : 'low'", 25)).toBe(true);
        // Use ternary with boolean result for true/false distinction
        expect(evaluateExpression("value > 50 ? true : false", 75)).toBe(true);
        expect(evaluateExpression("value > 50 ? true : false", 25)).toBe(false);
      });

      it("supports string methods via JEXL functions", () => {
        expect(evaluateExpression("includes(value, 'gold')", "gold-member")).toBe(true);
        expect(evaluateExpression("includes(value, 'gold')", "silver-member")).toBe(false);
      });

      it("supports nested property access", () => {
        // Note: In automation triggers, 'value' is typically a primitive
        // But JEXL supports objects if needed
        const objValue = { level: "premium" };
        expect(evaluateExpression("value.level == 'premium'", objValue)).toBe(true);
      });
    });

    describe("real-world automation trigger scenarios", () => {
      it("score threshold trigger: value >= 100", () => {
        expect(evaluateExpression("value >= 100", 100)).toBe(true);
        expect(evaluateExpression("value >= 100", 99)).toBe(false);
      });

      it("membership level trigger: value == 'gold'", () => {
        expect(evaluateExpression("value == 'gold'", "gold")).toBe(true);
        expect(evaluateExpression("value == 'gold'", "silver")).toBe(false);
      });

      it("purchase amount trigger: value > 1000", () => {
        expect(evaluateExpression("value > 1000", 1500)).toBe(true);
        expect(evaluateExpression("value > 1000", 500)).toBe(false);
      });

      it("range trigger: value >= 18 && value <= 65", () => {
        expect(evaluateExpression("value >= 18 && value <= 65", 30)).toBe(true);
        expect(evaluateExpression("value >= 18 && value <= 65", 17)).toBe(false);
        expect(evaluateExpression("value >= 18 && value <= 65", 70)).toBe(false);
      });

      it("boolean flag trigger", () => {
        expect(evaluateExpression("value == true", true)).toBe(true);
        expect(evaluateExpression("value == true", false)).toBe(false);
      });

      it("string contains trigger using includes()", () => {
        expect(evaluateExpression("includes(value, 'vip')", "vip-customer")).toBe(true);
        expect(evaluateExpression("includes(value, 'vip')", "regular-customer")).toBe(false);
      });
    });
  });
});
