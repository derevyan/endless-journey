/**
 * Journey Log Entry Schema
 *
 * Each entry in the journey log - chronological events with full context.
 * This is the core building block for AI analysis.
 *
 * @module @journey/ai-report/schemas/journal-log
 */

import { z } from "zod";

/**
 * Event types for journey log entries.
 */
export const JourneyLogEventTypeSchema = z.enum([
  // User actions
  "user_message",
  "user_button_click",

  // Engine outputs
  "bot_message",
  "node_transition",
  "node_error",

  // Timers & follow-ups
  "timer_started",
  "timer_expired",
  "timer_cancelled",
  "followup_scheduled",
  "followup_executed",

  // State changes
  "variables_changed",
  "tags_changed",
  "mindstate_change",

  // Workflow (agent nodes)
  "workflow_started",
  "workflow_step",
  "workflow_completed",
  "workflow_error",

  // Guards & approvals
  "guard_passed",
  "guard_blocked",
  "guard_fallback",
  "approval_requested",
  "approval_response",

  // External integrations
  "webhook_called",
  "webhook_response",
  "crm_action",
  "teleport",
  "journey_teleport",

  // Human-in-the-loop decisions
  "hitl_decision",

  // LLM-specific
  "llm_call",
  "llm_error",
  "tool_execution",
]);

export type JourneyLogEventType = z.infer<typeof JourneyLogEventTypeSchema>;

/**
 * Each entry in the journey log - chronological events with full context.
 */
export const JourneyLogEntrySchema = z.object({
  // Identity
  id: z.string().uuid(),
  timestamp: z.string().datetime(),

  // Event classification
  eventType: JourneyLogEventTypeSchema,

  // Context
  nodeId: z.string(),
  nodeType: z.string(),
  nodeLabel: z.string().optional(),

  // Event-specific payload (detailed data)
  payload: z.unknown(),

  // Human-readable description for AI
  description: z.string(),
});

export type JourneyLogEntry = z.infer<typeof JourneyLogEntrySchema>;
