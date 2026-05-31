/**
 * CRM Event Publishers
 *
 * All CRM-related event publishers using the factory pattern.
 *
 * @module events/publishers/crm
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// STAGE EVENTS
// =============================================================================

export const publishStageChanged = createEventPublisher(EventTypes.CRM_STAGE_CHANGED);
export const publishStageCreated = createEventPublisher(EventTypes.CRM_STAGE_CREATED);
export const publishStageUpdated = createEventPublisher(EventTypes.CRM_STAGE_UPDATED);
export const publishStageDeleted = createEventPublisher(EventTypes.CRM_STAGE_DELETED);
export const publishStagesReordered = createEventPublisher(EventTypes.CRM_STAGES_REORDERED);

// =============================================================================
// PIPELINE EVENTS
// =============================================================================

export const publishPipelineEntered = createEventPublisher(EventTypes.CRM_PIPELINE_ENTERED);
export const publishPipelineExited = createEventPublisher(EventTypes.CRM_PIPELINE_EXITED);
export const publishPipelineCreated = createEventPublisher(EventTypes.CRM_PIPELINE_CREATED);
export const publishPipelineUpdated = createEventPublisher(EventTypes.CRM_PIPELINE_UPDATED);
export const publishPipelineDeleted = createEventPublisher(EventTypes.CRM_PIPELINE_DELETED);
export const publishPipelineDefaultSet = createEventPublisher(EventTypes.CRM_PIPELINE_DEFAULT_SET);

// =============================================================================
// FIELD EVENTS
// =============================================================================

export const publishFieldUpdated = createEventPublisher(EventTypes.CRM_FIELD_UPDATED);

// =============================================================================
// MESSAGE EVENTS
// =============================================================================

export const publishMessageSent = createEventPublisher(EventTypes.CRM_MESSAGE_SENT);

// =============================================================================
// ACTION FEEDBACK EVENTS
// =============================================================================

export const publishActionExecuted = createEventPublisher(EventTypes.CRM_ACTION_EXECUTED);
export const publishActionFailed = createEventPublisher(EventTypes.CRM_ACTION_FAILED);

// Note: crm.tag.* events removed - use tag.added/tag.removed from tag publisher instead
// The source field indicates origin (journey, crm, manual)

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All CRM publishers as a single object for easy imports
 *
 * @example
 * import { crm } from "./publishers";
 * await crm.stageChanged(ctx, data);
 */
export const crm = {
  // Stage
  stageChanged: publishStageChanged,
  stageCreated: publishStageCreated,
  stageUpdated: publishStageUpdated,
  stageDeleted: publishStageDeleted,
  stagesReordered: publishStagesReordered,

  // Pipeline
  pipelineEntered: publishPipelineEntered,
  pipelineExited: publishPipelineExited,
  pipelineCreated: publishPipelineCreated,
  pipelineUpdated: publishPipelineUpdated,
  pipelineDeleted: publishPipelineDeleted,
  pipelineDefaultSet: publishPipelineDefaultSet,

  // Field
  fieldUpdated: publishFieldUpdated,

  // Message
  messageSent: publishMessageSent,

  // Action Feedback
  actionExecuted: publishActionExecuted,
  actionFailed: publishActionFailed,
} as const;
