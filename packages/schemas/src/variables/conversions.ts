/**
 * Type Conversion Utilities
 *
 * Shared utilities for type conversion across engine, workflow, and LLM tools.
 * Consolidates patterns from:
 * - engine/src/utils/context.ts (toExprEvalContext)
 * - llm/src/workflow/expression-evaluator.ts (isEmpty, toNumber, toString)
 *
 * Key design decisions:
 * - "false" string is truthy (it's a non-empty string)
 * - Empty arrays are falsy
 * - null and undefined are falsy
 * - 0 is falsy
 * - Empty objects are truthy (unlike arrays, objects with no keys are still objects)
 */

/**
 * Check if a value is empty.
 *
 * Empty means:
 * - null or undefined
 * - empty string (after trim)
 * - empty array
 * - object with no keys
 *
 * @example
 * ```ts
 * isEmpty(null);          // true
 * isEmpty("");            // true
 * isEmpty("  ");          // true
 * isEmpty([]);            // true
 * isEmpty({});            // true
 * isEmpty(0);             // false (0 is a valid number)
 * isEmpty(false);         // false (false is a valid boolean)
 * isEmpty("hello");       // false
 * isEmpty([1, 2, 3]);     // false
 * ```
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * Check if a value is truthy for condition evaluation.
 *
 * This follows JavaScript-like truthiness with some adjustments:
 * - null, undefined → false
 * - 0 → false
 * - "" (empty string) → false
 * - "false" (string) → TRUE (it's a non-empty string)
 * - [] (empty array) → false
 * - {} (empty object) → true (objects are truthy)
 * - false (boolean) → false
 *
 * @example
 * ```ts
 * isTruthy(true);         // true
 * isTruthy(1);            // true
 * isTruthy("hello");      // true
 * isTruthy("false");      // true (string is non-empty)
 * isTruthy([1]);          // true
 * isTruthy({});           // true (objects are truthy)
 * isTruthy(false);        // false
 * isTruthy(0);            // false
 * isTruthy("");           // false
 * isTruthy(null);         // false
 * isTruthy([]);           // false (empty array)
 * ```
 */
export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0 && !isNaN(value);
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  // Objects (including functions) are truthy
  return true;
}

/**
 * Safely convert a value to a number.
 *
 * Conversion rules:
 * - number → as-is
 * - string → parseFloat (0 if invalid)
 * - boolean → 1/0
 * - null/undefined → 0
 * - other → 0
 *
 * @example
 * ```ts
 * toNumber(42);           // 42
 * toNumber("3.14");       // 3.14
 * toNumber("invalid");    // 0
 * toNumber(true);         // 1
 * toNumber(false);        // 0
 * toNumber(null);         // 0
 * ```
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return isNaN(value) ? 0 : value;
  }

  if (typeof value === "string") {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return 0;
}

/**
 * Safely convert a value to a string.
 *
 * Conversion rules:
 * - string → as-is
 * - null/undefined → ""
 * - object/array → JSON.stringify
 * - other → String()
 *
 * @example
 * ```ts
 * toString("hello");      // "hello"
 * toString(42);           // "42"
 * toString(true);         // "true"
 * toString(null);         // ""
 * toString({ a: 1 });     // '{"a":1}'
 * toString([1, 2]);       // '[1,2]'
 * ```
 */
export function toString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }

  return String(value);
}

/**
 * Convert a context object to expr-eval compatible format.
 *
 * expr-eval Value type only supports: number | string | function | { [key]: Value }
 * This function flattens a context object to only contain number/string values.
 *
 * Conversion rules:
 * - number → as-is
 * - string → as-is
 * - boolean → 1/0 (expr-eval doesn't support boolean)
 * - null/undefined → 0
 * - object/array → JSON.stringify
 *
 * @example
 * ```ts
 * toExprEvalContext({
 *   active: true,
 *   count: 5,
 *   name: "test",
 *   data: null,
 *   items: [1, 2]
 * });
 * // { active: 1, count: 5, name: "test", data: 0, items: "[1,2]" }
 * ```
 */
export function toExprEvalContext(context: Record<string, unknown>): Record<string, number | string> {
  const result: Record<string, number | string> = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "number") {
      result[key] = isNaN(value) ? 0 : value;
    } else if (typeof value === "string") {
      result[key] = value;
    } else if (typeof value === "boolean") {
      result[key] = value ? 1 : 0;
    } else if (value === null || value === undefined) {
      result[key] = 0;
    } else if (typeof value === "object") {
      try {
        result[key] = JSON.stringify(value);
      } catch {
        result[key] = "[object]";
      }
    } else {
      result[key] = String(value);
    }
  }

  return result;
}

/**
 * Prepare a value for use in a condition expression.
 *
 * This is a convenience wrapper that handles common condition patterns:
 * - Converts boolean-like values for comparison
 * - Handles edge cases consistently
 *
 * @example
 * ```ts
 * prepareForCondition(true);      // 1
 * prepareForCondition("yes");     // "yes"
 * prepareForCondition(null);      // 0
 * prepareForCondition([1, 2]);    // 2 (array length)
 * ```
 */
export function prepareForCondition(value: unknown): number | string {
  if (typeof value === "number") {
    return isNaN(value) ? 0 : value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  if (Array.isArray(value)) {
    // Return array length for easy "has items" checks: arr > 0
    return value.length;
  }

  if (typeof value === "object") {
    // Return object key count for easy "has properties" checks
    return Object.keys(value).length;
  }

  return String(value);
}
