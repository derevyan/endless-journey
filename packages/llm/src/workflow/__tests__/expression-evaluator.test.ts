/**
 * Expression Evaluator Tests
 *
 * CRITICAL: These tests verify the SAFE expression evaluation system.
 * The evaluator uses structured conditions with explicit operators - NO EVAL!
 */

import { describe, it, expect } from "vitest";
import { evaluateCondition, resolveVariablePath } from "../expression-evaluator";
import type { StructuredCondition } from "@journey/schemas";

describe("resolveVariablePath", () => {
  const variables = {
    user: {
      name: "Alice",
      age: 30,
      tags: ["admin", "beta"],
    },
    count: 5,
    active: true,
    empty: "",
    zero: 0,
    nullValue: null,
  };

  it("resolves simple paths", () => {
    expect(resolveVariablePath("count", variables)).toBe(5);
    expect(resolveVariablePath("active", variables)).toBe(true);
  });

  it("resolves nested paths", () => {
    expect(resolveVariablePath("user.name", variables)).toBe("Alice");
    expect(resolveVariablePath("user.age", variables)).toBe(30);
  });

  it("resolves array access", () => {
    expect(resolveVariablePath("user.tags[0]", variables)).toBe("admin");
    expect(resolveVariablePath("user.tags[1]", variables)).toBe("beta");
  });

  it("returns undefined for non-existent paths", () => {
    expect(resolveVariablePath("nonexistent", variables)).toBeUndefined();
    expect(resolveVariablePath("user.missing", variables)).toBeUndefined();
    expect(resolveVariablePath("user.tags[99]", variables)).toBeUndefined();
  });

  it("handles null and undefined gracefully", () => {
    expect(resolveVariablePath("nullValue.nested", variables)).toBeUndefined();
  });
});

describe("evaluateCondition", () => {
  const variables = {
    result: {
      needs_detail: true,
      confidence: 0.85,
      status: "approved",
    },
    count: 10,
    name: "test",
    empty: "",
    items: ["a", "b", "c"],
    nullValue: null,
  };

  describe("comparison operators", () => {
    it("evaluates === correctly", () => {
      const condition: StructuredCondition = {
        left: "result.status",
        operator: "===",
        right: "approved",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);

      const falseCondition: StructuredCondition = {
        left: "result.status",
        operator: "===",
        right: "rejected",
      };
      expect(evaluateCondition(falseCondition, variables)).toBe(false);
    });

    it("evaluates !== correctly", () => {
      const condition: StructuredCondition = {
        left: "result.status",
        operator: "!==",
        right: "rejected",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates > correctly", () => {
      const condition: StructuredCondition = {
        left: "count",
        operator: ">",
        right: 5,
      };
      expect(evaluateCondition(condition, variables)).toBe(true);

      const falseCondition: StructuredCondition = {
        left: "count",
        operator: ">",
        right: 15,
      };
      expect(evaluateCondition(falseCondition, variables)).toBe(false);
    });

    it("evaluates >= correctly", () => {
      const condition: StructuredCondition = {
        left: "count",
        operator: ">=",
        right: 10,
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates < correctly", () => {
      const condition: StructuredCondition = {
        left: "result.confidence",
        operator: "<",
        right: 0.9,
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates <= correctly", () => {
      const condition: StructuredCondition = {
        left: "result.confidence",
        operator: "<=",
        right: 0.85,
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });
  });

  describe("type checking operators", () => {
    it("evaluates isEmpty for empty string", () => {
      const condition: StructuredCondition = {
        left: "empty",
        operator: "isEmpty",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates isEmpty for null", () => {
      const condition: StructuredCondition = {
        left: "nullValue",
        operator: "isEmpty",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates isEmpty for undefined", () => {
      const condition: StructuredCondition = {
        left: "nonexistent",
        operator: "isEmpty",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates isEmpty for non-empty value", () => {
      const condition: StructuredCondition = {
        left: "name",
        operator: "isEmpty",
      };
      expect(evaluateCondition(condition, variables)).toBe(false);
    });

    it("evaluates isNotEmpty correctly", () => {
      const condition: StructuredCondition = {
        left: "name",
        operator: "isNotEmpty",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);

      const emptyCondition: StructuredCondition = {
        left: "empty",
        operator: "isNotEmpty",
      };
      expect(evaluateCondition(emptyCondition, variables)).toBe(false);
    });
  });

  describe("string operators", () => {
    it("evaluates contains correctly", () => {
      const condition: StructuredCondition = {
        left: "name",
        operator: "contains",
        right: "es",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);

      const falseCondition: StructuredCondition = {
        left: "name",
        operator: "contains",
        right: "xyz",
      };
      expect(evaluateCondition(falseCondition, variables)).toBe(false);
    });

    it("evaluates startsWith correctly", () => {
      const condition: StructuredCondition = {
        left: "name",
        operator: "startsWith",
        right: "te",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates endsWith correctly", () => {
      const condition: StructuredCondition = {
        left: "name",
        operator: "endsWith",
        right: "st",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });
  });

  describe("array operators", () => {
    it("evaluates contains for arrays correctly", () => {
      // Note: "contains" works for both strings AND arrays
      const condition: StructuredCondition = {
        left: "items",
        operator: "contains",
        right: "b",
      };
      // Arrays are converted to JSON string, so we check if it contains "b"
      expect(evaluateCondition(condition, variables)).toBe(true);

      const falseCondition: StructuredCondition = {
        left: "items",
        operator: "contains",
        right: "z",
      };
      expect(evaluateCondition(falseCondition, variables)).toBe(false);
    });
  });

  describe("boolean conditions", () => {
    it("evaluates truthy values with ===", () => {
      const condition: StructuredCondition = {
        left: "result.needs_detail",
        operator: "===",
        right: true,
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });

    it("evaluates falsy values with ===", () => {
      const condition: StructuredCondition = {
        left: "result.needs_detail",
        operator: "===",
        right: false,
      };
      expect(evaluateCondition(condition, variables)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles missing left variable gracefully", () => {
      const condition: StructuredCondition = {
        left: "missing.path",
        operator: "===",
        right: "value",
      };
      expect(evaluateCondition(condition, variables)).toBe(false);
    });

    it("compares undefined values correctly", () => {
      const condition: StructuredCondition = {
        left: "nonexistent",
        operator: "isEmpty",
      };
      expect(evaluateCondition(condition, variables)).toBe(true);
    });
  });
});
