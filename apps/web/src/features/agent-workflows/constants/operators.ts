/**
 * Condition Operators Constants
 *
 * Shared operator definitions for condition configurations.
 *
 * @module features/workflows/constants/operators
 */

import type { StructuredCondition } from "@journey/schemas";

type ConditionOperator = StructuredCondition["operator"];

/**
 * Basic comparison operators for numeric/boolean conditions.
 * Used where string operations are less relevant.
 */
export const BASIC_OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: "===", label: "equals (===)" },
  { value: "!==", label: "not equals (!==)" },
  { value: ">", label: "greater than (>)" },
  { value: ">=", label: "greater or equal (>=)" },
  { value: "<", label: "less than (<)" },
  { value: "<=", label: "less or equal (<=)" },
];

/**
 * Extended operators including string operations.
 * Used by if-else conditions where text matching is useful.
 */
export const EXTENDED_OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  ...BASIC_OPERATORS,
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
  { value: "matches", label: "matches (regex)" },
];

/**
 * Operators that don't require a right-hand value
 */
export const UNARY_OPERATORS: ConditionOperator[] = ["isEmpty", "isNotEmpty"];
