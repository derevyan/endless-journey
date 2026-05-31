/**
 * Variable Data Schemas
 *
 * Data structures for API responses and requests.
 */

import { z } from "zod";
import { VariableScopeSchema, VariableOperationSchema } from "./operations";

// =============================================================================
// VARIABLE DATA (for API responses)
// =============================================================================

/**
 * Variable data structure returned from API
 */
export const VariableDataSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  value: z.unknown(),
  description: z.string().nullable().optional(),
  createdAt: z.iso.datetime().nullable().optional(),
  updatedAt: z.iso.datetime().nullable().optional(),
});

export type VariableData = z.infer<typeof VariableDataSchema>;

/**
 * Global variable with organization reference
 */
export const GlobalVariableSchema = VariableDataSchema.extend({
  organizationId: z.string(),
});

export type GlobalVariable = z.infer<typeof GlobalVariableSchema>;

/**
 * Journey variable with journey reference
 */
export const JourneyVariableSchema = VariableDataSchema.extend({
  journeyId: z.string().uuid(),
});

export type JourneyVariable = z.infer<typeof JourneyVariableSchema>;

/**
 * User variable with client reference
 */
export const UserVariableSchema = VariableDataSchema.extend({
  clientId: z.string(),
});

export type UserVariable = z.infer<typeof UserVariableSchema>;

// =============================================================================
// EXECUTE OPERATIONS REQUEST
// =============================================================================

/**
 * Request body for executing variable operations via API
 *
 * Note: organizationId and journeyId are optional at schema level.
 * The API route handles validation and fallbacks:
 * - For "global" scope: organizationId falls back to authenticated user's org
 * - For "journey" scope: journeyId is validated and required by the route
 */
export const ExecuteVariableOperationsRequestSchema = z.object({
  scope: VariableScopeSchema,
  journeyId: z.string().uuid().optional(), // Required for journey scope (validated by route)
  organizationId: z.string().optional(), // Falls back to user's org for global scope
  operations: z.array(VariableOperationSchema),
});

export type ExecuteVariableOperationsRequest = z.infer<typeof ExecuteVariableOperationsRequestSchema>;
