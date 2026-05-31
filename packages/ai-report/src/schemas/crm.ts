/**
 * CRM Action Schema
 *
 * Track CRM actions taken during journey execution.
 *
 * @module @journey/ai-report/schemas/crm
 */

import { z } from "zod";

/**
 * CRM action types supported.
 */
export const CRMActionTypeSchema = z.enum([
  "pipeline_move",
  "deal_create",
  "deal_update",
  "contact_create",
  "contact_update",
  "note_add",
  "task_create",
  "custom",
]);

export type CRMActionType = z.infer<typeof CRMActionTypeSchema>;

/**
 * CRM action detail schema.
 */
export const CRMActionDetailSchema = z.object({
  timestamp: z.string().datetime(),
  nodeId: z.string(),
  nodeLabel: z.string().optional(),

  // Action details
  actionType: CRMActionTypeSchema,
  actionName: z.string(), // e.g., "move_to_stage", "create_deal"

  // Pipeline/Stage context
  pipelineId: z.string().optional(),
  pipelineName: z.string().optional(),
  stageId: z.string().optional(),
  stageName: z.string().optional(),

  // Entity references
  dealId: z.string().optional(),
  contactId: z.string().optional(),

  // Result
  success: z.boolean(),
  message: z.string().optional(),
  errorMessage: z.string().optional(),

  // Additional context
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CRMActionDetail = z.infer<typeof CRMActionDetailSchema>;
