/**
 * Workflow Event Publishers
 *
 * Event publishers for workflow execution lifecycle events.
 * Used to emit real-time updates during workflow execution.
 *
 * @module events/publishers/workflow
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// WORKFLOW LIFECYCLE EVENTS
// =============================================================================

export const publishWorkflowStarted = createEventPublisher(EventTypes.WORKFLOW_STARTED);
export const publishWorkflowCompleted = createEventPublisher(EventTypes.WORKFLOW_COMPLETED);
export const publishWorkflowError = createEventPublisher(EventTypes.WORKFLOW_ERROR);

// =============================================================================
// WORKFLOW STEP EVENTS
// =============================================================================

export const publishWorkflowStepStarted = createEventPublisher(EventTypes.WORKFLOW_STEP_STARTED);
export const publishWorkflowStepCompleted = createEventPublisher(EventTypes.WORKFLOW_STEP_COMPLETED);
export const publishWorkflowStepError = createEventPublisher(EventTypes.WORKFLOW_STEP_ERROR);

// =============================================================================
// WORKFLOW CONTROL EVENTS
// =============================================================================

export const publishWorkflowPaused = createEventPublisher(EventTypes.WORKFLOW_PAUSED);
export const publishWorkflowResumed = createEventPublisher(EventTypes.WORKFLOW_RESUMED);

// =============================================================================
// WORKFLOW APPROVAL EVENTS
// =============================================================================

export const publishWorkflowApprovalRequested = createEventPublisher(EventTypes.WORKFLOW_APPROVAL_REQUESTED);
export const publishWorkflowApprovalResponse = createEventPublisher(EventTypes.WORKFLOW_APPROVAL_RESPONSE);

// =============================================================================
// WORKFLOW GUARD EVENTS
// =============================================================================

export const publishWorkflowGuardBlocked = createEventPublisher(EventTypes.WORKFLOW_GUARD_BLOCKED);

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All workflow publishers as a single object
 *
 * @example
 * import { workflow } from "./publishers";
 * await workflow.started(ctx, { workflowId, workflowKey, ... });
 */
export const workflow = {
  // Lifecycle events
  started: publishWorkflowStarted,
  completed: publishWorkflowCompleted,
  error: publishWorkflowError,

  // Step events
  stepStarted: publishWorkflowStepStarted,
  stepCompleted: publishWorkflowStepCompleted,
  stepError: publishWorkflowStepError,

  // Control events
  paused: publishWorkflowPaused,
  resumed: publishWorkflowResumed,

  // Approval events
  approvalRequested: publishWorkflowApprovalRequested,
  approvalResponse: publishWorkflowApprovalResponse,

  // Guard events
  guardBlocked: publishWorkflowGuardBlocked,
} as const;
