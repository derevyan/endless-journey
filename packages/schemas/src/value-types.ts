import { z } from "zod";

// =============================================================================
// VARIABLE VALUE TYPES
// =============================================================================
// This file is extracted to avoid circular imports between:
// - nodes/base.ts (needs VariableValueSchema for VariableActionSchema)
// - variables.ts (defines VariableValueSchema)
// Both can now safely import from this shared module.
// =============================================================================

/**
 * Common variable value types.
 *
 * Variables can hold various primitive and complex types. This schema
 * explicitly defines the supported types for better documentation and
 * partial type safety, while still allowing flexibility for dynamic data.
 *
 * Supported types:
 * - Primitives: string, number, boolean, null
 * - Collections: array, object (record)
 * - Special: undefined is not supported (use null instead)
 */
export const VariableValueSchema: z.ZodType<
  string | number | boolean | null | unknown[] | Record<string, unknown>
> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.lazy(() => VariableValueSchema)),
  z.record(z.string(), z.lazy(() => VariableValueSchema)),
]);

export type VariableValue = z.infer<typeof VariableValueSchema>;
