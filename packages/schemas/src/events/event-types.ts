/**
 * Event Type Constants
 *
 * Single source of truth for all event type strings.
 * Use these constants instead of hardcoded strings for compile-time safety.
 *
 * @module schemas/events/event-types
 */

// =============================================================================
// INTERACTION EVENTS (Journey Engine)
// =============================================================================

/**
 * Event types used by the journey engine during session execution.
 */
export const InteractionEventTypes = {
  // User actions
  USER_MESSAGE: "user.message",
  USER_CLICK: "user.click",

  // Engine events
  ENGINE_MESSAGE: "engine.message",
  ENGINE_TRANSITION: "engine.transition",
  ENGINE_ERROR: "engine.error",

  // Session events
  SESSION_TAGS: "session.tags",
  SESSION_VARIABLES: "session.variables",

  // Timer events
  TIMER_EXPIRED: "timer.expired",
  TIMER_FOLLOWUP: "timer.followup",

  // Journey events
  JOURNEY_TELEPORT: "journey.teleport",
  JOURNEY_CRM: "journey.crm",
  WEBHOOK_EXECUTED: "webhook.executed",

  // Other engine events
  MINDSTATE_UPDATED: "mindstate.updated",
  LLM_HITL: "llm.hitl",
  LLM_GUARD_BLOCKED: "llm.guard.blocked",
  LLM_GUARD_FALLBACK: "llm.guard.fallback",
} as const;

/**
 * Array of interaction event type values.
 * Used by InteractionEventTypeSchema in core.ts to prevent duplication.
 * Cast ensures proper tuple type for z.enum().
 */
export const InteractionEventTypeValues = Object.values(InteractionEventTypes) as [
  (typeof InteractionEventTypes)[keyof typeof InteractionEventTypes],
  ...(typeof InteractionEventTypes)[keyof typeof InteractionEventTypes][],
];

// =============================================================================
// LIFECYCLE EVENTS (API/Backend)
// =============================================================================

/**
 * Event types for bot lifecycle (creation, updates, activation).
 */
export const BotEventTypes = {
  BOT_CREATED: "bot.created",
  BOT_UPDATED: "bot.updated",
  BOT_DELETED: "bot.deleted",
  BOT_ACTIVATED: "bot.activated",
  BOT_DEACTIVATED: "bot.deactivated",
  BOT_WEBHOOK_REGISTERED: "bot.webhook.registered",
} as const;

/**
 * Event types for journey lifecycle (creation, updates, sessions).
 */
export const JourneyEventTypes = {
  JOURNEY_CREATED: "journey.created",
  JOURNEY_UPDATED: "journey.updated",
  JOURNEY_DELETED: "journey.deleted",
  JOURNEY_ACTIVATED: "journey.activated",
  JOURNEY_DEACTIVATED: "journey.deactivated",
  JOURNEY_SESSION_STARTED: "journey.session.started",
  JOURNEY_SESSION_COMPLETED: "journey.session.completed",
  JOURNEY_SCHEDULE_FIRED: "journey.schedule.fired",
  JOURNEY_WEBHOOK_RECEIVED: "journey.webhook.received",
} as const;

/**
 * Event types for CRM operations (stages, pipelines, fields).
 */
export const CrmEventTypes = {
  // Stage events
  CRM_STAGE_CHANGED: "crm.stage.changed",
  CRM_STAGE_CREATED: "crm.stage.created",
  CRM_STAGE_UPDATED: "crm.stage.updated",
  CRM_STAGE_DELETED: "crm.stage.deleted",
  CRM_STAGES_REORDERED: "crm.stages.reordered",

  // Pipeline events
  CRM_PIPELINE_ENTERED: "crm.pipeline.entered",
  CRM_PIPELINE_EXITED: "crm.pipeline.exited",
  CRM_PIPELINE_CREATED: "crm.pipeline.created",
  CRM_PIPELINE_UPDATED: "crm.pipeline.updated",
  CRM_PIPELINE_DELETED: "crm.pipeline.deleted",
  CRM_PIPELINE_DEFAULT_SET: "crm.pipeline.default_set",

  // Field events
  CRM_FIELD_UPDATED: "crm.field.updated",

  // Message events
  CRM_MESSAGE_SENT: "crm.message.sent",

  // Action feedback events (for workflow/journey-triggered CRM operations)
  CRM_ACTION_EXECUTED: "crm.action.executed",
  CRM_ACTION_FAILED: "crm.action.failed",
} as const;

/**
 * Event types for tag operations.
 */
export const TagEventTypes = {
  TAG_ADDED: "tag.added",
  TAG_REMOVED: "tag.removed",
  TAG_DEFINITION_CREATED: "tag.definition.created",
  TAG_DEFINITION_UPDATED: "tag.definition.updated",
  TAG_DEFINITION_DELETED: "tag.definition.deleted",
} as const;

/**
 * Event types for variable operations.
 */
export const VariableEventTypes = {
  VARIABLE_CHANGED: "variable.changed",
} as const;

/**
 * Event types for mindstate definition operations.
 */
export const MindstateEventTypes = {
  MINDSTATE_DEFINITION_CREATED: "mindstate.definition.created",
  MINDSTATE_DEFINITION_UPDATED: "mindstate.definition.updated",
  MINDSTATE_DEFINITION_DELETED: "mindstate.definition.deleted",
} as const;

// =============================================================================
// WORKFLOW EVENTS (Agent Workflow Execution)
// =============================================================================

/**
 * Event types for workflow execution lifecycle.
 * Used to track workflow runs within journeys.
 */
export const WorkflowEventTypes = {
  // Lifecycle events
  WORKFLOW_STARTED: "workflow.started",
  WORKFLOW_COMPLETED: "workflow.completed",
  WORKFLOW_ERROR: "workflow.error",

  // Step events
  WORKFLOW_STEP_STARTED: "workflow.step.started",
  WORKFLOW_STEP_COMPLETED: "workflow.step.completed",
  WORKFLOW_STEP_ERROR: "workflow.step.error",

  // Control events
  WORKFLOW_PAUSED: "workflow.paused",
  WORKFLOW_RESUMED: "workflow.resumed",

  // Approval events
  WORKFLOW_APPROVAL_REQUESTED: "workflow.approval.requested",
  WORKFLOW_APPROVAL_RESPONSE: "workflow.approval.response",

  // Guard events
  WORKFLOW_GUARD_BLOCKED: "workflow.guard.blocked",
} as const;

// =============================================================================
// SYSTEM EVENTS (UI Display)
// =============================================================================

/**
 * System event types for UI display purposes.
 * Used in simulator, activity logs, and user-facing components.
 * These are display aliases that may map to actual engine events.
 */
export const SystemEventTypes = {
  SYSTEM_MESSAGE: "system.message",
  SYSTEM_TRANSITION: "system.transition",
  SYSTEM_TIMEOUT: "system.timeout",
  SYSTEM_ERROR: "system.error",
  SYSTEM_TAGS: "system.tags",
  SYSTEM_VARIABLES: "system.variables",
  SYSTEM_TELEPORT: "system.teleport",
  SYSTEM_MINDSTATE: "system.mindstate",
  SYSTEM_CRM: "system.crm",
  SYSTEM_FOLLOWUP: "system.followup",
  SYSTEM_SSE_ERROR: "system.sse.error",
} as const;

// =============================================================================
// COMBINED EXPORTS
// =============================================================================

/**
 * All lifecycle event types (bot, journey, CRM, tag, variable, mindstate).
 */
export const LifecycleEventTypes = {
  ...BotEventTypes,
  ...JourneyEventTypes,
  ...CrmEventTypes,
  ...TagEventTypes,
  ...VariableEventTypes,
  ...MindstateEventTypes,
} as const;

/**
 * All event types combined (interaction + lifecycle + workflow + system).
 *
 * Use this for complete type safety when referencing any event type:
 * @example
 * import { EventTypes } from "@journey/schemas";
 * eventLogger.logEvent({ type: EventTypes.ENGINE_TRANSITION, ... });
 */
export const EventTypes = {
  ...InteractionEventTypes,
  ...LifecycleEventTypes,
  ...WorkflowEventTypes,
  ...SystemEventTypes,
} as const;

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Type representing any event type value from EventTypes.
 * Useful for function parameters that accept any event type.
 */
export type EventTypeValue = (typeof EventTypes)[keyof typeof EventTypes];

/**
 * Type representing interaction event type values only.
 */
export type InteractionEventTypeValue =
  (typeof InteractionEventTypes)[keyof typeof InteractionEventTypes];

/**
 * Type representing lifecycle event type values only.
 */
export type LifecycleEventTypeValue =
  (typeof LifecycleEventTypes)[keyof typeof LifecycleEventTypes];

/**
 * Type representing system event type values only.
 */
export type SystemEventTypeValue =
  (typeof SystemEventTypes)[keyof typeof SystemEventTypes];

/**
 * Type representing workflow event type values only.
 */
export type WorkflowEventTypeValue =
  (typeof WorkflowEventTypes)[keyof typeof WorkflowEventTypes];

/**
 * Type representing mindstate event type values only.
 */
export type MindstateEventTypeValue =
  (typeof MindstateEventTypes)[keyof typeof MindstateEventTypes];

// =============================================================================
// USER ACTIVITY MAPPING
// =============================================================================

/**
 * Mapping from InteractionEventTypes to user activity event types.
 *
 * This is the single source of truth for translating between:
 * - InteractionEventTypes (dotted namespace format: "user.message")
 * - UserActivityEventType (simple string format: "user_message")
 *
 * The API's transformInteractionToActivity() uses this mapping.
 * Adding a new interaction event type without updating this map
 * will cause a compile-time error if you try to use it.
 *
 * @example
 * ```typescript
 * // Get activity type from interaction type
 * const activityType = INTERACTION_TO_ACTIVITY_MAP[InteractionEventTypes.USER_MESSAGE];
 * // activityType = "user_message"
 * ```
 */
export const INTERACTION_TO_ACTIVITY_MAP = {
  // User actions
  [InteractionEventTypes.USER_MESSAGE]: "user_message",
  [InteractionEventTypes.USER_CLICK]: "user_click",

  // Engine events (note: engine.message → bot_message for UI clarity)
  [InteractionEventTypes.ENGINE_MESSAGE]: "bot_message",
  [InteractionEventTypes.ENGINE_TRANSITION]: "node_transition",
  [InteractionEventTypes.ENGINE_ERROR]: "error",

  // Session events
  [InteractionEventTypes.SESSION_TAGS]: "tags",
  [InteractionEventTypes.SESSION_VARIABLES]: "variables",

  // Timer events (note: timer.expired → timeout for UI clarity)
  [InteractionEventTypes.TIMER_EXPIRED]: "timeout",
  [InteractionEventTypes.TIMER_FOLLOWUP]: "followup",

  // Journey events
  [InteractionEventTypes.JOURNEY_TELEPORT]: "teleport",
  [InteractionEventTypes.JOURNEY_CRM]: "crm",
  [InteractionEventTypes.WEBHOOK_EXECUTED]: "webhook",

  // Other engine events
  [InteractionEventTypes.MINDSTATE_UPDATED]: "mindstate",
  [InteractionEventTypes.LLM_HITL]: "hitl",
  [InteractionEventTypes.LLM_GUARD_BLOCKED]: "guard_blocked",
  [InteractionEventTypes.LLM_GUARD_FALLBACK]: "guard_fallback",
} as const;

/**
 * User activity event type values as an array.
 * Used by UserActivityEventTypeSchema in user-activity.ts.
 * The type UserActivityEventType is exported from user-activity.ts.
 */
export const USER_ACTIVITY_EVENT_TYPES = [
  // Session lifecycle (not from interaction events)
  "session_started",
  "session_completed",
  // Mapped from interaction events
  ...Object.values(INTERACTION_TO_ACTIVITY_MAP),
  // Catch-all
  "system",
] as const;
