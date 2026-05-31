/**
 * Event Registry
 *
 * Central registry of all event types in the system.
 * Defines event metadata, payload schemas, and consumer routing.
 *
 * ## Architecture
 *
 * The event system is split across three files:
 * - **event-types.ts**: Type-safe constants (e.g., `EventTypes.BOT_CREATED` → `"bot.created"`)
 * - **payloads/*.ts**: Zod schemas for each event's payload structure
 * - **registry.ts** (this file): Merges both into `EVENT_REGISTRY` with metadata
 *
 * TypeScript's `satisfies` clause ensures type safety - if an event type is missing
 * from the registry or has the wrong payload schema, the build will fail.
 *
 * ## Adding New Events
 *
 * 1. Add the event type constant to `event-types.ts`
 * 2. Create the payload schema in `payloads/*.ts`
 * 3. Add the registry entry here with category, consumers, level, etc.
 *
 * @module schemas/events/registry
 */

import { z } from "zod";
import type { EventCategory, EventConsumer, EventLogLevel } from "./core";
import { EventTypes } from "./event-types";
import {
  // Bot payloads
  BotCreatedPayloadSchema,
  BotUpdatedPayloadSchema,
  BotDeletedPayloadSchema,
  BotActivatedPayloadSchema,
  BotDeactivatedPayloadSchema,
  BotWebhookRegisteredPayloadSchema,
  // CRM payloads
  CrmStageChangedPayloadSchema,
  CrmStageCreatedPayloadSchema,
  CrmStageUpdatedPayloadSchema,
  CrmStageDeletedPayloadSchema,
  CrmStagesReorderedPayloadSchema,
  CrmPipelineEnteredPayloadSchema,
  CrmPipelineExitedPayloadSchema,
  CrmPipelineCreatedPayloadSchema,
  CrmPipelineUpdatedPayloadSchema,
  CrmPipelineDeletedPayloadSchema,
  CrmPipelineDefaultSetPayloadSchema,
  CrmFieldUpdatedPayloadSchema,
  CrmMessageSentPayloadSchema,
  CrmActionExecutedPayloadSchema,
  CrmActionFailedPayloadSchema,
  // Note: CrmTagAddedPayloadSchema and CrmTagRemovedPayloadSchema are defined in crm.ts
  // but the registry uses TagAddedPayloadSchema/TagRemovedPayloadSchema with source field
  // Tag payloads
  TagAddedPayloadSchema,
  TagRemovedPayloadSchema,
  // Tag definition payloads
  TagDefinitionCreatedPayloadSchema,
  TagDefinitionUpdatedPayloadSchema,
  TagDefinitionDeletedPayloadSchema,
  // Variable payloads
  VariableChangedPayloadSchema,
  // Journey payloads
  JourneyCreatedPayloadSchema,
  JourneyUpdatedPayloadSchema,
  JourneyDeletedPayloadSchema,
  JourneyActivatedPayloadSchema,
  JourneyDeactivatedPayloadSchema,
  JourneySessionStartedPayloadSchema,
  JourneySessionCompletedPayloadSchema,
  JourneyScheduleFiredPayloadSchema,
  JourneyWebhookReceivedPayloadSchema,
  // Interaction payloads
  UserMessagePayloadSchema,
  UserClickPayloadSchema,
  SystemMessagePayloadSchema,
  SystemTransitionPayloadSchema,
  SystemTimeoutPayloadSchema,
  SystemErrorPayloadSchema,
  SystemTagsPayloadSchema,
  SystemVariablesPayloadSchema,
  SystemTeleportPayloadSchema,
  SystemMindstatePayloadSchema,
  SystemCrmPayloadSchema,
  SystemFollowupPayloadSchema,
  SystemHitlPayloadSchema,
  SystemGuardBlockedPayloadSchema,
  SystemGuardFallbackPayloadSchema,
  // Workflow payloads
  WorkflowStartedPayloadSchema,
  WorkflowCompletedPayloadSchema,
  WorkflowErrorPayloadSchema,
  WorkflowStepStartedPayloadSchema,
  WorkflowStepCompletedPayloadSchema,
  WorkflowStepErrorPayloadSchema,
  WorkflowPausedPayloadSchema,
  WorkflowResumedPayloadSchema,
  WorkflowApprovalRequestedPayloadSchema,
  WorkflowApprovalResponsePayloadSchema,
  WorkflowGuardBlockedPayloadSchema,
  // Mindstate payloads
  MindstateDefinitionCreatedPayloadSchema,
  MindstateDefinitionUpdatedPayloadSchema,
  MindstateDefinitionDeletedPayloadSchema,
} from "./payloads";

// =============================================================================
// REGISTRY ENTRY TYPE
// =============================================================================

/**
 * Context type for event publishing
 * - 'org': Organization-level events (pipelines, stages CRUD)
 * - 'client': Client-specific events (stage changes, tag assignments)
 * - 'session': Session-specific events (interactions, transitions)
 */
export type EventContextType = "org" | "client" | "session";

export interface EventRegistryEntry {
  category: EventCategory;
  description: string;
  consumers: EventConsumer[];
  level: EventLogLevel;
  payloadSchema: z.ZodType;
  /** Context type for publisher factory */
  contextType: EventContextType;
  /** Schema version for future evolution */
  version: number;
}

// =============================================================================
// EVENT REGISTRY
// =============================================================================

/**
 * Central registry of all event types
 *
 * Each entry defines:
 * - category: For grouping events
 * - description: Human-readable description
 * - consumers: Which consumers should receive this event
 * - level: Log level for UI display
 * - payloadSchema: Zod schema for payload validation
 */
export const EVENT_REGISTRY = {
  // ─────────────────────────────────────────────────────────────────────────
  // BOT LIFECYCLE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.BOT_CREATED]: {
    category: "bot",
    description: "New bot registered",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: BotCreatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.BOT_UPDATED]: {
    category: "bot",
    description: "Bot configuration updated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: BotUpdatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.BOT_DELETED]: {
    category: "bot",
    description: "Bot deleted",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: BotDeletedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.BOT_ACTIVATED]: {
    category: "bot",
    description: "Bot activated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: BotActivatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.BOT_DEACTIVATED]: {
    category: "bot",
    description: "Bot deactivated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: BotDeactivatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.BOT_WEBHOOK_REGISTERED]: {
    category: "bot",
    description: "Bot webhook registered",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: BotWebhookRegisteredPayloadSchema,
    contextType: "org",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM STAGE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_STAGE_CHANGED]: {
    category: "crm",
    description: "Client moved to a different stage",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: CrmStageChangedPayloadSchema,
    contextType: "client",
    version: 1,
  },
  [EventTypes.CRM_STAGE_CREATED]: {
    category: "crm",
    description: "New stage created in pipeline",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmStageCreatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.CRM_STAGE_UPDATED]: {
    category: "crm",
    description: "Stage configuration updated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmStageUpdatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.CRM_STAGE_DELETED]: {
    category: "crm",
    description: "Stage deleted from pipeline",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmStageDeletedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.CRM_STAGES_REORDERED]: {
    category: "crm",
    description: "Stages reordered in pipeline",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmStagesReorderedPayloadSchema,
    contextType: "org",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM PIPELINE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_PIPELINE_ENTERED]: {
    category: "crm",
    description: "Client entered a pipeline",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: CrmPipelineEnteredPayloadSchema,
    contextType: "client",
    version: 1,
  },
  [EventTypes.CRM_PIPELINE_EXITED]: {
    category: "crm",
    description: "Client exited a pipeline",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmPipelineExitedPayloadSchema,
    contextType: "client",
    version: 1,
  },
  [EventTypes.CRM_PIPELINE_CREATED]: {
    category: "crm",
    description: "New pipeline created",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmPipelineCreatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.CRM_PIPELINE_UPDATED]: {
    category: "crm",
    description: "Pipeline configuration updated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmPipelineUpdatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.CRM_PIPELINE_DELETED]: {
    category: "crm",
    description: "Pipeline deleted",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmPipelineDeletedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.CRM_PIPELINE_DEFAULT_SET]: {
    category: "crm",
    description: "Default pipeline changed",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmPipelineDefaultSetPayloadSchema,
    contextType: "org",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM FIELD EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_FIELD_UPDATED]: {
    category: "crm",
    description: "Custom field value changed",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: CrmFieldUpdatedPayloadSchema,
    contextType: "client",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM MESSAGE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_MESSAGE_SENT]: {
    category: "crm",
    description: "Direct message sent to client",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmMessageSentPayloadSchema,
    contextType: "client",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM ACTION FEEDBACK EVENTS (workflow/journey-triggered operations)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.CRM_ACTION_EXECUTED]: {
    category: "crm",
    description: "CRM action executed successfully from workflow/journey",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: CrmActionExecutedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.CRM_ACTION_FAILED]: {
    category: "crm",
    description: "CRM action failed from workflow/journey",
    consumers: ["sse", "log"],
    level: "error",
    payloadSchema: CrmActionFailedPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TAG EVENTS
  // Note: crm.tag.* events removed - use tag.added/tag.removed instead
  // The source field indicates origin (journey, crm, manual)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.TAG_ADDED]: {
    category: "tag",
    description: "Tag added to client",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: TagAddedPayloadSchema,
    contextType: "client",
    version: 1,
  },
  [EventTypes.TAG_REMOVED]: {
    category: "tag",
    description: "Tag removed from client",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: TagRemovedPayloadSchema,
    contextType: "client",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TAG DEFINITION EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.TAG_DEFINITION_CREATED]: {
    category: "tag",
    description: "New tag definition created",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: TagDefinitionCreatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.TAG_DEFINITION_UPDATED]: {
    category: "tag",
    description: "Tag definition updated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: TagDefinitionUpdatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.TAG_DEFINITION_DELETED]: {
    category: "tag",
    description: "Tag definition deleted",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: TagDefinitionDeletedPayloadSchema,
    contextType: "org",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VARIABLE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.VARIABLE_CHANGED]: {
    category: "variable",
    description: "Variable value changed",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: VariableChangedPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // JOURNEY LIFECYCLE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.JOURNEY_CREATED]: {
    category: "journey",
    description: "New journey created",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: JourneyCreatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.JOURNEY_UPDATED]: {
    category: "journey",
    description: "Journey configuration updated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: JourneyUpdatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.JOURNEY_DELETED]: {
    category: "journey",
    description: "Journey deleted",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: JourneyDeletedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.JOURNEY_ACTIVATED]: {
    category: "journey",
    description: "Journey activated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: JourneyActivatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.JOURNEY_DEACTIVATED]: {
    category: "journey",
    description: "Journey deactivated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: JourneyDeactivatedPayloadSchema,
    contextType: "org",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // JOURNEY SESSION EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.JOURNEY_SESSION_STARTED]: {
    category: "journey",
    description: "Journey session started",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: JourneySessionStartedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.JOURNEY_SESSION_COMPLETED]: {
    category: "journey",
    description: "Journey session completed",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: JourneySessionCompletedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.JOURNEY_SCHEDULE_FIRED]: {
    category: "journey",
    description: "Scheduled journey trigger fired",
    consumers: ["automation"],
    level: "info",
    payloadSchema: JourneyScheduleFiredPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.JOURNEY_WEBHOOK_RECEIVED]: {
    category: "journey",
    description: "External webhook received",
    consumers: ["automation"],
    level: "info",
    payloadSchema: JourneyWebhookReceivedPayloadSchema,
    contextType: "org",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // USER EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.USER_MESSAGE]: {
    category: "interaction",
    description: "User sent a text message",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: UserMessagePayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.USER_CLICK]: {
    category: "interaction",
    description: "User clicked a button",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: UserClickPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENGINE EVENTS (Journey engine operations)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.ENGINE_MESSAGE]: {
    category: "interaction",
    description: "Engine sent a message to user",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemMessagePayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.ENGINE_TRANSITION]: {
    category: "interaction",
    description: "Engine moved user to a different node",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemTransitionPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.ENGINE_ERROR]: {
    category: "interaction",
    description: "Error occurred during engine execution",
    consumers: ["sse", "log"],
    level: "error",
    payloadSchema: SystemErrorPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION EVENTS (Session state changes)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.SESSION_TAGS]: {
    category: "interaction",
    description: "Session tags modified",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemTagsPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.SESSION_VARIABLES]: {
    category: "interaction",
    description: "Session variables modified",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemVariablesPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TIMER EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.TIMER_EXPIRED]: {
    category: "interaction",
    description: "Timer/timeout expired",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemTimeoutPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.TIMER_FOLLOWUP]: {
    category: "interaction",
    description: "Follow-up timer fired (also questionnaire reminders)",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemFollowupPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // JOURNEY OPERATION EVENTS (In-journey actions)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.JOURNEY_TELEPORT]: {
    category: "interaction",
    description: "User teleported to another journey",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemTeleportPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.JOURNEY_CRM]: {
    category: "interaction",
    description: "CRM action executed in journey",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: SystemCrmPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MINDSTATE EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.MINDSTATE_UPDATED]: {
    category: "interaction",
    description: "Mindstate parameters updated",
    consumers: ["log"],
    level: "info",
    payloadSchema: SystemMindstatePayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LLM EVENTS (LLM-specific operations)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.LLM_HITL]: {
    category: "interaction",
    description: "HITL decision made on LLM tool call",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: SystemHitlPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.LLM_GUARD_BLOCKED]: {
    category: "interaction",
    description: "LLM guard condition blocked edge transition",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: SystemGuardBlockedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.LLM_GUARD_FALLBACK]: {
    category: "interaction",
    description: "Fallback edge used after all guards failed",
    consumers: ["sse", "automation", "log"],
    level: "info",
    payloadSchema: SystemGuardFallbackPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOW EVENTS (Agent Workflow Execution)
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.WORKFLOW_STARTED]: {
    category: "workflow",
    description: "Workflow execution started",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowStartedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_COMPLETED]: {
    category: "workflow",
    description: "Workflow execution completed successfully",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowCompletedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_ERROR]: {
    category: "workflow",
    description: "Workflow execution failed with error",
    consumers: ["sse", "log"],
    level: "error",
    payloadSchema: WorkflowErrorPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_STEP_STARTED]: {
    category: "workflow",
    description: "Workflow step execution started",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowStepStartedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_STEP_COMPLETED]: {
    category: "workflow",
    description: "Workflow step execution completed",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowStepCompletedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_STEP_ERROR]: {
    category: "workflow",
    description: "Workflow step execution failed",
    consumers: ["sse", "log"],
    level: "error",
    payloadSchema: WorkflowStepErrorPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_PAUSED]: {
    category: "workflow",
    description: "Workflow execution paused",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowPausedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_RESUMED]: {
    category: "workflow",
    description: "Workflow execution resumed",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowResumedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_APPROVAL_REQUESTED]: {
    category: "workflow",
    description: "Workflow approval requested from user",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowApprovalRequestedPayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_APPROVAL_RESPONSE]: {
    category: "workflow",
    description: "User responded to workflow approval request",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: WorkflowApprovalResponsePayloadSchema,
    contextType: "session",
    version: 1,
  },
  [EventTypes.WORKFLOW_GUARD_BLOCKED]: {
    category: "workflow",
    description: "Workflow guard blocked execution",
    consumers: ["sse", "log"],
    level: "warn",
    payloadSchema: WorkflowGuardBlockedPayloadSchema,
    contextType: "session",
    version: 1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MINDSTATE DEFINITION EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  [EventTypes.MINDSTATE_DEFINITION_CREATED]: {
    category: "mindstate",
    description: "Mindstate definition created",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: MindstateDefinitionCreatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.MINDSTATE_DEFINITION_UPDATED]: {
    category: "mindstate",
    description: "Mindstate definition updated",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: MindstateDefinitionUpdatedPayloadSchema,
    contextType: "org",
    version: 1,
  },
  [EventTypes.MINDSTATE_DEFINITION_DELETED]: {
    category: "mindstate",
    description: "Mindstate definition deleted",
    consumers: ["sse", "log"],
    level: "info",
    payloadSchema: MindstateDefinitionDeletedPayloadSchema,
    contextType: "org",
    version: 1,
  },
} satisfies Record<string, EventRegistryEntry>;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * All registered event types as a union type for type safety
 */
export type EventType = keyof typeof EVENT_REGISTRY;

/**
 * Get registry entry for an event type
 */
export function getEventRegistration(eventType: string): EventRegistryEntry | undefined {
  return EVENT_REGISTRY[eventType as EventType];
}
