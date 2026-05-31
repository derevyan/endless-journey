/**
 * PostgreSQL Enums for Type Safety
 *
 * Defines PostgreSQL enum types for status and type columns.
 * These provide database-level type safety and validation.
 *
 * @module schema/enums
 */

import { pgEnum } from "drizzle-orm/pg-core";

// =============================================================================
// JOURNEY & SESSION STATUS
// =============================================================================

/** Journey status: draft = editing, active = running, archived = permanently retired (matches workflow_status) */
export const journeyStatusEnum = pgEnum("journey_status", ["draft", "active", "archived"]);

/** Session status: active = in progress, completed = finished, dropped = abandoned, paused = temporarily stopped, error = execution failed */
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "dropped", "paused", "error"]);

/** Session mode: live = real users, test = testing, simulation = automated testing */
export const sessionModeEnum = pgEnum("session_mode", ["live", "test", "simulation"]);

// =============================================================================
// PLATFORM & MESSAGING
// =============================================================================

/** Platform types for messaging channels and clients */
export const platformEnum = pgEnum("platform", ["telegram", "whatsapp", "simulator"]);

/** Message types for sent messages and interactions */
export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "photo",
  "video",
  "audio",
  "document",
  "sticker",
  "contact",
  "location",
  "buttons",
]);

/** Message delivery status */
export const messageStatusEnum = pgEnum("message_status", ["pending", "sent", "delivered", "failed", "read"]);

/** Media types for journey assets */
export const mediaTypeEnum = pgEnum("media_type", ["image", "video"]);

// =============================================================================
// ORGANIZATION & CRM
// =============================================================================

/** Organization member roles */
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);

/** Invitation status for organization invites */
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "rejected", "canceled"]);

/** CRM custom field types */
export const crmFieldTypeEnum = pgEnum("crm_field_type", ["text", "number", "date", "select", "multi_select"]);

// =============================================================================
// WORKFLOW & AGENTS
// =============================================================================

/** Workflow/agent definition status */
export const workflowStatusEnum = pgEnum("workflow_status", ["draft", "active", "archived"]);

/** Mindstate definition status (matches workflow_status for consistency) */
export const mindstateStatusEnum = pgEnum("mindstate_status", ["draft", "active", "archived"]);

/** Prompt type: text = simple string, chat = array of role-based messages */
export const promptTypeEnum = pgEnum("prompt_type", ["text", "chat"]);

/** Workflow approval status */
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected", "timed_out"]);

/** Timeout action for approvals */
export const timeoutActionEnum = pgEnum("timeout_action", ["approve", "reject", "skip"]);

// =============================================================================
// AUTOMATION & TRIGGERS
// =============================================================================

/** Trigger types for automation system */
export const triggerTypeEnum = pgEnum("trigger_type", [
  "tag_change",
  "variable_condition",
  "journey_completed",
  "schedule",
  "webhook",
  "crm_stage_change",
  "crm_field_change",
  "crm_pipeline_entered",
]);

/** Tag action types */
export const tagActionEnum = pgEnum("tag_action", ["added", "removed"]);

/** Variable scope types */
export const variableScopeEnum = pgEnum("variable_scope", ["user", "journey", "global"]);

/** Durable timer status */
export const timerStatusEnum = pgEnum("timer_status", ["active", "paused", "fired", "cancelled"]);

// =============================================================================
// EVENTS & ERROR HANDLING
// =============================================================================

/** Failed event resolution status */
export const failedEventStatusEnum = pgEnum("failed_event_status", ["pending", "retrying", "failed", "resolved"]);

/** Journey transfer trigger source */
export const transferTriggerEnum = pgEnum("transfer_trigger", ["ai_tool", "teleport_node", "api"]);
