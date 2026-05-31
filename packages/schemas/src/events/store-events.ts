/**
 * Store Event Types
 *
 * These event types are used for frontend store communication and can be
 * shared with the backend for real-time synchronization via SSE.
 *
 * By defining events in schemas, we enable:
 * - Type-safe event contracts between frontend stores
 * - Backend can emit events that match frontend expectations
 * - Real-time sync for collaborative features
 *
 * @module events/store-events
 */

import { z } from "zod";
import { IsoTimestampSchema } from "../utils";

// =============================================================================
// CANVAS EVENTS (Journey/Workflow Builders)
// =============================================================================

/**
 * Node added to canvas
 */
export interface NodeAddedEvent {
  type: "node:added";
  payload: {
    nodeId: string;
    nodeType: string;
    position?: { x: number; y: number };
  };
}

/**
 * Node updated on canvas
 */
export interface NodeUpdatedEvent {
  type: "node:updated";
  payload: {
    nodeId: string;
    updates: Record<string, unknown>;
  };
}

/**
 * Node deleted from canvas
 */
export interface NodeDeletedEvent {
  type: "node:deleted";
  payload: {
    nodeId: string;
  };
}

/**
 * Edge added between nodes
 */
export interface EdgeAddedEvent {
  type: "edge:added";
  payload: {
    edgeId: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  };
}

/**
 * Edge updated
 */
export interface EdgeUpdatedEvent {
  type: "edge:updated";
  payload: {
    edgeId: string;
    updates: Record<string, unknown>;
  };
}

/**
 * Edge deleted
 */
export interface EdgeDeletedEvent {
  type: "edge:deleted";
  payload: {
    edgeId: string;
  };
}

// =============================================================================
// JOURNEY EVENTS
// =============================================================================

/**
 * Journey loaded into editor
 */
export interface JourneyLoadedEvent {
  type: "journey:loaded";
  payload: {
    journeyId: string;
  };
}

/**
 * Journey saved
 */
export interface JourneySavedEvent {
  type: "journey:saved";
  payload: {
    journeyId: string;
    savedBy?: string;
  };
}

/**
 * Journey reset to initial state
 */
export interface JourneyResetEvent {
  type: "journey:reset";
  payload: Record<string, never>;
}

/**
 * Layout applied to journey
 */
export interface JourneyLayoutAppliedEvent {
  type: "journey:layoutApplied";
  payload: {
    layoutType: string;
  };
}

// =============================================================================
// SELECTION EVENTS
// =============================================================================

/**
 * Node selected
 */
export interface SelectionNodeEvent {
  type: "selection:node";
  payload: {
    nodeId: string | null;
  };
}

/**
 * Edge selected
 */
export interface SelectionEdgeEvent {
  type: "selection:edge";
  payload: {
    edgeId: string | null;
  };
}

/**
 * Selection cleared
 */
export interface SelectionClearedEvent {
  type: "selection:cleared";
  payload: Record<string, never>;
}

// =============================================================================
// UI STATE EVENTS
// =============================================================================

/**
 * Pending changes state changed
 */
export interface UIPendingChangesEvent {
  type: "ui:pendingChanges";
  payload: {
    hasPendingChanges: boolean;
  };
}

/**
 * Edit mode toggled
 */
export interface UIEditModeEvent {
  type: "ui:editMode";
  payload: {
    editMode: boolean;
  };
}

/**
 * Simulator mode requested
 */
export interface UIRequestSimulatorModeEvent {
  type: "ui:requestSimulatorMode";
  payload: Record<string, never>;
}

// =============================================================================
// VERSION EVENTS
// =============================================================================

/**
 * Version saved
 */
export interface VersionSavedEvent {
  type: "version:saved";
  payload: {
    versionId: string;
    notes?: string;
  };
}

/**
 * Version loaded
 */
export interface VersionLoadedEvent {
  type: "version:loaded";
  payload: {
    versionId: string;
  };
}

// =============================================================================
// USER EVENTS
// =============================================================================

/**
 * User logged in
 */
export interface UserLoggedInEvent {
  type: "user:loggedIn";
  payload: {
    userId: string;
  };
}

/**
 * User logged out
 */
export interface UserLoggedOutEvent {
  type: "user:loggedOut";
  payload: Record<string, never>;
}

// =============================================================================
// MINDSTATE EVENTS
// =============================================================================

/**
 * Mindstate definition loaded
 */
export interface MindstateDefinitionLoadedEvent {
  type: "mindstate:definition:loaded";
  payload: {
    definitionId: string;
  };
}

/**
 * Mindstate definition updated
 */
export interface MindstateDefinitionUpdatedEvent {
  type: "mindstate:definition:updated";
  payload: {
    definitionId: string;
    field: string;
  };
}

/**
 * Mindstate definition saved
 */
export interface MindstateDefinitionSavedEvent {
  type: "mindstate:definition:saved";
  payload: {
    definitionId: string;
  };
}

/**
 * Mindstate preview analyzed
 */
export interface MindstatePreviewAnalyzedEvent {
  type: "mindstate:preview:analyzed";
  payload: {
    messageCount: number;
    insightsCount: number;
  };
}

/**
 * Mindstate preview reset
 */
export interface MindstatePreviewResetEvent {
  type: "mindstate:preview:reset";
  payload: Record<string, never>;
}

/**
 * Mindstate builder reset
 */
export interface MindstateBuilderResetEvent {
  type: "mindstate:builder:reset";
  payload: Record<string, never>;
}

/**
 * Mindstate agent added
 */
export interface MindstateAgentAddedEvent {
  type: "mindstate:agent:added";
  payload: {
    agentId: string;
  };
}

/**
 * Mindstate agent updated
 */
export interface MindstateAgentUpdatedEvent {
  type: "mindstate:agent:updated";
  payload: {
    agentId: string;
    field: string;
  };
}

/**
 * Mindstate agent deleted
 */
export interface MindstateAgentDeletedEvent {
  type: "mindstate:agent:deleted";
  payload: {
    agentId: string;
  };
}

/**
 * Mindstate parameter added
 */
export interface MindstateParameterAddedEvent {
  type: "mindstate:parameter:added";
  payload: {
    parameterId: string;
  };
}

/**
 * Mindstate parameter updated
 */
export interface MindstateParameterUpdatedEvent {
  type: "mindstate:parameter:updated";
  payload: {
    parameterId: string;
    field: string;
  };
}

/**
 * Mindstate parameter deleted
 */
export interface MindstateParameterDeletedEvent {
  type: "mindstate:parameter:deleted";
  payload: {
    parameterId: string;
  };
}

/**
 * Mindstate parameter assignment changed
 * Emitted when a parameter's responsibleAgentId is changed
 */
export interface MindstateAssignmentChangedEvent {
  type: "mindstate:assignment:changed";
  payload: {
    parameterId: string;
    fromAgentId: string | null;
    toAgentId: string | null;
  };
}

// =============================================================================
// SYNC EVENTS (Backend → Frontend via SSE)
// =============================================================================

/**
 * Session started (from backend)
 */
export interface SyncSessionStartedEvent {
  type: "sync:session.started";
  payload: {
    sessionId: string;
    journeyId: string;
  };
}

/**
 * Session event occurred (from backend)
 */
export interface SyncSessionEventEvent {
  type: "sync:session.event";
  payload: {
    sessionId: string;
    eventType: string;
    data: unknown;
  };
}

/**
 * Journey saved by another user (collaborative sync)
 */
export interface SyncJourneySavedEvent {
  type: "sync:journey.saved";
  payload: {
    journeyId: string;
    savedBy: string;
    timestamp: string;
  };
}

// =============================================================================
// WORKFLOW SYNC EVENTS (Backend → Frontend via SSE)
// =============================================================================

/**
 * Workflow execution started
 */
export interface SyncWorkflowStartedEvent {
  type: "sync:workflow.started";
  payload: {
    workflowId: string;
    workflowKey: string;
    workflowName?: string;
    startNodeId?: string;
  };
}

/**
 * Workflow step started execution
 */
export interface SyncWorkflowStepStartedEvent {
  type: "sync:workflow.step.started";
  payload: {
    workflowId: string;
    workflowKey: string;
    nodeId: string;
    nodeType: string;
    nodeName?: string;
  };
}

/**
 * Workflow step completed successfully
 */
export interface SyncWorkflowStepCompletedEvent {
  type: "sync:workflow.step.completed";
  payload: {
    workflowId: string;
    workflowKey: string;
    nodeId: string;
    nodeType: string;
    nodeName?: string;
    durationMs?: number;
    outHandle?: string;
    /** Node execution output data for debugging (contains data + metadata) */
    output?: Record<string, unknown>;
  };
}

/**
 * Workflow step failed with error
 */
export interface SyncWorkflowStepErrorEvent {
  type: "sync:workflow.step.error";
  payload: {
    workflowId: string;
    workflowKey: string;
    nodeId: string;
    nodeType: string;
    nodeName?: string;
    errorMessage: string;
    durationMs?: number;
  };
}

/**
 * Workflow completed successfully
 */
export interface SyncWorkflowCompletedEvent {
  type: "sync:workflow.completed";
  payload: {
    workflowId: string;
    workflowKey: string;
    durationMs?: number;
    nodesExecuted?: number;
    success?: boolean;
  };
}

/**
 * Workflow failed with error
 */
export interface SyncWorkflowErrorEvent {
  type: "sync:workflow.error";
  payload: {
    workflowId: string;
    workflowKey: string;
    errorMessage: string;
    failedNodeId?: string;
    failedNodeType?: string;
    durationMs?: number;
  };
}

/**
 * Workflow execution paused
 */
export interface SyncWorkflowPausedEvent {
  type: "sync:workflow.paused";
  payload: {
    workflowId: string;
    workflowKey: string;
    pausedAtNodeId: string;
    pauseReason?: string;
  };
}

/**
 * Workflow execution resumed
 */
export interface SyncWorkflowResumedEvent {
  type: "sync:workflow.resumed";
  payload: {
    workflowId: string;
    workflowKey: string;
    resumedAtNodeId: string;
    pauseDurationMs?: number;
  };
}

/**
 * Workflow guard blocked execution
 */
export interface SyncWorkflowGuardBlockedEvent {
  type: "sync:workflow.guard.blocked";
  payload: {
    workflowId: string;
    workflowKey: string;
    nodeId: string;
    blockedBy: string;
    blockedMessage?: string;
    guardType?: string;
  };
}

/**
 * Workflow approval requested from user
 */
export interface SyncWorkflowApprovalRequestedEvent {
  type: "sync:workflow.approval.requested";
  payload: {
    workflowId: string;
    workflowKey: string;
    nodeId: string;
    approvalMessage?: string;
    approvalType?: string;
    requestedActions?: string[];
  };
}

/**
 * User responded to workflow approval request
 */
export interface SyncWorkflowApprovalResponseEvent {
  type: "sync:workflow.approval.response";
  payload: {
    workflowId: string;
    workflowKey: string;
    nodeId: string;
    approved: boolean;
    respondedBy?: string;
  };
}

// =============================================================================
// ZOD SCHEMAS FOR SSE VALIDATION
// =============================================================================

/**
 * Zod schemas for sync events that cross the backend → frontend SSE boundary.
 * These enable runtime validation of events received from the server.
 *
 * Note: Frontend-only events (node:added, ui:editMode, etc.) don't need
 * Zod validation as they stay in-process. Only SSE-delivered events are validated.
 */

// Session sync events
export const SyncSessionStartedEventSchema = z.object({
  type: z.literal("sync:session.started"),
  payload: z.object({
    sessionId: z.string(),
    journeyId: z.string(),
  }),
});

export const SyncSessionEventSchema = z.object({
  type: z.literal("sync:session.event"),
  payload: z.object({
    sessionId: z.string(),
    eventType: z.string(),
    data: z.unknown(),
  }),
});

export const SyncJourneySavedEventSchema = z.object({
  type: z.literal("sync:journey.saved"),
  payload: z.object({
    journeyId: z.string(),
    savedBy: z.string(),
    timestamp: IsoTimestampSchema,
  }),
});

// Workflow sync events
export const SyncWorkflowStartedEventSchema = z.object({
  type: z.literal("sync:workflow.started"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    workflowName: z.string().optional(),
    startNodeId: z.string().optional(),
  }),
});

export const SyncWorkflowStepStartedEventSchema = z.object({
  type: z.literal("sync:workflow.step.started"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    nodeId: z.string(),
    nodeType: z.string(),
    nodeName: z.string().optional(),
  }),
});

export const SyncWorkflowStepCompletedEventSchema = z.object({
  type: z.literal("sync:workflow.step.completed"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    nodeId: z.string(),
    nodeType: z.string(),
    nodeName: z.string().optional(),
    durationMs: z.number().optional(),
    outHandle: z.string().optional(),
    output: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const SyncWorkflowStepErrorEventSchema = z.object({
  type: z.literal("sync:workflow.step.error"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    nodeId: z.string(),
    nodeType: z.string(),
    nodeName: z.string().optional(),
    errorMessage: z.string(),
    durationMs: z.number().optional(),
  }),
});

export const SyncWorkflowCompletedEventSchema = z.object({
  type: z.literal("sync:workflow.completed"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    durationMs: z.number().optional(),
    nodesExecuted: z.number().optional(),
    success: z.boolean().optional(),
  }),
});

export const SyncWorkflowErrorEventSchema = z.object({
  type: z.literal("sync:workflow.error"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    errorMessage: z.string(),
    failedNodeId: z.string().optional(),
    failedNodeType: z.string().optional(),
    durationMs: z.number().optional(),
  }),
});

// Workflow control events (paused, resumed, guard blocked, approvals)

export const SyncWorkflowPausedEventSchema = z.object({
  type: z.literal("sync:workflow.paused"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    pausedAtNodeId: z.string(),
    pauseReason: z.string().optional(),
  }),
});

export const SyncWorkflowResumedEventSchema = z.object({
  type: z.literal("sync:workflow.resumed"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    resumedAtNodeId: z.string(),
    pauseDurationMs: z.number().optional(),
  }),
});

export const SyncWorkflowGuardBlockedEventSchema = z.object({
  type: z.literal("sync:workflow.guard.blocked"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    nodeId: z.string(),
    blockedBy: z.string(),
    blockedMessage: z.string().optional(),
    guardType: z.string().optional(),
  }),
});

export const SyncWorkflowApprovalRequestedEventSchema = z.object({
  type: z.literal("sync:workflow.approval.requested"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    nodeId: z.string(),
    approvalMessage: z.string().optional(),
    approvalType: z.string().optional(),
    requestedActions: z.array(z.string()).optional(),
  }),
});

export const SyncWorkflowApprovalResponseEventSchema = z.object({
  type: z.literal("sync:workflow.approval.response"),
  payload: z.object({
    workflowId: z.string(),
    workflowKey: z.string(),
    nodeId: z.string(),
    approved: z.boolean(),
    respondedBy: z.string().optional(),
  }),
});

/**
 * Discriminated union of all sync event schemas.
 * Use this for runtime validation of SSE events from the backend.
 *
 * @example
 * ```typescript
 * const result = SyncEventSchema.safeParse(eventFromSSE);
 * if (result.success) {
 *   // result.data is typed as SyncEvent
 *   handleSyncEvent(result.data);
 * }
 * ```
 */
export const SyncEventSchema = z.discriminatedUnion("type", [
  // Session events
  SyncSessionStartedEventSchema,
  SyncSessionEventSchema,
  SyncJourneySavedEventSchema,
  // Workflow lifecycle events
  SyncWorkflowStartedEventSchema,
  SyncWorkflowStepStartedEventSchema,
  SyncWorkflowStepCompletedEventSchema,
  SyncWorkflowStepErrorEventSchema,
  SyncWorkflowCompletedEventSchema,
  SyncWorkflowErrorEventSchema,
  // Workflow control events
  SyncWorkflowPausedEventSchema,
  SyncWorkflowResumedEventSchema,
  SyncWorkflowGuardBlockedEventSchema,
  SyncWorkflowApprovalRequestedEventSchema,
  SyncWorkflowApprovalResponseEventSchema,
]);

// =============================================================================
// UNION TYPES
// =============================================================================

/**
 * All canvas-related events
 */
export type CanvasEvent =
  | NodeAddedEvent
  | NodeUpdatedEvent
  | NodeDeletedEvent
  | EdgeAddedEvent
  | EdgeUpdatedEvent
  | EdgeDeletedEvent;

/**
 * All journey-related events
 */
export type JourneyEvent =
  | JourneyLoadedEvent
  | JourneySavedEvent
  | JourneyResetEvent
  | JourneyLayoutAppliedEvent;

/**
 * All selection events
 */
export type SelectionEvent = SelectionNodeEvent | SelectionEdgeEvent | SelectionClearedEvent;

/**
 * All UI state events
 */
export type UIEvent = UIPendingChangesEvent | UIEditModeEvent | UIRequestSimulatorModeEvent;

/**
 * All version events
 */
export type VersionEvent = VersionSavedEvent | VersionLoadedEvent;

/**
 * All user events
 */
export type UserEvent = UserLoggedInEvent | UserLoggedOutEvent;

/**
 * All mindstate events
 */
export type MindstateEvent =
  | MindstateDefinitionLoadedEvent
  | MindstateDefinitionUpdatedEvent
  | MindstateDefinitionSavedEvent
  | MindstatePreviewAnalyzedEvent
  | MindstatePreviewResetEvent
  | MindstateBuilderResetEvent
  | MindstateAgentAddedEvent
  | MindstateAgentUpdatedEvent
  | MindstateAgentDeletedEvent
  | MindstateParameterAddedEvent
  | MindstateParameterUpdatedEvent
  | MindstateParameterDeletedEvent
  | MindstateAssignmentChangedEvent;

/**
 * All workflow sync events
 */
export type WorkflowSyncEvent =
  | SyncWorkflowStartedEvent
  | SyncWorkflowStepStartedEvent
  | SyncWorkflowStepCompletedEvent
  | SyncWorkflowStepErrorEvent
  | SyncWorkflowCompletedEvent
  | SyncWorkflowErrorEvent
  | SyncWorkflowPausedEvent
  | SyncWorkflowResumedEvent
  | SyncWorkflowGuardBlockedEvent
  | SyncWorkflowApprovalRequestedEvent
  | SyncWorkflowApprovalResponseEvent;

/**
 * All sync events (from backend)
 */
export type SyncEvent =
  | SyncSessionStartedEvent
  | SyncSessionEventEvent
  | SyncJourneySavedEvent
  | WorkflowSyncEvent;

/**
 * All store events (frontend only, excludes sync events)
 */
export type StoreEventBase =
  | CanvasEvent
  | JourneyEvent
  | SelectionEvent
  | UIEvent
  | VersionEvent
  | UserEvent
  | MindstateEvent;

/**
 * All possible events including sync events
 */
export type AllStoreEvents = StoreEventBase | SyncEvent;

/**
 * Extract event type string from event union
 */
export type StoreEventType = AllStoreEvents["type"];
