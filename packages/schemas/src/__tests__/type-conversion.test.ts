/**
 * Type Conversion Utilities - Unit Tests
 *
 * Tests for type conversion functions used across engine, workflow, and LLM tools.
 * These are critical for consistent behavior in condition expressions.
 */

import { describe, expect, it } from "vitest";
import {
  isEmpty,
  isTruthy,
  toNumber,
  toString,
  toExprEvalContext,
  prepareForCondition,
} from "../variables";

describe("type-conversion", () => {
  // ===========================================================================
  // isEmpty
  // ===========================================================================

  describe("isEmpty", () => {
    describe("should return true for empty values", () => {
      it("null is empty", () => {
        expect(isEmpty(null)).toBe(true);
      });

      it("undefined is empty", () => {
        expect(isEmpty(undefined)).toBe(true);
      });

      it("empty string is empty", () => {
        expect(isEmpty("")).toBe(true);
      });

      it("whitespace-only string is empty", () => {
        expect(isEmpty("   ")).toBe(true);
        expect(isEmpty("\t\n")).toBe(true);
      });

      it("empty array is empty", () => {
        expect(isEmpty([])).toBe(true);
      });

      it("empty object is empty", () => {
        expect(isEmpty({})).toBe(true);
      });
    });

    describe("should return false for non-empty values", () => {
      it("0 is not empty (valid number)", () => {
        expect(isEmpty(0)).toBe(false);
      });

      it("false is not empty (valid boolean)", () => {
        expect(isEmpty(false)).toBe(false);
      });

      it("non-empty string is not empty", () => {
        expect(isEmpty("hello")).toBe(false);
        expect(isEmpty("0")).toBe(false);
        expect(isEmpty("false")).toBe(false);
      });

      it("non-empty array is not empty", () => {
        expect(isEmpty([1, 2, 3])).toBe(false);
        expect(isEmpty([null])).toBe(false);
      });

      it("object with keys is not empty", () => {
        expect(isEmpty({ a: 1 })).toBe(false);
        expect(isEmpty({ key: null })).toBe(false);
      });

      it("NaN is not empty", () => {
        expect(isEmpty(NaN)).toBe(false);
      });
    });
  });

  // ===========================================================================
  // isTruthy
  // ===========================================================================

  describe("isTruthy", () => {
    describe("falsy values", () => {
      it("null is falsy", () => {
        expect(isTruthy(null)).toBe(false);
      });

      it("undefined is falsy", () => {
        expect(isTruthy(undefined)).toBe(false);
      });

      it("false is falsy", () => {
        expect(isTruthy(false)).toBe(false);
      });

      it("0 is falsy", () => {
        expect(isTruthy(0)).toBe(false);
      });

      it("empty string is falsy", () => {
        expect(isTruthy("")).toBe(false);
      });

      it("whitespace-only string is falsy", () => {
        expect(isTruthy("   ")).toBe(false);
        expect(isTruthy("\t")).toBe(false);
      });

      it("empty array is falsy", () => {
        expect(isTruthy([])).toBe(false);
      });

      it("NaN is falsy", () => {
        expect(isTruthy(NaN)).toBe(false);
      });
    });

    describe("truthy values", () => {
      it("true is truthy", () => {
        expect(isTruthy(true)).toBe(true);
      });

      it("non-zero numbers are truthy", () => {
        expect(isTruthy(1)).toBe(true);
        expect(isTruthy(-1)).toBe(true);
        expect(isTruthy(0.1)).toBe(true);
        expect(isTruthy(Infinity)).toBe(true);
      });

      it("non-empty string is truthy", () => {
        expect(isTruthy("hello")).toBe(true);
        expect(isTruthy("0")).toBe(true);
      });

      it("string 'false' is TRUTHY (non-empty string)", () => {
        // This is intentional: "false" as a string is non-empty
        expect(isTruthy("false")).toBe(true);
      });

      it("non-empty array is truthy", () => {
        expect(isTruthy([1])).toBe(true);
        expect(isTruthy([null])).toBe(true);
      });

      it("empty object is truthy", () => {
        // Objects are truthy (unlike arrays)
        expect(isTruthy({})).toBe(true);
      });

      it("functions are truthy", () => {
        expect(isTruthy(() => {})).toBe(true);
      });
    });
  });

  // ===========================================================================
  // toNumber
  // ===========================================================================

  describe("toNumber", () => {
    describe("numbers", () => {
      it("returns number as-is", () => {
        expect(toNumber(42)).toBe(42);
        expect(toNumber(-5)).toBe(-5);
        expect(toNumber(3.14)).toBe(3.14);
      });

      it("returns 0 for NaN", () => {
        expect(toNumber(NaN)).toBe(0);
      });

      it("preserves Infinity", () => {
        expect(toNumber(Infinity)).toBe(Infinity);
        expect(toNumber(-Infinity)).toBe(-Infinity);
      });
    });

    describe("strings", () => {
      it("parses numeric strings", () => {
        expect(toNumber("42")).toBe(42);
        expect(toNumber("3.14")).toBe(3.14);
        expect(toNumber("-5")).toBe(-5);
      });

      it("returns 0 for non-numeric strings", () => {
        expect(toNumber("hello")).toBe(0);
        expect(toNumber("")).toBe(0);
        expect(toNumber("abc123")).toBe(0);
      });

      it("parses strings with leading numbers", () => {
        expect(toNumber("123abc")).toBe(123);
      });
    });

    describe("booleans", () => {
      it("true becomes 1", () => {
        expect(toNumber(true)).toBe(1);
      });

      it("false becomes 0", () => {
        expect(toNumber(false)).toBe(0);
      });
    });

    describe("null and undefined", () => {
      it("null becomes 0", () => {
        expect(toNumber(null)).toBe(0);
      });

      it("undefined becomes 0", () => {
        expect(toNumber(undefined)).toBe(0);
      });
    });

    describe("other types", () => {
      it("objects become 0", () => {
        expect(toNumber({})).toBe(0);
        expect(toNumber({ a: 1 })).toBe(0);
      });

      it("arrays become 0", () => {
        expect(toNumber([])).toBe(0);
        expect(toNumber([1, 2, 3])).toBe(0);
      });
    });
  });

  // ===========================================================================
  // toString
  // ===========================================================================

  describe("toString", () => {
    describe("strings", () => {
      it("returns string as-is", () => {
        expect(toString("hello")).toBe("hello");
        expect(toString("")).toBe("");
      });
    });

    describe("numbers", () => {
      it("converts numbers to string", () => {
        expect(toString(42)).toBe("42");
        expect(toString(3.14)).toBe("3.14");
        expect(toString(-5)).toBe("-5");
      });
    });

    describe("booleans", () => {
      it("converts booleans to string", () => {
        expect(toString(true)).toBe("true");
        expect(toString(false)).toBe("false");
      });
    });

    describe("null and undefined", () => {
      it("null becomes empty string", () => {
        expect(toString(null)).toBe("");
      });

      it("undefined becomes empty string", () => {
        expect(toString(undefined)).toBe("");
      });
    });

    describe("objects and arrays", () => {
      it("objects become JSON string", () => {
        expect(toString({ a: 1 })).toBe('{"a":1}');
        expect(toString({ foo: "bar" })).toBe('{"foo":"bar"}');
      });

      it("arrays become JSON string", () => {
        expect(toString([1, 2, 3])).toBe("[1,2,3]");
        expect(toString(["a", "b"])).toBe('["a","b"]');
      });

      it("empty object becomes {}", () => {
        expect(toString({})).toBe("{}");
      });

      it("empty array becomes []", () => {
        expect(toString([])).toBe("[]");
      });
    });
  });

  // ===========================================================================
  // toExprEvalContext
  // ===========================================================================

  describe("toExprEvalContext", () => {
    it("converts mixed context to expr-eval format", () => {
      const result = toExprEvalContext({
        active: true,
        count: 5,
        name: "test",
        data: null,
        items: [1, 2],
      });

      expect(result).toEqual({
        active: 1,
        count: 5,
        name: "test",
        data: 0,
        items: "[1,2]",
      });
    });

    it("preserves numbers", () => {
      const result = toExprEvalContext({ x: 42, y: 3.14 });
      expect(result.x).toBe(42);
      expect(result.y).toBe(3.14);
    });

    it("preserves strings", () => {
      const result = toExprEvalContext({ name: "hello" });
      expect(result.name).toBe("hello");
    });

    it("converts booleans to 1/0", () => {
      const result = toExprEvalContext({ a: true, b: false });
      expect(result.a).toBe(1);
      expect(result.b).toBe(0);
    });

    it("converts null/undefined to 0", () => {
      const result = toExprEvalContext({ a: null, b: undefined });
      expect(result.a).toBe(0);
      expect(result.b).toBe(0);
    });

    it("converts NaN to 0", () => {
      const result = toExprEvalContext({ x: NaN });
      expect(result.x).toBe(0);
    });

    it("stringifies objects", () => {
      const result = toExprEvalContext({ obj: { nested: true } });
      expect(result.obj).toBe('{"nested":true}');
    });

    it("stringifies arrays", () => {
      const result = toExprEvalContext({ arr: [1, "two", 3] });
      expect(result.arr).toBe('[1,"two",3]');
    });

    it("returns empty object for empty input", () => {
      const result = toExprEvalContext({});
      expect(result).toEqual({});
    });
  });

  // ===========================================================================
  // prepareForCondition
  // ===========================================================================

  describe("prepareForCondition", () => {
    describe("numbers", () => {
      it("returns number as-is", () => {
        expect(prepareForCondition(42)).toBe(42);
        expect(prepareForCondition(0)).toBe(0);
        expect(prepareForCondition(-5)).toBe(-5);
      });

      it("converts NaN to 0", () => {
        expect(prepareForCondition(NaN)).toBe(0);
      });
    });

    describe("strings", () => {
      it("returns string as-is", () => {
        expect(prepareForCondition("hello")).toBe("hello");
        expect(prepareForCondition("")).toBe("");
      });
    });

    describe("booleans", () => {
      it("true becomes 1", () => {
        expect(prepareForCondition(true)).toBe(1);
      });

      it("false becomes 0", () => {
        expect(prepareForCondition(false)).toBe(0);
      });
    });

    describe("null and undefined", () => {
      it("null becomes 0", () => {
        expect(prepareForCondition(null)).toBe(0);
      });

      it("undefined becomes 0", () => {
        expect(prepareForCondition(undefined)).toBe(0);
      });
    });

    describe("arrays", () => {
      it("returns array length (for 'has items' checks)", () => {
        expect(prepareForCondition([1, 2, 3])).toBe(3);
        expect(prepareForCondition(["a"])).toBe(1);
      });

      it("empty array returns 0", () => {
        expect(prepareForCondition([])).toBe(0);
      });
    });

    describe("objects", () => {
      it("returns key count (for 'has properties' checks)", () => {
        expect(prepareForCondition({ a: 1, b: 2 })).toBe(2);
        expect(prepareForCondition({ x: "y" })).toBe(1);
      });

      it("empty object returns 0", () => {
        expect(prepareForCondition({})).toBe(0);
      });
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe("edge cases", () => {
    it("handles deeply nested objects in toString", () => {
      const nested = { a: { b: { c: { d: 1 } } } };
      expect(toString(nested)).toBe('{"a":{"b":{"c":{"d":1}}}}');
    });

    it("handles special string values consistently", () => {
      // These are important edge cases for form inputs
      expect(isTruthy("0")).toBe(true); // "0" is a non-empty string
      expect(isTruthy("null")).toBe(true); // "null" is a non-empty string
      expect(isTruthy("undefined")).toBe(true); // "undefined" is a non-empty string
      expect(isTruthy("false")).toBe(true); // "false" is a non-empty string
    });

    it("toNumber handles edge cases", () => {
      expect(toNumber("  42  ")).toBe(42); // Whitespace is trimmed by parseFloat
      expect(toNumber(".5")).toBe(0.5);
      expect(toNumber("1e10")).toBe(1e10);
    });

    it("all functions are idempotent for their target types", () => {
      // Numbers through toNumber
      expect(toNumber(toNumber(42))).toBe(42);

      // Strings through toString
      expect(toString(toString("hello"))).toBe("hello");
    });
  });
});
