/**
 * Tag API Input Schemas
 *
 * Validation schemas for tag and tag definition operations.
 */

import { z } from "zod";

// =============================================================================
// TAG ASSIGNMENT (to clients)
// =============================================================================

/**
 * Add Tag to Client Input
 * POST /tags/global/:clientId
 */
export const AddTagToClientInputSchema = z.object({
  tag: z.string().min(1, "Tag is required"),
});
export type AddTagToClientInput = z.infer<typeof AddTagToClientInputSchema>;

/**
 * Execute Tag Operations Input
 * POST /tags/execute
 */
export const ExecuteTagOperationsInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  add: z.array(z.string()).optional().describe("Tags to add"),
  remove: z.array(z.string()).optional().describe("Tags to remove"),
});
export type ExecuteTagOperationsInput = z.infer<typeof ExecuteTagOperationsInputSchema>;

// =============================================================================
// TAG DEFINITIONS (organization-level)
// =============================================================================

/**
 * Create Tag Definition Input
 * POST /tag-definitions/global
 */
export const CreateTagDefinitionInputSchema = z.object({
  tag: z.string().min(1, "Tag name is required"),
  description: z.string().optional(),
  color: z.string().optional().describe("Hex color code (e.g., #FF5733)"),
});
export type CreateTagDefinitionInput = z.infer<typeof CreateTagDefinitionInputSchema>;

/**
 * Update Tag Definition Input
 * PUT /tag-definitions/global/:tag
 */
export const UpdateTagDefinitionInputSchema = z.object({
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});
export type UpdateTagDefinitionInput = z.infer<typeof UpdateTagDefinitionInputSchema>;
