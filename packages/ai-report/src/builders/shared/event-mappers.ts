/**
 * Shared Event Mappers
 *
 * Consolidates event type mapping functions used across multiple builders.
 * Single source of truth for converting raw event strings to typed enums.
 *
 * @module @journey/ai-report/builders/shared/event-mappers
 */

import type {
  JourneyLogEventType,
  TransitionTrigger,
  UnprocessedEventOutcome,
  ButtonClickOutcome,
} from "../../schemas";

/**
 * Map interaction event type to journey log event type.
 *
 * Used by: journey-log-builder
 */
const EVENT_TYPE_MAP: Record<string, JourneyLogEventType> = {
  // User actions
  "user.message": "user_message",
  "user.click": "user_button_click",

  // Engine events
  "engine.message": "bot_message",
  "engine.transition": "node_transition",
  "engine.error": "node_error",

  // Timer events
  "timer.started": "timer_started",
  "timer.expired": "timer_expired",
  "timer.cancelled": "timer_cancelled",
  "timer.followup": "followup_executed",
  "followup.scheduled": "followup_scheduled",

  // Session state changes
  "session.variables": "variables_changed",
  "session.tags": "tags_changed",
  "system.mindstate": "mindstate_change",
  "mindstate.changed": "mindstate_change",

  // Workflow events
  "workflow.started": "workflow_started",
  "workflow.step.completed": "workflow_step",
  "workflow.completed": "workflow_completed",
  "workflow.error": "workflow_error",

  // Guard events
  "llm.guard.blocked": "guard_blocked",
  "llm.guard.passed": "guard_passed",
  "llm.guard.fallback": "guard_fallback",

  // Webhook events
  "webhook.executed": "webhook_response",
  "webhook.called": "webhook_called",
  "webhook.response": "webhook_response",

  // CRM events
  "journey.crm": "crm_action",
  "system.crm": "crm_action",
  "crm.action": "crm_action",

  // Teleport events
  "journey.teleport": "journey_teleport",
  "system.teleport": "journey_teleport",
  "teleport": "journey_teleport",

  // HITL events
  "system.hitl": "hitl_decision",
  "hitl.decision": "hitl_decision",
  "hitl.requested": "approval_requested",
  "hitl.response": "approval_response",

  // Approval events
  "approval.requested": "approval_requested",
  "approval.response": "approval_response",

  // LLM events
  "llm.call": "llm_call",
  "llm.error": "llm_error",
  "tool.execution": "tool_execution",
  "tool.error": "tool_execution",
};

export function mapEventType(interactionType: string): JourneyLogEventType {
  return EVENT_TYPE_MAP[interactionType] || "node_transition";
}

/**
 * Map trigger string to TransitionTrigger enum.
 *
 * Used by: transition-builder
 */
const TRIGGER_MAP: Record<string, TransitionTrigger> = {
  automatic: "auto",
  auto: "auto",
  start: "auto",
  button_click: "button_click",
  message: "auto",
  timeout: "timer_expired",
  timer_expired: "timer_expired",
  condition_true: "condition_true",
  condition_false: "condition_false",
  guard_blocked: "guard_blocked",
  guard_passed: "guard_passed",
  error: "error",
  workflow_exit: "workflow_exit",
};

export function mapTrigger(trigger: string | undefined): TransitionTrigger {
  return TRIGGER_MAP[trigger || "auto"] || "auto";
}

/**
 * Map ButtonClickOutcome to UnprocessedEventOutcome.
 *
 * Used by: button-click-builder for unprocessed events
 */
const OUTCOME_MAP: Record<ButtonClickOutcome, UnprocessedEventOutcome> = {
  transition_success: "unknown", // Should never be used for unprocessed
  agent_reexecute: "unknown", // Should never be used for unprocessed
  button_not_found: "button_mismatch",
  edge_not_found: "missing_edge",
  guard_blocked: "guard_blocked", // Fixed: was incorrectly mapped to handler_not_found
  error: "error",
  no_handler: "handler_not_found",
};

export function mapButtonOutcomeToUnprocessed(
  outcome: ButtonClickOutcome
): UnprocessedEventOutcome {
  return OUTCOME_MAP[outcome] || "unknown";
}
