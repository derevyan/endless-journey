/**
 * Event Publisher Interface
 *
 * Minimal event publishing surface for API services.
 *
 * @module services/interfaces/event-publisher
 */

import { EventTypes } from "@journey/schemas";
import type { ContextForEvent, PayloadDataForEvent } from "../../event-bus/publisher-factory";

export interface IEventPublisher {
  variable: {
    changed: (
      ctx: ContextForEvent<typeof EventTypes.VARIABLE_CHANGED>,
      data: PayloadDataForEvent<typeof EventTypes.VARIABLE_CHANGED>
    ) => Promise<void>;
  };
  tag: {
    added: (
      ctx: ContextForEvent<typeof EventTypes.TAG_ADDED>,
      data: PayloadDataForEvent<typeof EventTypes.TAG_ADDED>
    ) => Promise<void>;
    removed: (
      ctx: ContextForEvent<typeof EventTypes.TAG_REMOVED>,
      data: PayloadDataForEvent<typeof EventTypes.TAG_REMOVED>
    ) => Promise<void>;
    definitionCreated: (
      ctx: ContextForEvent<typeof EventTypes.TAG_DEFINITION_CREATED>,
      data: PayloadDataForEvent<typeof EventTypes.TAG_DEFINITION_CREATED>
    ) => Promise<void>;
    definitionUpdated: (
      ctx: ContextForEvent<typeof EventTypes.TAG_DEFINITION_UPDATED>,
      data: PayloadDataForEvent<typeof EventTypes.TAG_DEFINITION_UPDATED>
    ) => Promise<void>;
    definitionDeleted: (
      ctx: ContextForEvent<typeof EventTypes.TAG_DEFINITION_DELETED>,
      data: PayloadDataForEvent<typeof EventTypes.TAG_DEFINITION_DELETED>
    ) => Promise<void>;
  };
  crm: {
    stageChanged: (
      ctx: ContextForEvent<typeof EventTypes.CRM_STAGE_CHANGED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_STAGE_CHANGED>
    ) => Promise<void>;
    stageCreated: (
      ctx: ContextForEvent<typeof EventTypes.CRM_STAGE_CREATED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_STAGE_CREATED>
    ) => Promise<void>;
    stageUpdated: (
      ctx: ContextForEvent<typeof EventTypes.CRM_STAGE_UPDATED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_STAGE_UPDATED>
    ) => Promise<void>;
    stageDeleted: (
      ctx: ContextForEvent<typeof EventTypes.CRM_STAGE_DELETED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_STAGE_DELETED>
    ) => Promise<void>;
    stagesReordered: (
      ctx: ContextForEvent<typeof EventTypes.CRM_STAGES_REORDERED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_STAGES_REORDERED>
    ) => Promise<void>;
    pipelineEntered: (
      ctx: ContextForEvent<typeof EventTypes.CRM_PIPELINE_ENTERED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_PIPELINE_ENTERED>
    ) => Promise<void>;
    pipelineExited: (
      ctx: ContextForEvent<typeof EventTypes.CRM_PIPELINE_EXITED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_PIPELINE_EXITED>
    ) => Promise<void>;
    pipelineCreated: (
      ctx: ContextForEvent<typeof EventTypes.CRM_PIPELINE_CREATED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_PIPELINE_CREATED>
    ) => Promise<void>;
    pipelineUpdated: (
      ctx: ContextForEvent<typeof EventTypes.CRM_PIPELINE_UPDATED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_PIPELINE_UPDATED>
    ) => Promise<void>;
    pipelineDeleted: (
      ctx: ContextForEvent<typeof EventTypes.CRM_PIPELINE_DELETED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_PIPELINE_DELETED>
    ) => Promise<void>;
    pipelineDefaultSet: (
      ctx: ContextForEvent<typeof EventTypes.CRM_PIPELINE_DEFAULT_SET>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_PIPELINE_DEFAULT_SET>
    ) => Promise<void>;
    fieldUpdated: (
      ctx: ContextForEvent<typeof EventTypes.CRM_FIELD_UPDATED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_FIELD_UPDATED>
    ) => Promise<void>;
    messageSent: (
      ctx: ContextForEvent<typeof EventTypes.CRM_MESSAGE_SENT>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_MESSAGE_SENT>
    ) => Promise<void>;
    actionExecuted: (
      ctx: ContextForEvent<typeof EventTypes.CRM_ACTION_EXECUTED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_ACTION_EXECUTED>
    ) => Promise<void>;
    actionFailed: (
      ctx: ContextForEvent<typeof EventTypes.CRM_ACTION_FAILED>,
      data: PayloadDataForEvent<typeof EventTypes.CRM_ACTION_FAILED>
    ) => Promise<void>;
  };
  bot: {
    created: (
      ctx: ContextForEvent<typeof EventTypes.BOT_CREATED>,
      data: PayloadDataForEvent<typeof EventTypes.BOT_CREATED>
    ) => Promise<void>;
    updated: (
      ctx: ContextForEvent<typeof EventTypes.BOT_UPDATED>,
      data: PayloadDataForEvent<typeof EventTypes.BOT_UPDATED>
    ) => Promise<void>;
    deleted: (
      ctx: ContextForEvent<typeof EventTypes.BOT_DELETED>,
      data: PayloadDataForEvent<typeof EventTypes.BOT_DELETED>
    ) => Promise<void>;
    activated: (
      ctx: ContextForEvent<typeof EventTypes.BOT_ACTIVATED>,
      data: PayloadDataForEvent<typeof EventTypes.BOT_ACTIVATED>
    ) => Promise<void>;
    deactivated: (
      ctx: ContextForEvent<typeof EventTypes.BOT_DEACTIVATED>,
      data: PayloadDataForEvent<typeof EventTypes.BOT_DEACTIVATED>
    ) => Promise<void>;
    webhookRegistered: (
      ctx: ContextForEvent<typeof EventTypes.BOT_WEBHOOK_REGISTERED>,
      data: PayloadDataForEvent<typeof EventTypes.BOT_WEBHOOK_REGISTERED>
    ) => Promise<void>;
  };
  journey: {
    created: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_CREATED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_CREATED>
    ) => Promise<void>;
    updated: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_UPDATED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_UPDATED>
    ) => Promise<void>;
    deleted: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_DELETED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_DELETED>
    ) => Promise<void>;
    activated: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_ACTIVATED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_ACTIVATED>
    ) => Promise<void>;
    deactivated: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_DEACTIVATED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_DEACTIVATED>
    ) => Promise<void>;
    sessionStarted: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_SESSION_STARTED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_SESSION_STARTED>
    ) => Promise<void>;
    sessionCompleted: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_SESSION_COMPLETED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_SESSION_COMPLETED>
    ) => Promise<void>;
    scheduleFired: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_SCHEDULE_FIRED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_SCHEDULE_FIRED>
    ) => Promise<void>;
    webhookReceived: (
      ctx: ContextForEvent<typeof EventTypes.JOURNEY_WEBHOOK_RECEIVED>,
      data: PayloadDataForEvent<typeof EventTypes.JOURNEY_WEBHOOK_RECEIVED>
    ) => Promise<void>;
  };
  workflow: {
    started: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_STARTED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_STARTED>
    ) => Promise<void>;
    completed: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_COMPLETED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_COMPLETED>
    ) => Promise<void>;
    error: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_ERROR>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_ERROR>
    ) => Promise<void>;
    stepStarted: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_STEP_STARTED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_STEP_STARTED>
    ) => Promise<void>;
    stepCompleted: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_STEP_COMPLETED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_STEP_COMPLETED>
    ) => Promise<void>;
    stepError: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_STEP_ERROR>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_STEP_ERROR>
    ) => Promise<void>;
    paused: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_PAUSED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_PAUSED>
    ) => Promise<void>;
    resumed: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_RESUMED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_RESUMED>
    ) => Promise<void>;
    approvalRequested: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_APPROVAL_REQUESTED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_APPROVAL_REQUESTED>
    ) => Promise<void>;
    approvalResponse: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_APPROVAL_RESPONSE>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_APPROVAL_RESPONSE>
    ) => Promise<void>;
    guardBlocked: (
      ctx: ContextForEvent<typeof EventTypes.WORKFLOW_GUARD_BLOCKED>,
      data: PayloadDataForEvent<typeof EventTypes.WORKFLOW_GUARD_BLOCKED>
    ) => Promise<void>;
  };
  mindstate: {
    definitionCreated: (
      ctx: ContextForEvent<typeof EventTypes.MINDSTATE_DEFINITION_CREATED>,
      data: PayloadDataForEvent<typeof EventTypes.MINDSTATE_DEFINITION_CREATED>
    ) => Promise<void>;
    definitionUpdated: (
      ctx: ContextForEvent<typeof EventTypes.MINDSTATE_DEFINITION_UPDATED>,
      data: PayloadDataForEvent<typeof EventTypes.MINDSTATE_DEFINITION_UPDATED>
    ) => Promise<void>;
    definitionDeleted: (
      ctx: ContextForEvent<typeof EventTypes.MINDSTATE_DEFINITION_DELETED>,
      data: PayloadDataForEvent<typeof EventTypes.MINDSTATE_DEFINITION_DELETED>
    ) => Promise<void>;
  };
}
