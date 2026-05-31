import { describe, expect, it } from "vitest";
import { evaluateExpression, evaluateExpressionSync, getAvailableFunctions } from "../services/expression-service";

describe("Expression Service", () => {
  describe("evaluateExpressionSync", () => {
    describe("basic path access", () => {
      it("should access simple property", () => {
        const result = evaluateExpressionSync("name", { name: "John" });
        expect(result).toBe("John");
      });

      it("should access nested property", () => {
        const result = evaluateExpressionSync("user.profile.name", {
          user: { profile: { name: "John" } },
        });
        expect(result).toBe("John");
      });

      it("should return undefined for missing property", () => {
        const result = evaluateExpressionSync("user.missing", { user: {} });
        expect(result).toBeUndefined();
      });
    });

    describe("string functions", () => {
      it("should uppercase string", () => {
        const result = evaluateExpressionSync("upper(name)", { name: "john" });
        expect(result).toBe("JOHN");
      });

      it("should lowercase string", () => {
        const result = evaluateExpressionSync("lower(name)", { name: "JOHN" });
        expect(result).toBe("john");
      });

      it("should trim string", () => {
        const result = evaluateExpressionSync("trim(name)", { name: "  john  " });
        expect(result).toBe("john");
      });

      it("should capitalize string", () => {
        const result = evaluateExpressionSync("capitalize(name)", { name: "jOHN" });
        expect(result).toBe("John");
      });

      it("should get string length", () => {
        const result = evaluateExpressionSync("length(name)", { name: "john" });
        expect(result).toBe(4);
      });

      it("should handle null/undefined in upper", () => {
        const result = evaluateExpressionSync("upper(missing)", { missing: null });
        expect(result).toBe("");
      });
    });

    describe("conditional functions", () => {
      it("should return fallback with default function", () => {
        const result = evaluateExpressionSync("default(missing, 'fallback')", {});
        expect(result).toBe("fallback");
      });

      it("should return value with default function when exists", () => {
        const result = evaluateExpressionSync("default(name, 'fallback')", { name: "John" });
        expect(result).toBe("John");
      });

      it("should check isEmpty for null", () => {
        const result = evaluateExpressionSync("isEmpty(value)", { value: null });
        expect(result).toBe(true);
      });

      it("should check isEmpty for empty string", () => {
        const result = evaluateExpressionSync("isEmpty(value)", { value: "" });
        expect(result).toBe(true);
      });

      it("should check isEmpty for empty array", () => {
        const result = evaluateExpressionSync("isEmpty(items)", { items: [] });
        expect(result).toBe(true);
      });

      it("should check isEmpty for non-empty", () => {
        const result = evaluateExpressionSync("isEmpty(name)", { name: "John" });
        expect(result).toBe(false);
      });
    });

    describe("array functions", () => {
      it("should get first element", () => {
        const result = evaluateExpressionSync("first(items)", { items: ["a", "b", "c"] });
        expect(result).toBe("a");
      });

      it("should get last element", () => {
        const result = evaluateExpressionSync("last(items)", { items: ["a", "b", "c"] });
        expect(result).toBe("c");
      });

      it("should join array", () => {
        const result = evaluateExpressionSync("join(items, ', ')", { items: ["a", "b", "c"] });
        expect(result).toBe("a, b, c");
      });

      it("should check includes for array", () => {
        const result = evaluateExpressionSync("includes(items, 'b')", { items: ["a", "b", "c"] });
        expect(result).toBe(true);
      });

      it("should get array length", () => {
        const result = evaluateExpressionSync("length(items)", { items: [1, 2, 3, 4, 5] });
        expect(result).toBe(5);
      });
    });

    describe("number functions", () => {
      it("should round number", () => {
        const result = evaluateExpressionSync("round(3.14159, 2)", {});
        expect(result).toBe(3.14);
      });

      it("should floor number", () => {
        const result = evaluateExpressionSync("floor(3.7)", {});
        expect(result).toBe(3);
      });

      it("should ceil number", () => {
        const result = evaluateExpressionSync("ceil(3.2)", {});
        expect(result).toBe(4);
      });

      it("should get absolute value", () => {
        const result = evaluateExpressionSync("abs(-5)", {});
        expect(result).toBe(5);
      });
    });

    describe("ternary expressions", () => {
      it("should evaluate true condition", () => {
        const result = evaluateExpressionSync("points > 100 ? 'VIP' : 'Standard'", { points: 150 });
        expect(result).toBe("VIP");
      });

      it("should evaluate false condition", () => {
        const result = evaluateExpressionSync("points > 100 ? 'VIP' : 'Standard'", { points: 50 });
        expect(result).toBe("Standard");
      });
    });

    describe("transforms (pipe syntax)", () => {
      it("should transform with upper", () => {
        const result = evaluateExpressionSync("name|upper", { name: "john" });
        expect(result).toBe("JOHN");
      });

      it("should transform with lower", () => {
        const result = evaluateExpressionSync("name|lower", { name: "JOHN" });
        expect(result).toBe("john");
      });

      it("should transform with first", () => {
        const result = evaluateExpressionSync("items|first", { items: ["a", "b", "c"] });
        expect(result).toBe("a");
      });

      it("should chain transforms", () => {
        const result = evaluateExpressionSync("name|trim|upper", { name: "  john  " });
        expect(result).toBe("JOHN");
      });
    });

    describe("json functions", () => {
      it("should stringify object", () => {
        const result = evaluateExpressionSync("json(data)", { data: { name: "John" } });
        expect(result).toBe('{"name":"John"}');
      });

      it("should parse JSON string", () => {
        const result = evaluateExpressionSync("parse(jsonStr)", { jsonStr: '{"name":"John"}' });
        expect(result).toEqual({ name: "John" });
      });

      it("should return null for invalid JSON", () => {
        const result = evaluateExpressionSync("parse(invalid)", { invalid: "not json" });
        expect(result).toBeNull();
      });
    });

    describe("complex expressions", () => {
      it("should combine functions", () => {
        const result = evaluateExpressionSync("upper(default(user.name, 'Guest'))", {
          user: { name: "john" },
        });
        expect(result).toBe("JOHN");
      });

      it("should use fallback in complex expression", () => {
        const result = evaluateExpressionSync("upper(default(user.name, 'Guest'))", {
          user: {},
        });
        expect(result).toBe("GUEST");
      });

      it("should access node outputs", () => {
        const result = evaluateExpressionSync("nodes.Get_Customer.email", {
          nodes: {
            Get_Customer: { email: "john@example.com" },
          },
        });
        expect(result).toBe("john@example.com");
      });
    });
  });

  describe("evaluateExpression (async)", () => {
    it("should evaluate expression asynchronously", async () => {
      const result = await evaluateExpression("upper(name)", { name: "john" });
      expect(result).toBe("JOHN");
    });
  });

  describe("getAvailableFunctions", () => {
    it("should return list of available functions", () => {
      const functions = getAvailableFunctions();
      expect(functions).toContain("upper");
      expect(functions).toContain("lower");
      expect(functions).toContain("default");
      expect(functions).toContain("first");
      expect(functions).toContain("round");
      expect(functions).toContain("now");
      expect(functions).toContain("json");
    });
  });
});

