import { z } from "zod";
import { BaseNodeDataSchema } from "../../../base";

/**
 * CRM Node Schema
 *
 * Simplified logic:
 * - Just set pipelineId and/or stageId
 * - Pipeline only → Move to that pipeline (default/unassigned stage)
 * - Pipeline + stage → Move to specific stage
 * - Engine figures out if it needs to create/move based on current state
 */
export const CrmNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("crm"),
  // Target pipeline - can be ID or template variable
  pipelineId: z.string().optional(), // If not set, uses the default pipeline
  // Target stage within the pipeline
  stageId: z.string().optional(), // If not set, uses the default/Unassigned stage
  // Optional notes to record with the stage change
  notes: z.string().optional(),
});

export type CrmNodeData = z.infer<typeof CrmNodeDataSchema>;

// =============================================================================
// CRM NODE OUTPUT SCHEMA
// Mirrors what crm-handler.ts stores via storeNodeOutput()
// See: crm-handler.ts:44-47, 81, 122-125
// =============================================================================

/**
 * CRM node output schema - stored via storeNodeOutput()
 * Stores the result of the CRM operation
 */
export const CrmNodeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type CrmNodeOutput = z.infer<typeof CrmNodeOutputSchema>;
