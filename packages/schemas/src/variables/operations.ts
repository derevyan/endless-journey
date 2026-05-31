/**
 * Variable Scope and Operations
 *
 * Defines variable scope enum and all supported operations.
 */

import { z } from "zod";
import { VariableValueSchema } from "../value-types";

// =============================================================================
// VARIABLE SCOPE
// =============================================================================

/**
 * Variable scope determines where the variable is stored:
 * - "journey": Scoped to a specific journey (journey_variables table)
 * - "global": Organization-wide, shared across all journeys (global_variables table)
 * - "user": User-specific, stored in session context (follows user across journeys)
 */
export const VariableScopeSchema = z.enum(["journey", "global", "user"]);
export type VariableScope = z.infer<typeof VariableScopeSchema>;

// =============================================================================
// VARIABLE OPERATIONS
// =============================================================================

/**
 * Set operation - sets a variable to a specific value
 * If the variable doesn't exist, it will be created
 */
export const SetOperationSchema = z.object({
  id: z.string().optional(), // UI-only stable ID for React list keys
  op: z.literal("set"),
  key: z.string().min(1),
  value: VariableValueSchema,
});

/**
 * Delete operation - removes a variable
 */
export const DeleteOperationSchema = z.object({
  id: z.string().optional(), // UI-only stable ID for React list keys
  op: z.literal("delete"),
  key: z.string().min(1),
});

/**
 * Increment operation - adds to a numeric variable
 * Default amount is 1
 */
export const IncrementOperationSchema = z.object({
  id: z.string().optional(), // UI-only stable ID for React list keys
  op: z.literal("increment"),
  key: z.string().min(1),
  amount: z.number().default(1),
});

/**
 * Decrement operation - subtracts from a numeric variable
 * Default amount is 1
 */
export const DecrementOperationSchema = z.object({
  id: z.string().optional(), // UI-only stable ID for React list keys
  op: z.literal("decrement"),
  key: z.string().min(1),
  amount: z.number().default(1),
});

/**
 * Push operation - appends a value to an array variable
 * If the variable doesn't exist, creates a new array with the value
 */
export const PushOperationSchema = z.object({
  id: z.string().optional(), // UI-only stable ID for React list keys
  op: z.literal("push"),
  key: z.string().min(1),
  value: VariableValueSchema,
});

/**
 * Pop operation - removes and returns the last element from an array
 */
export const PopOperationSchema = z.object({
  id: z.string().optional(), // UI-only stable ID for React list keys
  op: z.literal("pop"),
  key: z.string().min(1),
});

/**
 * Merge operation - deep merges an object into an existing object variable
 * If the variable doesn't exist, creates a new object with the value
 */
export const MergeOperationSchema = z.object({
  id: z.string().optional(), // UI-only stable ID for React list keys
  op: z.literal("merge"),
  key: z.string().min(1),
  value: z.record(z.string(), VariableValueSchema),
});

/**
 * All supported variable operations
 */
export const VariableOperationSchema = z.discriminatedUnion("op", [
  SetOperationSchema,
  DeleteOperationSchema,
  IncrementOperationSchema,
  DecrementOperationSchema,
  PushOperationSchema,
  PopOperationSchema,
  MergeOperationSchema,
]);

export type VariableOperation = z.infer<typeof VariableOperationSchema>;

// Note: VariableAction and VariableActionSchema are defined in nodes/base.ts
// to be included in BaseNodeData. Re-export from nodes module for convenience.
