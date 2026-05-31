/**
 * Frontend Event Registry
 *
 * Central configuration for frontend event handling.
 * Maps event types to their cache invalidation and notification settings.
 *
 * @module lib/events/registry
 */

import { EventTypes, type EventType } from "@journey/schemas";

import {
  journeyKeys,
  sessionKeys,
  channelKeys,
  tagKeys,
  eventKeys,
  crmKeys,
  variableKeys,
  mindstateKeys,
} from "@/shared/lib/query-keys";

import type { FrontendEventConfig } from "./types";

// =============================================================================
// FRONTEND EVENT REGISTRY
// =============================================================================

/**
 * Frontend event configuration registry
 *
 * Maps event types to:
 * - invalidates: Query keys to invalidate
 * - notify: Whether to show a toast notification
 * - notifyMessage: Custom notification message
 * - notifyVariant: Toast variant (success, info, warning, error)
 */
export const FRONTEND_EVENT_REGISTRY: Partial<Record<EventType, FrontendEventConfig>> = {
  // ─────────────────────────────────────────────────────────────────────────
  // BOT EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.BOT_CREATED]: {
    invalidates: [channelKeys.list()],
    notify: true,
    notifyMessage: "New bot registered",
    notifyVariant: "success",
  },
  [EventTypes.BOT_UPDATED]: {
    invalidates: [channelKeys.list()],
    notify: false,
  },
  [EventTypes.BOT_DELETED]: {
    invalidates: [channelKeys.list()],
    notify: true,
    notifyMessage: "Bot deleted",
    notifyVariant: "info",
  },
  [EventTypes.BOT_ACTIVATED]: {
    invalidates: [channelKeys.list()],
    notify: true,
    notifyMessage: "Bot activated",
    notifyVariant: "success",
  },
  [EventTypes.BOT_DEACTIVATED]: {
    invalidates: [channelKeys.list()],
    notify: true,
    notifyMessage: "Bot deactivated",
    notifyVariant: "info",
  },
  [EventTypes.BOT_WEBHOOK_REGISTERED]: {
    invalidates: [channelKeys.list()],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM STAGE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_STAGE_CHANGED]: {
    invalidates: [crmKeys.clients()],
    notify: false,
  },
  [EventTypes.CRM_STAGE_CREATED]: {
    invalidates: [crmKeys.pipelines(), crmKeys.stages()],
    notify: true,
    notifyMessage: "Stage created",
    notifyVariant: "success",
  },
  [EventTypes.CRM_STAGE_UPDATED]: {
    invalidates: [crmKeys.pipelines(), crmKeys.stages()],
    notify: false,
  },
  [EventTypes.CRM_STAGE_DELETED]: {
    invalidates: [crmKeys.pipelines(), crmKeys.stages(), crmKeys.clients()],
    notify: true,
    notifyMessage: "Stage deleted",
    notifyVariant: "info",
  },
  [EventTypes.CRM_STAGES_REORDERED]: {
    invalidates: [crmKeys.pipelines(), crmKeys.stages()],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM PIPELINE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_PIPELINE_ENTERED]: {
    invalidates: [crmKeys.clients()],
    notify: false,
  },
  [EventTypes.CRM_PIPELINE_EXITED]: {
    invalidates: [crmKeys.clients()],
    notify: false,
  },
  [EventTypes.CRM_PIPELINE_CREATED]: {
    invalidates: [crmKeys.pipelines()],
    notify: true,
    notifyMessage: "Pipeline created",
    notifyVariant: "success",
  },
  [EventTypes.CRM_PIPELINE_UPDATED]: {
    invalidates: [crmKeys.pipelines()],
    notify: false,
  },
  [EventTypes.CRM_PIPELINE_DELETED]: {
    invalidates: [crmKeys.pipelines(), crmKeys.clients()],
    notify: true,
    notifyMessage: "Pipeline deleted",
    notifyVariant: "info",
  },
  [EventTypes.CRM_PIPELINE_DEFAULT_SET]: {
    invalidates: [crmKeys.pipelines()],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM CLIENT EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_FIELD_UPDATED]: {
    invalidates: [crmKeys.clients()],
    notify: false,
  },
  [EventTypes.CRM_MESSAGE_SENT]: {
    invalidates: [],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TAG EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.TAG_ADDED]: {
    invalidates: [tagKeys.all, crmKeys.clients()],
    notify: false,
  },
  [EventTypes.TAG_REMOVED]: {
    invalidates: [tagKeys.all, crmKeys.clients()],
    notify: false,
  },
  [EventTypes.TAG_DEFINITION_CREATED]: {
    invalidates: [tagKeys.global()],
    notify: true,
    notifyMessage: "Tag created",
    notifyVariant: "success",
  },
  [EventTypes.TAG_DEFINITION_UPDATED]: {
    invalidates: [tagKeys.global()],
    notify: false,
  },
  [EventTypes.TAG_DEFINITION_DELETED]: {
    invalidates: [tagKeys.global()],
    notify: true,
    notifyMessage: "Tag deleted",
    notifyVariant: "info",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VARIABLE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.VARIABLE_CHANGED]: {
    invalidates: [variableKeys.all],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // JOURNEY LIFECYCLE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.JOURNEY_CREATED]: {
    invalidates: [journeyKeys.list()],
    notify: true,
    notifyMessage: "Journey created",
    notifyVariant: "success",
  },
  [EventTypes.JOURNEY_UPDATED]: {
    invalidates: [journeyKeys.list()],
    notify: false,
  },
  [EventTypes.JOURNEY_DELETED]: {
    invalidates: [journeyKeys.list()],
    notify: true,
    notifyMessage: "Journey deleted",
    notifyVariant: "info",
  },
  [EventTypes.JOURNEY_ACTIVATED]: {
    invalidates: [journeyKeys.list()],
    notify: true,
    notifyMessage: "Journey activated",
    notifyVariant: "success",
  },
  [EventTypes.JOURNEY_DEACTIVATED]: {
    invalidates: [journeyKeys.list()],
    notify: true,
    notifyMessage: "Journey deactivated",
    notifyVariant: "info",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // JOURNEY SESSION EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.JOURNEY_SESSION_STARTED]: {
    invalidates: [sessionKeys.all],
    notify: false,
  },
  [EventTypes.JOURNEY_SESSION_COMPLETED]: {
    invalidates: [sessionKeys.all],
    notify: false,
  },
  [EventTypes.JOURNEY_SCHEDULE_FIRED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.JOURNEY_WEBHOOK_RECEIVED]: {
    invalidates: [],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INTERACTION EVENTS (all update event logs)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.USER_MESSAGE]: {
    invalidates: [eventKeys.list()],
    notify: false,
  },
  [EventTypes.USER_CLICK]: {
    invalidates: [eventKeys.list()],
    notify: false,
  },
  [EventTypes.ENGINE_MESSAGE]: {
    invalidates: [eventKeys.list()],
    notify: false,
  },
  [EventTypes.ENGINE_TRANSITION]: {
    invalidates: [eventKeys.list()],
    notify: false,
  },
  [EventTypes.TIMER_EXPIRED]: {
    invalidates: [eventKeys.list()],
    notify: false,
  },
  [EventTypes.ENGINE_ERROR]: {
    invalidates: [eventKeys.list()],
    notify: false, // Internal engine errors should not show toasts to dashboard users
  },
  [EventTypes.SESSION_TAGS]: {
    invalidates: [eventKeys.list(), tagKeys.all],
    notify: false,
  },
  [EventTypes.SESSION_VARIABLES]: {
    invalidates: [eventKeys.list(), variableKeys.all],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TIMER EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.TIMER_FOLLOWUP]: {
    invalidates: [eventKeys.list()],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // JOURNEY ENGINE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.JOURNEY_TELEPORT]: {
    invalidates: [eventKeys.list()],
    notify: false,
  },
  [EventTypes.JOURNEY_CRM]: {
    invalidates: [eventKeys.list(), crmKeys.clients()],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MINDSTATE & LLM EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.MINDSTATE_UPDATED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.LLM_HITL]: {
    invalidates: [],
    notify: false, // Human-in-the-loop events - UI handles separately
  },
  [EventTypes.LLM_GUARD_BLOCKED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.LLM_GUARD_FALLBACK]: {
    invalidates: [],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM ACTION EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_ACTION_EXECUTED]: {
    invalidates: [crmKeys.clients()],
    notify: false,
  },
  [EventTypes.CRM_ACTION_FAILED]: {
    invalidates: [],
    notify: false, // Errors logged but not shown as toast
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOW EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.WORKFLOW_STARTED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_COMPLETED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_ERROR]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_STEP_STARTED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_STEP_COMPLETED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_STEP_ERROR]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_PAUSED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_RESUMED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_APPROVAL_REQUESTED]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_APPROVAL_RESPONSE]: {
    invalidates: [],
    notify: false,
  },
  [EventTypes.WORKFLOW_GUARD_BLOCKED]: {
    invalidates: [],
    notify: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MINDSTATE DEFINITION EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.MINDSTATE_DEFINITION_CREATED]: {
    invalidates: [mindstateKeys.definitions()],
    notify: true,
    notifyMessage: "Mindstate definition created",
    notifyVariant: "success",
  },
  [EventTypes.MINDSTATE_DEFINITION_UPDATED]: {
    invalidates: [mindstateKeys.definitions()],
    notify: false, // Silent update (same as journeys)
  },
  [EventTypes.MINDSTATE_DEFINITION_DELETED]: {
    invalidates: [mindstateKeys.definitions()],
    notify: true,
    notifyMessage: "Mindstate definition deleted",
    notifyVariant: "info",
  },

  // Note: SYSTEM_* events are defined as constants but not registered in the
  // backend EVENT_REGISTRY (they're UI display aliases). If these events need
  // frontend handling, they should be added to the backend registry in
  // packages/schemas/src/events/registry.ts first.
};

/**
 * Get configuration for a specific event type
 */
export function getEventConfig(eventType: string): FrontendEventConfig | undefined {
  return FRONTEND_EVENT_REGISTRY[eventType as EventType];
}
