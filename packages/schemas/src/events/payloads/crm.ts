/**
 * CRM Event Payloads
 *
 * Payload schemas for all CRM-related events.
 *
 * @module schemas/events/payloads/crm
 */

import { z } from "zod";

// =============================================================================
// TRIGGER TYPES
// =============================================================================

/**
 * Trigger source for CRM events
 * Indicates how the CRM action was initiated
 */
export const CrmEventTriggerSchema = z.enum([
  "journey",    // Triggered by journey CRM node
  "manual",     // Triggered by user via UI/API
  "webhook",    // Triggered by external webhook
  "automation", // Triggered by automation rule
]);

export type CrmEventTrigger = z.infer<typeof CrmEventTriggerSchema>;

// =============================================================================
// STAGE EVENTS
// =============================================================================

/**
 * Payload for crm.stage.changed event
 * Emitted when a client is moved between stages in a pipeline
 */
export const CrmStageChangedPayloadSchema = z.object({
  clientId: z.string(),
  pipelineId: z.string(),
  pipelineName: z.string(),
  fromStageId: z.string().nullable(),
  fromStageName: z.string().nullable(),
  toStageId: z.string(),
  toStageName: z.string(),
  durationMs: z.number().nullable(),
  notes: z.string().nullable(),
});

export type CrmStageChangedPayload = z.infer<typeof CrmStageChangedPayloadSchema>;

/**
 * Payload for crm.stage.created event
 */
export const CrmStageCreatedPayloadSchema = z.object({
  stageId: z.string(),
  stageName: z.string(),
  pipelineId: z.string(),
});

export type CrmStageCreatedPayload = z.infer<typeof CrmStageCreatedPayloadSchema>;

/**
 * Payload for crm.stage.updated event
 */
export const CrmStageUpdatedPayloadSchema = z.object({
  stageId: z.string(),
  pipelineId: z.string(),
  changes: z.record(z.string(), z.unknown()),
});

export type CrmStageUpdatedPayload = z.infer<typeof CrmStageUpdatedPayloadSchema>;

/**
 * Payload for crm.stage.deleted event
 */
export const CrmStageDeletedPayloadSchema = z.object({
  stageId: z.string(),
  stageName: z.string(),
  pipelineId: z.string(),
  clientCount: z.number(),
});

export type CrmStageDeletedPayload = z.infer<typeof CrmStageDeletedPayloadSchema>;

/**
 * Payload for crm.stages.reordered event
 */
export const CrmStagesReorderedPayloadSchema = z.object({
  pipelineId: z.string(),
  stageIds: z.array(z.string()),
});

export type CrmStagesReorderedPayload = z.infer<typeof CrmStagesReorderedPayloadSchema>;

// =============================================================================
// PIPELINE EVENTS
// =============================================================================

/**
 * Payload for crm.pipeline.entered event
 * Emitted when a client is first added to a pipeline
 */
export const CrmPipelineEnteredPayloadSchema = z.object({
  clientId: z.string(),
  pipelineId: z.string(),
  pipelineName: z.string(),
  stageId: z.string(),
  stageName: z.string(),
});

export type CrmPipelineEnteredPayload = z.infer<typeof CrmPipelineEnteredPayloadSchema>;

/**
 * Payload for crm.pipeline.exited event
 * Emitted when a client is removed from a pipeline
 */
export const CrmPipelineExitedPayloadSchema = z.object({
  clientId: z.string(),
  pipelineId: z.string(),
  pipelineName: z.string(),
  lastStageId: z.string().nullable(),
  lastStageName: z.string().nullable(),
});

export type CrmPipelineExitedPayload = z.infer<typeof CrmPipelineExitedPayloadSchema>;

/**
 * Payload for crm.pipeline.created event
 */
export const CrmPipelineCreatedPayloadSchema = z.object({
  pipelineId: z.string(),
  pipelineName: z.string(),
  slug: z.string(),
});

export type CrmPipelineCreatedPayload = z.infer<typeof CrmPipelineCreatedPayloadSchema>;

/**
 * Payload for crm.pipeline.updated event
 */
export const CrmPipelineUpdatedPayloadSchema = z.object({
  pipelineId: z.string(),
  changes: z.record(z.string(), z.unknown()),
});

export type CrmPipelineUpdatedPayload = z.infer<typeof CrmPipelineUpdatedPayloadSchema>;

/**
 * Payload for crm.pipeline.deleted event
 */
export const CrmPipelineDeletedPayloadSchema = z.object({
  pipelineId: z.string(),
  pipelineName: z.string(),
  clientCount: z.number(),
});

export type CrmPipelineDeletedPayload = z.infer<typeof CrmPipelineDeletedPayloadSchema>;

/**
 * Payload for crm.pipeline.default_set event
 */
export const CrmPipelineDefaultSetPayloadSchema = z.object({
  pipelineId: z.string(),
  previousPipelineId: z.string().nullable(),
});

export type CrmPipelineDefaultSetPayload = z.infer<typeof CrmPipelineDefaultSetPayloadSchema>;

// =============================================================================
// FIELD EVENTS
// =============================================================================

/**
 * Payload for crm.field.updated event
 * Emitted when a custom field value is changed for a client
 */
export const CrmFieldUpdatedPayloadSchema = z.object({
  clientId: z.string(),
  fieldId: z.string(),
  fieldKey: z.string(),
  fieldName: z.string(),
  previousValue: z.unknown().nullable(),
  newValue: z.unknown(),
});

export type CrmFieldUpdatedPayload = z.infer<typeof CrmFieldUpdatedPayloadSchema>;

// =============================================================================
// MESSAGE EVENTS
// =============================================================================

/**
 * Payload for crm.message.sent event
 * Emitted when a direct message is sent to a client
 */
export const CrmMessageSentPayloadSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
  platform: z.string(),
  content: z.string(),
  status: z.string(),
});

export type CrmMessageSentPayload = z.infer<typeof CrmMessageSentPayloadSchema>;

// =============================================================================
// TAG EVENTS (CRM context)
// =============================================================================

/**
 * Payload for crm.tag.added event
 * Emitted when a tag is added to a client via CRM UI
 */
export const CrmTagAddedPayloadSchema = z.object({
  tagId: z.string(),
  tagName: z.string(),
  assignedBy: z.string(),
});

export type CrmTagAddedPayload = z.infer<typeof CrmTagAddedPayloadSchema>;

/**
 * Payload for crm.tag.removed event
 * Emitted when a tag is removed from a client via CRM UI
 */
export const CrmTagRemovedPayloadSchema = z.object({
  tagId: z.string(),
  tagName: z.string(),
  removedBy: z.string(),
});

export type CrmTagRemovedPayload = z.infer<typeof CrmTagRemovedPayloadSchema>;

// =============================================================================
// ACTION FEEDBACK EVENTS
// =============================================================================

/**
 * CRM action types that can be executed from workflows/journeys
 */
export const CrmActionTypeSchema = z.enum([
  "update_position",
  "add_to_pipeline",
  "move_to_stage",
  "remove_from_pipeline",
]);

export type CrmActionType = z.infer<typeof CrmActionTypeSchema>;

/**
 * Payload for crm.action.executed event
 * Emitted when a CRM action completes successfully from a workflow/journey
 */
export const CrmActionExecutedPayloadSchema = z.object({
  // Tracing context
  sessionId: z.string(),
  journeyId: z.string(),
  nodeId: z.string(),
  workflowId: z.string().optional(),

  // Action details
  actionType: CrmActionTypeSchema,
  clientId: z.string(),

  // CRM entities affected
  pipelineId: z.string().nullable(),
  pipelineName: z.string().nullable(),
  stageId: z.string().nullable(),
  stageName: z.string().nullable(),

  // Result
  result: z.enum(["created", "updated", "removed", "no_change"]),
  durationMs: z.number(),
});

export type CrmActionExecutedPayload = z.infer<typeof CrmActionExecutedPayloadSchema>;

/**
 * Payload for crm.action.failed event
 * Emitted when a CRM action fails from a workflow/journey
 */
export const CrmActionFailedPayloadSchema = z.object({
  // Tracing context
  sessionId: z.string(),
  journeyId: z.string(),
  nodeId: z.string(),
  workflowId: z.string().optional(),

  // Action details
  actionType: CrmActionTypeSchema,
  clientId: z.string(),

  // CRM entities attempted
  pipelineId: z.string().nullable(),
  stageId: z.string().nullable(),

  // Error details
  errorCode: z.string(),
  errorMessage: z.string(),
  durationMs: z.number(),
});

export type CrmActionFailedPayload = z.infer<typeof CrmActionFailedPayloadSchema>;
