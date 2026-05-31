/**
 * Variable Schema Definitions
 *
 * JSON Schema-like type definitions for journey variables.
 * Enables:
 * - Deep nested property autocomplete (user.profile.preferences.theme)
 * - Edit-time validation (enum values, required fields)
 * - Schema-aware mock data generation
 *
 * @module variables/variable-schema
 */

import { z } from "zod";

// =============================================================================
// VARIABLE PROPERTY SCHEMA
// =============================================================================

/**
 * Supported string formats (JSON Schema format keyword subset)
 */
export const VariableFormatValues = ["email", "uri", "date-time", "date", "uuid", "phone"] as const;
export const VariableFormatSchema = z.enum(VariableFormatValues);
export type VariableFormat = z.infer<typeof VariableFormatSchema>;

/**
 * Supported property types (JSON Schema type keyword subset)
 */
export const VariableTypeValues = ["string", "number", "boolean", "object", "array"] as const;
export const VariableTypeSchema = z.enum(VariableTypeValues);
export type VariableType = z.infer<typeof VariableTypeSchema>;

/**
 * Variable Property Schema - defines structure of a single variable property
 *
 * Uses z.lazy() for recursive object/array types.
 * Subset of JSON Schema designed for variable autocomplete.
 *
 * @example
 * ```typescript
 * const userSchema: VariableProperty = {
 *   type: "object",
 *   properties: {
 *     email: { type: "string", format: "email" },
 *     tier: { type: "string", enum: ["free", "pro", "enterprise"] },
 *     profile: {
 *       type: "object",
 *       properties: {
 *         theme: { type: "string", enum: ["light", "dark"] }
 *       }
 *     }
 *   }
 * };
 * ```
 */
export const VariablePropertySchema: z.ZodType<VariableProperty> = z.lazy(() =>
  z.object({
    /** Property type */
    type: VariableTypeSchema,
    /** Human-readable description for documentation */
    description: z.string().optional(),
    /** String format hint for mock generation and validation */
    format: VariableFormatSchema.optional(),
    /** Allowed values (makes this an enum type) */
    enum: z.array(z.union([z.string(), z.number()])).optional(),
    /** Default value */
    default: z.unknown().optional(),
    /** Nested properties (for type: "object") */
    properties: z.record(z.string(), VariablePropertySchema).optional(),
    /** Array item schema (for type: "array") */
    items: VariablePropertySchema.optional(),
    /** Required property keys (for type: "object") */
    required: z.array(z.string()).optional(),
  })
);

/**
 * Variable Property type - recursive structure for nested objects
 */
export type VariableProperty = {
  type: VariableType;
  description?: string;
  format?: VariableFormat;
  enum?: (string | number)[];
  default?: unknown;
  properties?: Record<string, VariableProperty>;
  items?: VariableProperty;
  required?: string[];
};

// =============================================================================
// VARIABLE SCHEMAS CONTAINER
// =============================================================================

/**
 * Variable Schemas - container for all variable type definitions
 *
 * Stored at journey level to define expected structure of:
 * - user: User namespace variables (user.id, user.email, user.profile.*)
 * - session: Session namespace variables (session.id, session.status, session.tags)
 * - custom: Custom variable definitions (vars.*)
 *
 * @example
 * ```typescript
 * const schemas: VariableSchemas = {
 *   user: {
 *     type: "object",
 *     properties: {
 *       id: { type: "string" },
 *       email: { type: "string", format: "email" },
 *       profile: {
 *         type: "object",
 *         properties: {
 *           tier: { type: "string", enum: ["free", "pro"] }
 *         }
 *       }
 *     }
 *   }
 * };
 * ```
 */
export const VariableSchemasSchema = z.object({
  /** Schema for user namespace (user.*) */
  user: VariablePropertySchema.optional(),
  /** Schema for session namespace (session.*) */
  session: VariablePropertySchema.optional(),
  /** Schemas for custom variables (vars.*) */
  custom: z.record(z.string(), VariablePropertySchema).optional(),
});

export type VariableSchemas = z.infer<typeof VariableSchemasSchema>;
