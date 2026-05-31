/**
 * Condition Evaluator Service
 *
 * Evaluates condition nodes using either:
 * 1. Expression-based evaluation (JEXL via expression-service)
 * 2. Rule-based evaluation (field/operator/value comparisons)
 */

import type { ConditionNodeData } from "@journey/schemas";
import { evaluateRule } from "@journey/schemas";
import type { ConditionEvaluatorService } from "../types";
import { evaluateExpressionSync } from "./expression-service";

/** Options for creating a condition evaluator */
export interface ConditionEvaluatorOptions {
  /** Optional logger for debugging */
  onDebug?: (message: string, data: Record<string, unknown>) => void;

  /** Optional warning logger */
  onWarn?: (message: string, data: Record<string, unknown>) => void;
}

/**
 * Create a condition evaluator service
 *
 * @param options - Optional configuration
 * @returns ConditionEvaluatorService implementation
 *
 * @example
 * ```ts
 * const evaluator = createConditionEvaluator();
 * const branchId = evaluator.evaluate(conditionData, { score: 75 });
 * ```
 */
export function createConditionEvaluator(options: ConditionEvaluatorOptions = {}): ConditionEvaluatorService {
  const { onDebug, onWarn } = options;

  /**
   * Find matching branch based on boolean result
   */
  function findBranchForBoolean(branches: ConditionNodeData["branches"], result: boolean): string {
    const matchingBranch = branches.find((b) => {
      const label = b.label.toLowerCase();
      if (result) {
        return label === "yes" || label === "true" || b.id === "yes" || b.id === "true";
      } else {
        return label === "no" || label === "false" || b.id === "no" || b.id === "false" || b.isDefault;
      }
    });
    return matchingBranch?.id || branches[0]?.id || "default";
  }

  return {
    evaluate(conditionData: ConditionNodeData, context: Record<string, unknown>): string {
      // Try expression-based evaluation first
      if (conditionData.expression) {
        try {
          const result = evaluateExpressionSync(conditionData.expression, context);

          onDebug?.("condition:expression", { expression: conditionData.expression, result, context });

          // If result is boolean, find matching branch
          if (typeof result === "boolean") {
            return findBranchForBoolean(conditionData.branches, result);
          }

          // If result is string/number, try to match branch by id or label
          const stringResult = String(result);
          const matchingBranch = conditionData.branches.find((b) => b.id === stringResult || b.label === stringResult);
          return matchingBranch?.id || conditionData.branches[0]?.id || "default";
        } catch (error) {
          onWarn?.("condition:expressionError", {
            expression: conditionData.expression,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Fall back to rule-based evaluation
      if (conditionData.rules && conditionData.rules.length > 0) {
        const ruleResults = conditionData.rules.map((rule) => {
          try {
            return evaluateRule(rule, context);
          } catch (error) {
            onWarn?.("condition:ruleError", { rule, error: String(error) });
            return false;
          }
        });
        const operator = conditionData.rulesOperator || "and";
        const allRulesPass = operator === "and" ? ruleResults.every(Boolean) : ruleResults.some(Boolean);

        onDebug?.("condition:rules", {
          rules: conditionData.rules,
          ruleResults,
          operator,
          allRulesPass,
        });

        return findBranchForBoolean(conditionData.branches, allRulesPass);
      }

      // No expression or rules - return default branch
      const defaultBranch = conditionData.branches.find((b) => b.isDefault);
      return defaultBranch?.id || conditionData.branches[0]?.id || "default";
    },
  };
}
