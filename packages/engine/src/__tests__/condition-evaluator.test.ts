import type { ConditionNodeData } from "@journey/schemas";
import { describe, expect, it, vi } from "vitest";
import { createConditionEvaluator } from "../services/condition-evaluator";

describe("ConditionEvaluator", () => {
  describe("Expression Evaluation", () => {
    it("should evaluate simple boolean expression (true)", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        expression: "score > 50",
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      const result = evaluator.evaluate(conditionData, { score: 75 });
      expect(result).toBe("yes");
    });

    it("should evaluate simple boolean expression (false)", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        expression: "score > 50",
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      const result = evaluator.evaluate(conditionData, { score: 30 });
      expect(result).toBe("no");
    });

    it("should handle equality expressions", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        expression: "status == true",
        rulesOperator: "and",
        branches: [
          { id: "active", label: "True", isDefault: false },
          { id: "inactive", label: "False", isDefault: true },
        ],
      };

      const result = evaluator.evaluate(conditionData, { status: true });
      expect(result).toBe("active");
    });

    it("should handle complex expressions", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        expression: "(score > 50) && (level >= 3)",
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { score: 75, level: 5 })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { score: 75, level: 2 })).toBe("no");
      expect(evaluator.evaluate(conditionData, { score: 30, level: 5 })).toBe("no");
    });

    it("should log warning and fallback on invalid expression", () => {
      const onWarn = vi.fn();
      const evaluator = createConditionEvaluator({ onWarn });

      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        expression: "invalid_syntax *** @@@ ",
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "default", label: "Default", isDefault: true },
        ],
      };

      const result = evaluator.evaluate(conditionData, {});
      expect(onWarn).toHaveBeenCalled();
      expect(result).toBe("default");
    });
  });

  describe("Rule-Based Evaluation", () => {
    it("should evaluate equals rule", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "tier", operator: "equals", value: "premium" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { tier: "premium" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { tier: "basic" })).toBe("no");
    });

    it("should evaluate notEquals rule", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "status", operator: "notEquals", value: "blocked" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { status: "active" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { status: "blocked" })).toBe("no");
    });

    it("should evaluate contains rule", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "email", operator: "contains", value: "@gmail" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { email: "test@gmail.com" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { email: "test@yahoo.com" })).toBe("no");
    });

    it("should evaluate greaterThan rule", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "age", operator: "greaterThan", value: 18 }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { age: 21 })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { age: 16 })).toBe("no");
      expect(evaluator.evaluate(conditionData, { age: 18 })).toBe("no"); // Not greater, equal
    });

    it("should evaluate exists rule", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "phone", operator: "exists", value: "" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { phone: "123-456" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { phone: null })).toBe("no");
      expect(evaluator.evaluate(conditionData, {})).toBe("no");
    });

    it("should evaluate matches (regex) rule", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "code", operator: "matches", value: "^[A-Z]{3}\\d{3}$" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { code: "ABC123" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { code: "abc123" })).toBe("no");
      expect(evaluator.evaluate(conditionData, { code: "ABCD1234" })).toBe("no");
    });

    it("should combine rules with AND operator", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [
          { field: "age", operator: "greaterThanOrEqual", value: 18 },
          { field: "tier", operator: "equals", value: "premium" },
        ],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { age: 21, tier: "premium" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { age: 21, tier: "basic" })).toBe("no");
      expect(evaluator.evaluate(conditionData, { age: 16, tier: "premium" })).toBe("no");
    });

    it("should combine rules with OR operator", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [
          { field: "tier", operator: "equals", value: "premium" },
          { field: "tier", operator: "equals", value: "enterprise" },
        ],
        rulesOperator: "or",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { tier: "premium" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { tier: "enterprise" })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { tier: "basic" })).toBe("no");
    });
  });

  describe("Template Variable Resolution", () => {
    it("should resolve single template variable in value", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "userResponse.value", operator: "equals", value: "{{user.firstName}}" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      // User response matches user's first name
      expect(
        evaluator.evaluate(conditionData, {
          userResponse: { value: "John" },
          user: { firstName: "John" },
        })
      ).toBe("yes");

      // User response doesn't match
      expect(
        evaluator.evaluate(conditionData, {
          userResponse: { value: "Jane" },
          user: { firstName: "John" },
        })
      ).toBe("no");
    });

    it("should resolve template variable in contains check", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "message", operator: "contains", value: "{{searchTerm}}" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(
        evaluator.evaluate(conditionData, {
          message: "Hello world",
          searchTerm: "world",
        })
      ).toBe("yes");

      expect(
        evaluator.evaluate(conditionData, {
          message: "Hello world",
          searchTerm: "foo",
        })
      ).toBe("no");
    });

    it("should resolve nested template variable path", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "selectedPlan", operator: "equals", value: "{{vars.journey.expectedPlan}}" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(
        evaluator.evaluate(conditionData, {
          selectedPlan: "premium",
          vars: { journey: { expectedPlan: "premium" } },
        })
      ).toBe("yes");
    });

    it("should handle numeric template variable comparison", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "score", operator: "greaterThan", value: "{{threshold}}" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      // When template resolves to a number, comparison should work
      expect(
        evaluator.evaluate(conditionData, {
          score: 75,
          threshold: 50,
        })
      ).toBe("yes");

      expect(
        evaluator.evaluate(conditionData, {
          score: 30,
          threshold: 50,
        })
      ).toBe("no");
    });

    it("should keep original value if template variable not found", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "response", operator: "equals", value: "{{missing.variable}}" }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      // When variable doesn't exist, compare against literal string
      expect(
        evaluator.evaluate(conditionData, {
          response: "{{missing.variable}}",
        })
      ).toBe("yes");
    });
  });

  describe("Edge Cases", () => {
    it("should return default branch when no expression or rules", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rulesOperator: "and",
        branches: [
          { id: "first", label: "First", isDefault: false },
          { id: "default", label: "Default", isDefault: true },
        ],
      };

      const result = evaluator.evaluate(conditionData, {});
      expect(result).toBe("default");
    });

    it("should handle nested field access", () => {
      const evaluator = createConditionEvaluator();
      const conditionData: ConditionNodeData = {
        type: "condition",
        schemaVersion: 1,
        label: "Test Condition",
        rules: [{ field: "user.profile.verified", operator: "equals", value: true }],
        rulesOperator: "and",
        branches: [
          { id: "yes", label: "Yes", isDefault: false },
          { id: "no", label: "No", isDefault: true },
        ],
      };

      expect(evaluator.evaluate(conditionData, { user: { profile: { verified: true } } })).toBe("yes");
      expect(evaluator.evaluate(conditionData, { user: { profile: { verified: false } } })).toBe("no");
      expect(evaluator.evaluate(conditionData, { user: {} })).toBe("no");
    });
  });
});
