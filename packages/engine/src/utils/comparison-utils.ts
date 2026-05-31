/**
 * Comparison Utilities (INTERNAL)
 *
 * NOTE: Condition node evaluation should use the shared evaluator in
 * `@journey/schemas` (evaluateRule/evaluateCondition). This module remains
 * for engine-specific guard comparisons and edge utilities.
 *
 * Shared comparison logic used by:
 * - guard-utils.ts (GuardVariableCondition evaluation)
 *
 * Single source of truth for:
 * - Type coercion (numeric strings)
 * - Template variable resolution ({{path}} syntax)
 * - Comparison operators with consistent semantics
 * - ReDoS protection for regex patterns
 */

import { createLogger } from "@journey/logger";
import { getNestedValue } from "./context";

const log = createLogger("comparison-utils");

// ============================================================================
// REGEX SAFETY (ReDoS Protection)
// ============================================================================

// Regex complexity limits to prevent ReDoS attacks
const MAX_REGEX_LENGTH = 100;
const MAX_INPUT_LENGTH = 10000;
const UNSAFE_REGEX_PATTERNS = [
  /\(\?[^)]*\)\+/, // Nested quantifiers with groups
  /\(\.\*\)\+/, // (.*)+
  /\(\.\+\)\+/, // (.+)+
  /\([^)]+\)\{[^}]+\}\+/, // Group with quantifier followed by +
  /\([^)]*\|[^)]*\)\+/, // Alternation in group with quantifier: (a|b)+
  /\([^)]*\|[^)]*\)\*/, // Alternation in group with star: (a|b)*
  /\(\.\*\)\*/, // (.*)*
  /\(\.\+\)\*/, // (.+)*
];

/**
 * Check if a regex pattern is potentially dangerous (ReDoS)
 */
export function isSafeRegex(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) {
    return false;
  }
  return !UNSAFE_REGEX_PATTERNS.some((unsafe) => unsafe.test(pattern));
}

/**
 * Execute regex test with input length protection
 * Returns false if input is too long (prevents long matching times)
 */
export function testRegexSafely(regex: RegExp, text: string): boolean {
  if (text.length > MAX_INPUT_LENGTH) {
    return false;
  }
  return regex.test(text);
}

// ============================================================================
// TYPE COERCION
// ============================================================================

/**
 * Coerce value to number if it's a numeric string
 * Returns NaN if not a valid number
 *
 * @example
 * toNumber(50) // 50
 * toNumber("50") // 50
 * toNumber(" 50 ") // 50 (handles whitespace)
 * toNumber("abc") // NaN
 * toNumber("") // NaN
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return NaN;
    return Number(trimmed);
  }
  return NaN;
}

// ============================================================================
// TEMPLATE RESOLUTION
// ============================================================================

/**
 * Resolve template variables in a value
 * Supports {{path.to.value}} syntax for dynamic comparisons
 *
 * @param value - The value that may contain template variables
 * @param context - The context for variable resolution
 * @returns The resolved value (preserves type for single-variable templates)
 *
 * @example
 * // Single variable - preserves type
 * resolveTemplateValue("{{user.score}}", { user: { score: 75 } }) // 75 (number)
 *
 * // Multiple variables - returns string
 * resolveTemplateValue("Hello {{name}}!", { name: "World" }) // "Hello World!"
 *
 * // No variables - passthrough
 * resolveTemplateValue(42, {}) // 42
 */
export function resolveTemplateValue(
  value: string | number | boolean | undefined | unknown,
  context: Record<string, unknown>
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Check if the entire value is a single template variable: {{path}}
  const singleVarMatch = value.match(/^\{\{([^}]+)\}\}$/);
  if (singleVarMatch) {
    const path = singleVarMatch[1].trim();
    const resolved = getNestedValue(context, path);
    return resolved !== undefined ? resolved : value;
  }

  // Check if value contains template variables that need substitution
  if (value.includes("{{")) {
    return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const resolved = getNestedValue(context, path.trim());
      return resolved !== undefined && resolved !== null ? String(resolved) : match;
    });
  }

  return value;
}

// ============================================================================
// COMPARISON OPERATORS
// ============================================================================

/**
 * Comparison operators supported by both guards and conditions
 *
 * Guard-style: gt, gte, lt, lte (shorter names)
 * Condition-style: greaterThan, greaterThanOrEqual, etc. (aliases)
 */
export type ComparisonOperator =
  | "equals"
  | "notEquals"
  | "gt"
  | "gte"
  | "lt"
  | "lte" // Guard-style (short)
  | "greaterThan"
  | "greaterThanOrEqual" // Condition-style (aliases)
  | "lessThan"
  | "lessThanOrEqual"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "exists"
  | "notExists";

/**
 * Options for comparison behavior
 */
export interface CompareOptions {
  /** Logger for warnings (e.g., invalid regex) */
  logger?: ReturnType<typeof createLogger>;
  /** Legacy callback for warnings (deprecated - use logger instead) */
  onWarn?: (message: string, data: Record<string, unknown>) => void;
}

/**
 * Compare two values using the specified operator
 * Handles type coercion for numeric comparisons
 *
 * @param actualValue - The value to test (from context/variables)
 * @param operator - The comparison operator
 * @param compareValue - The value to compare against
 * @param options - Optional configuration
 * @returns true if comparison passes, false otherwise
 *
 * @example
 * // Equality
 * compareValues("hello", "equals", "hello") // true
 *
 * // Numeric with coercion
 * compareValues("50", "gt", "25") // true (strings coerced to numbers)
 *
 * // String operations
 * compareValues("hello world", "contains", "world") // true
 * compareValues("hello", "startsWith", "he") // true
 *
 * // Existence
 * compareValues(undefined, "exists", undefined) // false
 * compareValues("value", "exists", undefined) // true
 */
export function compareValues(
  actualValue: unknown,
  operator: ComparisonOperator,
  compareValue: unknown,
  options?: CompareOptions
): boolean {
  switch (operator) {
    // =========================================================================
    // Equality
    // =========================================================================
    case "equals":
      return actualValue === compareValue;
    case "notEquals":
      return actualValue !== compareValue;

    // =========================================================================
    // Numeric (with type coercion)
    // =========================================================================
    case "gt":
    case "greaterThan": {
      const numActual = toNumber(actualValue);
      const numCompare = toNumber(compareValue);
      return !isNaN(numActual) && !isNaN(numCompare) && numActual > numCompare;
    }
    case "gte":
    case "greaterThanOrEqual": {
      const numActual = toNumber(actualValue);
      const numCompare = toNumber(compareValue);
      return !isNaN(numActual) && !isNaN(numCompare) && numActual >= numCompare;
    }
    case "lt":
    case "lessThan": {
      const numActual = toNumber(actualValue);
      const numCompare = toNumber(compareValue);
      return !isNaN(numActual) && !isNaN(numCompare) && numActual < numCompare;
    }
    case "lte":
    case "lessThanOrEqual": {
      const numActual = toNumber(actualValue);
      const numCompare = toNumber(compareValue);
      return !isNaN(numActual) && !isNaN(numCompare) && numActual <= numCompare;
    }

    // =========================================================================
    // String operations
    // =========================================================================
    case "contains":
      // String contains
      if (typeof actualValue === "string" && typeof compareValue === "string") {
        return actualValue.includes(compareValue);
      }
      // Array includes
      if (Array.isArray(actualValue)) {
        return actualValue.includes(compareValue);
      }
      return false;

    case "notContains":
      if (typeof actualValue === "string" && typeof compareValue === "string") {
        return !actualValue.includes(compareValue);
      }
      return false;

    case "startsWith":
      return typeof actualValue === "string" && typeof compareValue === "string"
        ? actualValue.startsWith(compareValue)
        : false;

    case "endsWith":
      return typeof actualValue === "string" && typeof compareValue === "string"
        ? actualValue.endsWith(compareValue)
        : false;

    case "matches":
      if (typeof actualValue === "string" && typeof compareValue === "string") {
        const logger = options?.logger ?? log;
        // Validate regex safety to prevent ReDoS attacks
        if (!isSafeRegex(compareValue)) {
          options?.onWarn?.("comparison:unsafeRegex", { pattern: compareValue });
          logger.warn({ pattern: compareValue }, "comparison:unsafeRegex");
          return false;
        }
        try {
          const regex = new RegExp(compareValue);
          return testRegexSafely(regex, actualValue);
        } catch {
          options?.onWarn?.("comparison:invalidRegex", { pattern: compareValue });
          logger.warn({ pattern: compareValue }, "comparison:invalidRegex");
          return false;
        }
      }
      return false;

    // =========================================================================
    // Existence
    // =========================================================================
    case "exists":
      return actualValue !== undefined && actualValue !== null;

    case "notExists":
      return actualValue === undefined || actualValue === null;

    // =========================================================================
    // Default (unknown operator)
    // =========================================================================
    default:
      log.warn({ operator }, "comparison:unknownOperator");
      return false;
  }
}
