/**
 * Variable Change Detail Schema
 *
 * Track all variable changes with before/after.
 *
 * @module @journey/ai-report/schemas/variables
 */

import { z } from "zod";

/**
 * Single variable change operation.
 */
export const VariableChangeOperationSchema = z.object({
  key: z.string(),
  previousValue: z.unknown(),
  newValue: z.unknown(),
  operation: z.enum(["set", "increment", "decrement", "append", "remove", "clear"]),
});

export type VariableChangeOperation = z.infer<typeof VariableChangeOperationSchema>;

/**
 * Track all variable changes with before/after.
 */
export const VariableChangeDetailSchema = z.object({
  timestamp: z.string().datetime(),
  nodeId: z.string(),
  nodeLabel: z.string().optional(),

  changes: z.array(VariableChangeOperationSchema),
});

export type VariableChangeDetail = z.infer<typeof VariableChangeDetailSchema>;
