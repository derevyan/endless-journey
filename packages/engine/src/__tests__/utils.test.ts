import { describe, expect, it } from "vitest";
import { extractJsonPath, getNestedValue, toExprEvalContext } from "../utils";

describe("Context Utilities", () => {
  describe("getNestedValue", () => {
    it("should get top-level value", () => {
      const result = getNestedValue({ name: "John" }, "name");
      expect(result).toBe("John");
    });

    it("should get nested value", () => {
      const obj = { user: { profile: { name: "John" } } };
      const result = getNestedValue(obj, "user.profile.name");
      expect(result).toBe("John");
    });

    it("should return undefined for missing path", () => {
      const obj = { user: { profile: {} } };
      const result = getNestedValue(obj, "user.profile.name");
      expect(result).toBeUndefined();
    });

    it("should return undefined for partial path", () => {
      const obj = { user: {} };
      const result = getNestedValue(obj, "user.profile.name");
      expect(result).toBeUndefined();
    });

    it("should handle arrays", () => {
      const obj = { items: [1, 2, 3] };
      const result = getNestedValue(obj, "items.1");
      expect(result).toBe(2);
    });
  });

  describe("toExprEvalContext", () => {
    it("should pass through numbers", () => {
      const result = toExprEvalContext({ score: 100 });
      expect(result.score).toBe(100);
    });

    it("should pass through strings", () => {
      const result = toExprEvalContext({ name: "John" });
      expect(result.name).toBe("John");
    });

    it("should convert booleans to 1/0", () => {
      const result = toExprEvalContext({ active: true, disabled: false });
      expect(result.active).toBe(1);
      expect(result.disabled).toBe(0);
    });

    it("should convert null/undefined to 0", () => {
      const result = toExprEvalContext({ a: null, b: undefined });
      expect(result.a).toBe(0);
      expect(result.b).toBe(0);
    });

    it("should JSON stringify objects", () => {
      const result = toExprEvalContext({ obj: { foo: "bar" } });
      expect(result.obj).toBe('{"foo":"bar"}');
    });

    it("should handle mixed context", () => {
      const result = toExprEvalContext({
        count: 5,
        name: "test",
        active: true,
        empty: null,
      });
      expect(result).toEqual({
        count: 5,
        name: "test",
        active: 1,
        empty: 0,
      });
    });
  });
});

describe("JSONPath Utilities", () => {
  describe("extractJsonPath", () => {
    it("should extract simple path", () => {
      const data = { name: "John", age: 30 };
      const result = extractJsonPath(data, "$.name");
      expect(result).toBe("John");
    });

    it("should extract nested path", () => {
      const data = { user: { profile: { name: "John" } } };
      const result = extractJsonPath(data, "$.user.profile.name");
      expect(result).toBe("John");
    });

    it("should extract array element", () => {
      const data = { items: ["a", "b", "c"] };
      const result = extractJsonPath(data, "$.items[1]");
      expect(result).toBe("b");
    });

    it("should return undefined for non-object input", () => {
      // Non-object data cannot be extracted via JSONPath - return undefined
      expect(extractJsonPath("string", "$.path")).toBeUndefined();
      expect(extractJsonPath(123, "$.path")).toBeUndefined();
      expect(extractJsonPath(null, "$.path")).toBeUndefined();
    });

    it("should handle invalid path gracefully", () => {
      const data = { name: "John" };
      const result = extractJsonPath(data, "$.invalid.path");
      // JSONPath returns undefined for invalid paths
      expect(result).toBeUndefined();
    });

    it("should extract from complex structure", () => {
      const data = {
        data: {
          users: [
            { id: 1, name: "John" },
            { id: 2, name: "Jane" },
          ],
        },
      };
      expect(extractJsonPath(data, "$.data.users[0].name")).toBe("John");
      expect(extractJsonPath(data, "$.data.users[1].name")).toBe("Jane");
    });
  });
});

