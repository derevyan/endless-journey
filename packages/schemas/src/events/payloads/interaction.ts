/**
 * Interaction Event Payloads
 *
 * Payload schemas for journey engine interaction events.
 * These are the fine-grained events during journey execution.
 *
 * @module schemas/events/payloads/interaction
 */

import { z } from "zod";
import { MediaSchema } from "../../nodes/base";

// =============================================================================
// USER INTERACTION EVENTS
// =============================================================================

/**
 * Input type for user messages
 * - "text": User typed the message directly
 * - "voice": User sent a voice message that was transcribed to text
 */
export const InputTypeSchema = z.enum(["text", "voice"]);
export type InputType = z.infer<typeof InputTypeSchema>;

/**
 * Payload for user.message event
 * Emitted when user sends a text message (typed or transcribed from voice)
 */
export const UserMessagePayloadSchema = z.object({
  text: z.string(),
  /** How the user sent the message (typed or voice transcribed) */
  inputType: InputTypeSchema.optional(),
});

export type UserMessagePayload = z.infer<typeof UserMessagePayloadSchema>;

// =============================================================================
// BUTTON CLICK OUTCOME TRACKING
// =============================================================================

/**
 * Outcome of a button click for debugging purposes.
 * Tracks what happened after a button was clicked.
 */
export const ButtonClickOutcomeSchema = z.enum([
  "transition_success",    // Normal - transitioned to target node
  "agent_reexecute",       // AI quick-reply - agent re-executed instead of transition
  "button_not_found",      // Button ID not in activeButtons or node data
  "edge_not_found",        // Button found but no edge connects to target
  "guard_blocked",         // Transition attempted but guard blocked it
  "error",                 // Error during processing
  "no_handler",            // No handler registered for this button type
]);

export type ButtonClickOutcome = z.infer<typeof ButtonClickOutcomeSchema>;

/**
 * Snapshot of active buttons at click time.
 * Used for debugging button routing issues.
 */
export const ActiveButtonSnapshotSchema = z.object({
  id: z.string(),
  text: z.string(),
  targetNodeId: z.string().optional(),
  source: z.enum(["node", "questionnaire", "plugin", "agent"]),
});

export type ActiveButtonSnapshot = z.infer<typeof ActiveButtonSnapshotSchema>;

/**
 * Payload for user.click event
 * Emitted when user clicks a button
 */
export const UserClickPayloadSchema = z.object({
  buttonId: z.string(),
  buttonLabel: z.string().optional(),

  // Debug fields for click tracking (optional for backward compatibility)
  /** Outcome of the click - what happened after processing */
  outcome: ButtonClickOutcomeSchema.optional(),
  /** Snapshot of buttons that were active when click was received */
  activeButtonsAtClick: z.array(ActiveButtonSnapshotSchema).optional(),
  /** If outcome != transition_success, explains why */
  failureReason: z.string().optional(),
  /** If transition succeeded, the target node ID */
  transitionedToNodeId: z.string().optional(),
});

export type UserClickPayload = z.infer<typeof UserClickPayloadSchema>;

// =============================================================================
// SYSTEM EVENTS
// =============================================================================

/**
 * Transition trigger schema for system.transition events.
 * Accepts any string since handlers use dynamic triggers like:
 * - "automatic", "start" - auto-transitions
 * - "condition_${branchId}" - condition branches
 * - "crm_${action}" - CRM actions
 * - "webhook_success", "webhook_error" - webhook results
 * - "message", "button_click", "timeout" - user events
 */
export const TransitionTriggerSchema = z.string();

export type TransitionTrigger = z.infer<typeof TransitionTriggerSchema>;

/**
 * Payload for system.message event
 * Emitted when bot sends a message to user
 */
export const SystemMessagePayloadSchema = z.object({
  content: z.string(),
  buttons: z.array(z.object({
    id: z.string(),
    label: z.string(),
  })).optional(),
  media: MediaSchema.optional(),
});

export type SystemMessagePayload = z.infer<typeof SystemMessagePayloadSchema>;

/**
 * Payload for system.transition event
 * Emitted when engine moves user between nodes
 */
export const SystemTransitionPayloadSchema = z.object({
  from: z.string().nullable(), // null for journey start (no previous node)
  to: z.string(),
  trigger: TransitionTriggerSchema.optional(),
  edgeId: z.string().optional(),
});

export type SystemTransitionPayload = z.infer<typeof SystemTransitionPayloadSchema>;

/**
 * Payload for system.timeout event
 * Emitted when a timer expires
 */
export const SystemTimeoutPayloadSchema = z.object({
  timerId: z.string().optional(),
  edgeId: z.string().optional(),
  durationMs: z.number().optional(),
});

export type SystemTimeoutPayload = z.infer<typeof SystemTimeoutPayloadSchema>;

/**
 * Payload for system.error event
 * Emitted when an error occurs in journey execution
 */
export const SystemErrorPayloadSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  nodeId: z.string().optional(),
});

export type SystemErrorPayload = z.infer<typeof SystemErrorPayloadSchema>;

/**
 * Payload for system.tags event
 * Emitted when tags are modified during journey execution
 */
export const SystemTagsPayloadSchema = z.object({
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  resultTags: z.array(z.string()).optional(),
  operationCount: z.number().optional(), // Number of tag operations performed
  scope: z.string().optional(), // Scope of tags (e.g., "global" for global tags)
});

export type SystemTagsPayload = z.infer<typeof SystemTagsPayloadSchema>;

/**
 * Payload for system.variables event
 * Emitted when variables are modified during journey execution
 */
export const SystemVariablesPayloadSchema = z.object({
  scope: z.string(),
  operationCount: z.number(),
  operations: z.array(z.object({
    op: z.string(),
    key: z.string(),
  })).optional(),
});

export type SystemVariablesPayload = z.infer<typeof SystemVariablesPayloadSchema>;

/**
 * Payload for system.teleport event
 * Emitted when user is teleported to another journey
 */
export const SystemTeleportPayloadSchema = z.object({
  fromJourneyId: z.string().optional(),
  toJourneyId: z.string(),
  toNodeId: z.string().optional(),
  preserveContext: z.boolean().optional(),
});

export type SystemTeleportPayload = z.infer<typeof SystemTeleportPayloadSchema>;

/**
 * Payload for system.mindstate event
 * Emitted when mindstate parameters are updated
 */
export const SystemMindstatePayloadSchema = z.object({
  mindstateKey: z.string().optional(),
  key: z.string().optional(), // alias for mindstateKey
  changesCount: z.number().optional(),
  changes: z.array(z.object({
    parameter: z.string(),
    from: z.unknown(),
    to: z.unknown(),
  })).optional(),
});

export type SystemMindstatePayload = z.infer<typeof SystemMindstatePayloadSchema>;

/**
 * Payload for system.crm event
 * Emitted when CRM actions are executed (create, move, remove)
 */
export const SystemCrmPayloadSchema = z.object({
  action: z.string(),
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  success: z.boolean().optional(),
  message: z.string().optional(),
});

export type SystemCrmPayload = z.infer<typeof SystemCrmPayloadSchema>;

/**
 * Payload for system.followup event
 * Emitted when a follow-up reminder is sent
 */
export const SystemFollowupPayloadSchema = z.object({
  timerId: z.string(),
  stepIndex: z.number(),
  totalSteps: z.number(),
  hasExitOnTimeout: z.boolean().optional(),
});

export type SystemFollowupPayload = z.infer<typeof SystemFollowupPayloadSchema>;

// Note: Questionnaire reminders now use SystemFollowupPayload
// No separate SystemQuestionnaireReminderPayloadSchema needed

/**
 * Payload for system.hitl event
 * Emitted when HITL middleware makes a decision (approve, reject, edit, skip)
 */
export const SystemHitlPayloadSchema = z.object({
  /** HITL request ID for correlation */
  requestId: z.string(),
  /** Tool that was intercepted */
  toolName: z.string(),
  /** Decision made by human reviewer */
  decision: z.enum(["approve", "edit", "reject", "skip"]),
  /** Optional message from the reviewer */
  message: z.string().optional(),
  /** Whether arguments were edited (for "edit" decision) */
  wasEdited: z.boolean().optional(),
});

export type SystemHitlPayload = z.infer<typeof SystemHitlPayloadSchema>;

/**
 * Payload for llm.guard.blocked event
 * Emitted when a guard condition blocks an edge transition
 */
const GuardDetailsSchema = z.object({
  /** Expression string (for expression guards) */
  expression: z.string().optional(),
  /** Variable condition details (for variable guards) */
  variable: z.object({
    key: z.string(),
    operator: z.string(),
    value: z.unknown(),
  }).optional(),
  /** Tag condition details (for tag guards) */
  tag: z.object({
    tag: z.string(),
    operator: z.enum(["has", "notHas"]),
  }).optional(),
});

const GuardedEdgeSchema = z.object({
  /** Edge ID that was blocked */
  edgeId: z.string(),
  /** Type of guard that blocked: expression, variable, or tag */
  guardType: z.enum(["expression", "variable", "tag"]),
  /** Guard details for debugging */
  guard: GuardDetailsSchema.optional(),
});

export const SystemGuardBlockedPayloadSchema = GuardedEdgeSchema;

export type SystemGuardBlockedPayload = z.infer<typeof SystemGuardBlockedPayloadSchema>;

/**
 * Payload for llm.guard.fallback event
 * Emitted when all guards fail and a fallback edge is used
 */
export const SystemGuardFallbackPayloadSchema = z.object({
  /** Fallback edge ID selected after guards failed */
  fallbackEdgeId: z.string(),
  /** Guards that failed before fallback was chosen */
  blockedEdges: z.array(GuardedEdgeSchema).optional(),
});

export type SystemGuardFallbackPayload = z.infer<typeof SystemGuardFallbackPayloadSchema>;
