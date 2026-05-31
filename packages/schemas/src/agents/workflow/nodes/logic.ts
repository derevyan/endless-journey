import { z } from "zod";

// =============================================================================
// CONDITION TYPES (for If/Else)
// =============================================================================

/**
 * Structured condition - SAFE alternative to string expressions.
 *
 * Uses explicit operators instead of eval-like string parsing.
 * This prevents code injection attacks and ensures predictable behavior.
 */
export const StructuredConditionSchema = z.object({
  left: z.string().min(1), // Variable path: 'result.needs_detail'
  operator: z.enum([
    "===", // Strict equality
    "!==", // Strict inequality
    ">", // Greater than
    "<", // Less than
    ">=", // Greater or equal
    "<=", // Less or equal
    "contains", // String/array contains
    "startsWith", // String starts with
    "endsWith", // String ends with
    "isEmpty", // Value is null/undefined/empty
    "isNotEmpty", // Value is not empty
    "matches", // Regex match (right is pattern)
  ]),
  right: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(), // Optional for isEmpty/isNotEmpty
});

export type StructuredCondition = z.infer<typeof StructuredConditionSchema>;

/**
 * Intent-based condition (uses LLM classification).
 */
export const IntentConditionSchema = z.object({
  intents: z.array(z.string().min(1)).min(1),
  minConfidence: z.number().min(0).max(1).default(0.7),
});

export type IntentCondition = z.infer<typeof IntentConditionSchema>;

// =============================================================================
// IF/ELSE NODE - Conditional branching
// =============================================================================

/**
 * If/Else node configuration.
 *
 * Output handles:
 * - 'yes': Condition is true
 * - 'no': Condition is false
 */
export const IfElseNodeConfigSchema = z.discriminatedUnion("conditionType", [
  // Expression-based (structured, SAFE)
  z.object({
    name: z.string().min(1).max(100).optional(),
    conditionType: z.literal("expression"),
    condition: StructuredConditionSchema,
  }),
  // Intent-based (uses LLM classification)
  z.object({
    name: z.string().min(1).max(100).optional(),
    conditionType: z.literal("intent"),
    intent: IntentConditionSchema,
  }),
]);

export type IfElseNodeConfig = z.infer<typeof IfElseNodeConfigSchema>;

// =============================================================================
// USER APPROVAL NODE - Human in the loop
// =============================================================================

/**
 * User Approval node pauses workflow for human review.
 *
 * Output handles:
 * - 'approved': Human approved
 * - 'rejected': Human rejected
 */
export const UserApprovalNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),

  // Message to show reviewer
  message: z.string().min(1).max(1000),

  // Timeout in seconds (optional)
  timeoutSeconds: z.number().int().min(30).max(86400).optional(),

  // What to do on timeout
  timeoutAction: z.enum(["approve", "reject", "skip"]).default("skip"),

  // Reviewer roles (optional, for access control)
  allowedRoles: z.array(z.string()).optional(),
});

export type UserApprovalNodeConfig = z.infer<typeof UserApprovalNodeConfigSchema>;
