import { z } from "zod";

// =============================================================================
// TRANSFORM NODE - Data manipulation
// =============================================================================

/**
 * Transform operation types.
 */
export const TransformOperationSchema = z.discriminatedUnion("type", [
  // Extract JSON from text
  z.object({
    type: z.literal("extractJson"),
    sourceVariable: z.string().min(1),
  }),

  // Pick specific fields
  z.object({
    type: z.literal("pick"),
    sourceVariable: z.string().min(1),
    fields: z.array(z.string()).min(1),
  }),

  // Template string (Handlebars)
  z.object({
    type: z.literal("template"),
    template: z.string().min(1).max(10000),
  }),

  // Combine multiple variables
  z.object({
    type: z.literal("merge"),
    sources: z.array(z.string()).min(2),
  }),
]);

export type TransformOperation = z.infer<typeof TransformOperationSchema>;

/**
 * Transform node applies data transformations.
 */
export const TransformNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  operation: TransformOperationSchema,
  outputVariable: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .min(1),
});

export type TransformNodeConfig = z.infer<typeof TransformNodeConfigSchema>;

// =============================================================================
// SET STATE NODE - Store variable
// =============================================================================

/**
 * SetState node stores a value in workflow state.
 */
export const SetStateNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  key: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .min(1)
    .max(100),

  // Value can be literal or template
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),

  // If true, value is treated as template: {{variable.path}}
  isTemplate: z.boolean().default(false),
});

export type SetStateNodeConfig = z.infer<typeof SetStateNodeConfigSchema>;
