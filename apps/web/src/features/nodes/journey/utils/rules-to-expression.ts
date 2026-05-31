/**
 * Rules-to-Expression Conversion Utility
 *
 * Converts visual condition rules to JEXL expression strings.
 * Used when switching from Rules mode to Expression mode in the condition node editor.
 */

import type { ConditionRule } from "@journey/schemas";

/**
 * Convert an array of condition rules to a JEXL expression string.
 *
 * @param rules - Array of condition rules
 * @param rulesOperator - How to combine rules ("and" or "or")
 * @returns JEXL expression string
 *
 * @example
 * ```ts
 * rulesToExpression([
 *   { field: "user.score", operator: "greaterThan", value: 50 },
 *   { field: "user.verified", operator: "equals", value: true }
 * ], "and")
 * // Returns: "user.score > 50 && user.verified === true"
 * ```
 */
export function rulesToExpression(rules: ConditionRule[], rulesOperator: "and" | "or" = "and"): string {
  if (!rules || rules.length === 0) {
    return "";
  }

  const joiner = rulesOperator === "and" ? " && " : " || ";
  const expressions = rules.map(ruleToExpression).filter(Boolean);

  if (expressions.length === 0) {
    return "";
  }

  // Wrap each expression in parentheses if there are multiple
  if (expressions.length > 1) {
    return expressions.map((expr) => `(${expr})`).join(joiner);
  }

  return expressions[0];
}

/**
 * Convert a single condition rule to a JEXL expression.
 *
 * @param rule - A single condition rule
 * @returns JEXL expression string for the rule
 */
function ruleToExpression(rule: ConditionRule): string {
  const { field, operator, value } = rule;

  if (!field) {
    return "";
  }

  // Format the value for the expression
  const formattedValue = formatValue(value);

  switch (operator) {
    // Equality operators
    case "equals":
      return `${field} === ${formattedValue}`;
    case "notEquals":
      return `${field} !== ${formattedValue}`;

    // Comparison operators
    case "greaterThan":
      return `${field} > ${formattedValue}`;
    case "greaterThanOrEqual":
      return `${field} >= ${formattedValue}`;
    case "lessThan":
      return `${field} < ${formattedValue}`;
    case "lessThanOrEqual":
      return `${field} <= ${formattedValue}`;

    // String/Array operators
    case "contains":
      return `${field}.includes(${formattedValue})`;
    case "notContains":
      return `!${field}.includes(${formattedValue})`;
    case "startsWith":
      return `${field}.startsWith(${formattedValue})`;
    case "endsWith":
      return `${field}.endsWith(${formattedValue})`;

    // Existence operators
    case "exists":
      return `${field} != null`;
    case "notExists":
      return `${field} == null`;

    // Regex operator
    case "matches":
      // For regex, the value should be a regex pattern string
      return `${field}.match(${formattedValue})`;

    default:
      // Fallback for unknown operators
      return `${field} === ${formattedValue}`;
  }
}

/**
 * Format a value for use in a JEXL expression.
 * Handles strings, numbers, booleans, and null/undefined.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    // Check if it's a template variable reference
    if (value.startsWith("{{") && value.endsWith("}}")) {
      // Extract the variable path and use it directly
      return value.slice(2, -2).trim();
    }
    // Escape quotes in the string and wrap in quotes
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  // For objects/arrays, use JSON
  return JSON.stringify(value);
}

/**
 * Check if an expression can be converted back to rules.
 * Simple expressions with basic operators can be converted.
 * Complex expressions with ternaries, function calls, etc. cannot.
 *
 * @param expression - JEXL expression string
 * @returns Whether the expression can be converted to rules
 */
export function canConvertToRules(expression: string): boolean {
  if (!expression || !expression.trim()) {
    return true; // Empty expression can be "converted" to empty rules
  }

  // Check for complex patterns that can't be converted
  const complexPatterns = [
    /\?.*:/, // Ternary operator
    /\(.*\(/, // Nested function calls
    /\|/, // Pipe transforms
    /\+|-|\*|\/|%/, // Arithmetic operators
  ];

  return !complexPatterns.some((pattern) => pattern.test(expression));
}
