/**
 * Workflow Event Payloads
 *
 * Payload schemas for workflow execution lifecycle events.
 * Workflows run within journey context and provide granular execution tracking.
 *
 * @module schemas/events/payloads/workflow
 */

import { z } from "zod";

// =============================================================================
// WORKFLOW LIFECYCLE EVENTS
// =============================================================================

/**
 * Payload for workflow.started event
 * Emitted when a workflow begins execution
 */
export const WorkflowStartedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  workflowName: z.string().optional(),
  startNodeId: z.string().optional(),
  triggerSource: z.enum(["journey", "api", "automation"]),
  journeyId: z.string().optional(),
  sessionId: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowStartedPayload = z.infer<typeof WorkflowStartedPayloadSchema>;

/**
 * Payload for workflow.completed event
 * Emitted when a workflow finishes successfully
 */
export const WorkflowCompletedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  durationMs: z.number(),
  nodesExecuted: z.number(),
  output: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowCompletedPayload = z.infer<typeof WorkflowCompletedPayloadSchema>;

/**
 * Payload for workflow.error event
 * Emitted when a workflow fails with an error
 */
export const WorkflowErrorPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  errorCode: z.string().optional(),
  errorMessage: z.string(),
  failedNodeId: z.string().optional(),
  failedNodeType: z.string().optional(),
  durationMs: z.number(),
});

export type WorkflowErrorPayload = z.infer<typeof WorkflowErrorPayloadSchema>;

// =============================================================================
// STEP EVENTS
// =============================================================================

/**
 * Payload for workflow.step.started event
 * Emitted when a workflow step begins execution
 */
export const WorkflowStepStartedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  nodeId: z.string(),
  nodeType: z.string(),
  nodeName: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowStepStartedPayload = z.infer<typeof WorkflowStepStartedPayloadSchema>;

/**
 * Payload for workflow.step.completed event
 * Emitted when a workflow step finishes successfully
 */
export const WorkflowStepCompletedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  nodeId: z.string(),
  nodeType: z.string(),
  durationMs: z.number(),
  outHandle: z.string().optional(),
  output: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowStepCompletedPayload = z.infer<typeof WorkflowStepCompletedPayloadSchema>;

/**
 * Payload for workflow.step.error event
 * Emitted when a workflow step fails
 */
export const WorkflowStepErrorPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  nodeId: z.string(),
  nodeType: z.string(),
  errorMessage: z.string(),
  durationMs: z.number(),
});

export type WorkflowStepErrorPayload = z.infer<typeof WorkflowStepErrorPayloadSchema>;

// =============================================================================
// CONTROL EVENTS
// =============================================================================

/**
 * Payload for workflow.paused event
 * Emitted when a workflow is paused (e.g., waiting for user approval)
 */
export const WorkflowPausedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  pausedAtNodeId: z.string(),
  pauseReason: z.enum(["user_approval", "external_wait", "rate_limit", "manual"]),
});

export type WorkflowPausedPayload = z.infer<typeof WorkflowPausedPayloadSchema>;

/**
 * Payload for workflow.resumed event
 * Emitted when a paused workflow resumes execution
 */
export const WorkflowResumedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  resumedAtNodeId: z.string(),
  pauseDurationMs: z.number(),
});

export type WorkflowResumedPayload = z.infer<typeof WorkflowResumedPayloadSchema>;

// =============================================================================
// APPROVAL EVENTS
// =============================================================================

/**
 * Payload for workflow.approval.requested event
 * Emitted when a workflow requests user approval to continue
 */
export const WorkflowApprovalRequestedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  nodeId: z.string(),
  nodeType: z.string(),
  nodeName: z.string().optional(),
  approvalMessage: z.string().optional(),
  timeoutSeconds: z.number().optional(),
  timeoutAction: z.enum(["approve", "reject", "skip"]).optional(),
  allowedRoles: z.array(z.string()).optional(),
});

export type WorkflowApprovalRequestedPayload = z.infer<typeof WorkflowApprovalRequestedPayloadSchema>;

/**
 * Payload for workflow.approval.response event
 * Emitted when a user responds to an approval request (or timeout fires)
 */
export const WorkflowApprovalResponsePayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  nodeId: z.string(),
  nodeType: z.string().optional(),
  nodeName: z.string().optional(),
  approved: z.boolean(),
  respondedBy: z.string().optional(),
  responseNote: z.string().optional(),
  /** True if this response was from a timeout, not user action */
  timedOut: z.boolean().optional(),
  /** The timeout action that triggered this response */
  timeoutAction: z.enum(["approve", "reject", "skip"]).optional(),
});

export type WorkflowApprovalResponsePayload = z.infer<typeof WorkflowApprovalResponsePayloadSchema>;

// =============================================================================
// GUARD EVENTS
// =============================================================================

/**
 * Payload for workflow.guard.blocked event
 * Emitted when a guard blocks workflow execution
 */
export const WorkflowGuardBlockedPayloadSchema = z.object({
  workflowId: z.string(),
  workflowKey: z.string(),
  nodeId: z.string(),
  blockedBy: z.string(),
  blockedMessage: z.string().optional(),
  guardType: z.enum(["safety", "injection", "policy", "spam"]),
  blockedContent: z.string().optional(),
  confidence: z.number().optional(),
});

export type WorkflowGuardBlockedPayload = z.infer<typeof WorkflowGuardBlockedPayloadSchema>;
