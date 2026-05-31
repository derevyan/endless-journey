/**
 * Shared Expression Evaluator
 *
 * Consolidates variable path resolution and structured condition evaluation.
 * This is the common implementation used by workflow and engine utilities.
 */

import type { StructuredCondition } from "../agents/workflow/nodes/logic";
import type { ConditionRule } from "../nodes";
import { isEmpty, toNumber, toString } from "../variables/conversions";

type ConditionOperator = StructuredCondition["operator"] | ConditionRule["operator"];

/**
 * Resolve a dot-notation variable path with optional array bracket notation.
 *
 * Examples:
 * - "result.data.name" -> variables.result.data.name
 * - "items[0]" -> variables.items[0]
 * - "user.tags[0]" -> variables.user.tags[0]
 */
export function resolveVariablePath(path: string, variables: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = variables;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    const bracketMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/);
    if (bracketMatch) {
      const [, propertyName, indexStr] = bracketMatch;
      const arrayValue = (current as Record<string, unknown>)[propertyName];

      if (!Array.isArray(arrayValue)) {
        return undefined;
      }

      const index = parseInt(indexStr, 10);
      current = arrayValue[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Evaluate a structured condition against variables.
 */
export function evaluateCondition(condition: StructuredCondition, variables: Record<string, unknown>): boolean {
  const leftValue = resolveVariablePath(condition.left, variables);

  if (condition.operator === "isEmpty") {
    return isEmpty(leftValue);
  }

  if (condition.operator === "isNotEmpty") {
    return !isEmpty(leftValue);
  }

  const rightValue = condition.right;
  return evaluateOperator(condition.operator, leftValue, rightValue);
}

/**
 * Evaluate a condition rule (journey-style field/operator/value).
 */
export function evaluateRule(rule: ConditionRule, variables: Record<string, unknown>): boolean {
  const leftValue = resolveVariablePath(rule.field, variables);

  if (rule.operator === "isEmpty") {
    return isEmpty(leftValue);
  }
  if (rule.operator === "isNotEmpty") {
    return !isEmpty(leftValue);
  }
  if (rule.operator === "exists") {
    return leftValue !== undefined && leftValue !== null;
  }
  if (rule.operator === "notExists") {
    return leftValue === undefined || leftValue === null;
  }

  const rightValue = resolveTemplateInValue(rule.value, variables);
  return evaluateOperator(rule.operator, leftValue, rightValue);
}

/**
 * Resolve {{variable}} templates in a string value.
 */
function resolveTemplateInValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const match = value.match(/^\{\{([^}]+)\}\}$/);
  if (match) {
    const resolved = resolveVariablePath(match[1].trim(), variables);
    return resolved === undefined ? value : resolved;
  }

  return value;
}

/**
 * Lightweight expression evaluation for simple comparisons.
 * Intended for basic "{{path}} operator value" patterns only.
 */
function evaluateExpression(expression: string, variables: Record<string, unknown>): boolean {
  const match = expression.trim().match(
    /^\{\{([^}]+)\}\}\s*(===|!==|>=|<=|>|<|contains|startsWith|endsWith|matches)\s*(.+)$/
  );

  if (!match) {
    return false;
  }

  const [, path, operator, rawRight] = match;
  const leftValue = resolveVariablePath(path.trim(), variables);
  const rightValue = parseLiteral(rawRight.trim());

  return evaluateOperator(operator as ConditionOperator, leftValue, rightValue);
}

function parseLiteral(value: string): unknown {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }
  return trimmed;
}

/**
 * Evaluate a binary operator.
 */
function evaluateOperator(operator: ConditionOperator, left: unknown, right: unknown): boolean {
  switch (operator) {
    case "equals":
    case "===":
      return left === right;
    case "notEquals":
    case "!==":
      return left !== right;
    case "greaterThan":
    case ">":
      return toNumber(left) > toNumber(right);
    case "lessThan":
    case "<":
      return toNumber(left) < toNumber(right);
    case "greaterThanOrEqual":
    case ">=":
      return toNumber(left) >= toNumber(right);
    case "lessThanOrEqual":
    case "<=":
      return toNumber(left) <= toNumber(right);
    case "contains":
      return toString(left).includes(toString(right));
    case "notContains":
      return !toString(left).includes(toString(right));
    case "startsWith":
      return toString(left).startsWith(toString(right));
    case "endsWith":
      return toString(left).endsWith(toString(right));
    case "matches":
      try {
        const regex = new RegExp(toString(right));
        return regex.test(toString(left));
      } catch {
        return false;
      }
    case "isEmpty":
    case "isNotEmpty":
      return false;
    case "exists":
    case "notExists":
      return false;
    default: {
      throw new Error(`Unknown operator: ${String(operator)}`);
    }
  }
}

export class ExpressionEvaluator {
  evaluate(condition: StructuredCondition | string, variables: Record<string, unknown>): boolean {
    if (typeof condition === "string") {
      return evaluateExpression(condition, variables);
    }
    return evaluateCondition(condition, variables);
  }
}

export const expressionEvaluator = new ExpressionEvaluator();
