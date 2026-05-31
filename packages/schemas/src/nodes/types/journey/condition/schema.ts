import { z } from "zod";
import { BaseNodeDataSchema } from "../../../base";

// ============================================================================
// ENUM CONSTANTS (Single Source of Truth)
// ============================================================================

/**
 * Condition rule operators
 */
export const ConditionOperators = {
  EQUALS: "equals",
  NOT_EQUALS: "notEquals",
  CONTAINS: "contains",
  NOT_CONTAINS: "notContains",
  GREATER_THAN: "greaterThan",
  LESS_THAN: "lessThan",
  GREATER_THAN_OR_EQUAL: "greaterThanOrEqual",
  LESS_THAN_OR_EQUAL: "lessThanOrEqual",
  EXISTS: "exists",
  NOT_EXISTS: "notExists",
  STARTS_WITH: "startsWith",
  ENDS_WITH: "endsWith",
  MATCHES: "matches", // regex match
} as const;

export const ConditionOperatorValues = Object.values(ConditionOperators) as [string, ...string[]];
export const ConditionOperatorSchema = z.enum(ConditionOperatorValues);

/**
 * Rules logic combinator
 */
export const RulesOperators = {
  AND: "and",
  OR: "or",
} as const;

export const RulesOperatorValues = Object.values(RulesOperators) as [string, ...string[]];
export const RulesOperatorSchema = z.enum(RulesOperatorValues);

// ============================================================================
// OPERATOR VALIDATION HELPERS
// ============================================================================

/**
 * Operators that require a comparison value
 */
export const OPERATORS_REQUIRING_VALUE = [
  ConditionOperators.EQUALS,
  ConditionOperators.NOT_EQUALS,
  ConditionOperators.CONTAINS,
  ConditionOperators.NOT_CONTAINS,
  ConditionOperators.GREATER_THAN,
  ConditionOperators.LESS_THAN,
  ConditionOperators.GREATER_THAN_OR_EQUAL,
  ConditionOperators.LESS_THAN_OR_EQUAL,
  ConditionOperators.STARTS_WITH,
  ConditionOperators.ENDS_WITH,
  ConditionOperators.MATCHES,
] as const;

/**
 * Operators that do NOT require a value (presence checks)
 */
export const OPERATORS_WITHOUT_VALUE = [ConditionOperators.EXISTS, ConditionOperators.NOT_EXISTS] as const;

// ============================================================================
// CONDITION SCHEMAS
// ============================================================================

/**
 * Single condition rule with validation
 * Ensures operators that require values have them provided
 *
 * @example
 * // Valid - equals requires a value
 * { field: "user.score", operator: "equals", value: 100 }
 *
 * @example
 * // Valid - exists doesn't need a value
 * { field: "user.email", operator: "exists" }
 */
export const ConditionRuleSchema = z
  .object({
    field: z.string().min(1), // e.g., "segment", "tag", "previousChoice", "user.score"
    operator: ConditionOperatorSchema,
    value: z.union([z.string(), z.number(), z.boolean()]).optional(), // Optional for exists/notExists
  })
  .refine(
    (rule) => {
      // Check if operator requires a value
      if ((OPERATORS_REQUIRING_VALUE as readonly string[]).includes(rule.operator)) {
        return rule.value !== undefined;
      }
      return true;
    },
    {
      message: "This operator requires a comparison value",
      path: ["value"],
    }
  );

// Branch definition for condition outcomes
export const ConditionBranchSchema = z.object({
  id: z.string(),
  label: z.string(),
  isDefault: z.boolean().optional(), // Fallback branch if no rules match
});

/**
 * Condition node - branch based on logic
 * Supports both expression-based and rule-based conditions
 *
 * @example
 * const condition: ConditionNodeData = {
 *   type: "condition",
 *   label: "Check VIP Status",
 *   rules: [
 *     { field: "user.tier", operator: "equals", value: "vip" },
 *     { field: "user.subscribed", operator: "exists" },
 *   ],
 *   rulesOperator: "and",
 *   branches: [
 *     { id: "vip", label: "VIP Users" },
 *     { id: "regular", label: "Regular Users", isDefault: true },
 *   ],
 * };
 */
export const ConditionNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("condition"),
  // Expression-based condition (advanced users)
  expression: z.string().optional(), // e.g., "user.score > 50 && user.segment === 'premium'"
  // Rule-based conditions (user-friendly UI)
  rules: z.array(ConditionRuleSchema).optional(),
  // How to combine multiple rules
  rulesOperator: RulesOperatorSchema.default("and"),
  // Branch definitions - each branch can have edges connecting to different nodes
  branches: z.array(ConditionBranchSchema),
});

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;
export type RulesOperator = z.infer<typeof RulesOperatorSchema>;
export type ConditionRule = z.infer<typeof ConditionRuleSchema>;
export type ConditionBranch = z.infer<typeof ConditionBranchSchema>;
export type ConditionNodeData = z.infer<typeof ConditionNodeDataSchema>;

// =============================================================================
// CONDITION NODE OUTPUT SCHEMA
// Mirrors what condition-handler.ts stores via storeNodeOutput()
// See: condition-handler.ts:188-191
// =============================================================================

/**
 * Condition node output schema - stored via storeNodeOutput()
 * Stores which branch was taken and when
 */
export const ConditionNodeOutputSchema = z.object({
  branchId: z.string(),
  evaluatedAt: z.string(),
});

export type ConditionNodeOutput = z.infer<typeof ConditionNodeOutputSchema>;
