/**
 * CRM Action Feedback Events
 *
 * Emits feedback events when CRM actions are executed or fail
 * from workflow/journey contexts.
 *
 * @module modules/crm/services/action-feedback
 */

import type { CrmActionType, CrmActionExecutedPayload, CrmActionFailedPayload } from "@journey/schemas";
import type { SessionContext } from "../../../event-bus/publisher-factory";
import type { IEventPublisher } from "../../../services/interfaces";
import type { CrmSessionContext } from "./engine-adapter";

/**
 * Parameters for emitting action feedback events
 */
export interface ActionFeedbackParams {
  /** Session context with tracing information */
  context: CrmSessionContext;
  /** Type of CRM action being performed */
  actionType: CrmActionType;
  /** Pipeline ID (if applicable) */
  pipelineId: string | null;
  /** Pipeline name (if applicable) */
  pipelineName?: string | null;
  /** Stage ID (if applicable) */
  stageId: string | null;
  /** Stage name (if applicable) */
  stageName?: string | null;
  /** Start time in milliseconds for duration calculation */
  startTime: number;
}

/**
 * Build publisher context from CRM session context
 */
function buildPublisherContext(crmContext: CrmSessionContext): SessionContext {
  return {
    organizationId: crmContext.organizationId,
    clientId: crmContext.clientId,
    sessionId: crmContext.sessionId,
    journeyId: crmContext.journeyId,
    triggeredBy: "journey",
    performedBy: "system",
  };
}

/**
 * Result of a successful CRM action
 */
export interface ActionResult {
  result: "created" | "updated" | "removed" | "no_change";
}

/**
 * Failure details for a failed CRM action
 */
export interface ActionFailure {
  errorCode: string;
  errorMessage: string;
}

/**
 * Emit a crm.action.executed event
 *
 * @param params - Action feedback parameters
 * @param result - Result of the action
 */
export async function emitActionExecuted(
  publisher: IEventPublisher,
  params: ActionFeedbackParams,
  result: ActionResult
): Promise<void> {
  // Skip if no nodeId (can't emit without tracing context)
  if (!params.context.nodeId) {
    return;
  }

  const durationMs = Date.now() - params.startTime;
  const publisherContext = buildPublisherContext(params.context);

  const payload: Omit<CrmActionExecutedPayload, "clientId"> = {
    sessionId: params.context.sessionId,
    journeyId: params.context.journeyId,
    nodeId: params.context.nodeId,
    workflowId: params.context.workflowId,
    actionType: params.actionType,
    pipelineId: params.pipelineId,
    pipelineName: params.pipelineName ?? null,
    stageId: params.stageId,
    stageName: params.stageName ?? null,
    result: result.result,
    durationMs,
  };

  await publisher.crm.actionExecuted(publisherContext, payload);
}

/**
 * Emit a crm.action.failed event
 *
 * @param params - Action feedback parameters
 * @param failure - Failure details
 */
export async function emitActionFailed(
  publisher: IEventPublisher,
  params: ActionFeedbackParams,
  failure: ActionFailure
): Promise<void> {
  // Skip if no nodeId (can't emit without tracing context)
  if (!params.context.nodeId) {
    return;
  }

  const durationMs = Date.now() - params.startTime;
  const publisherContext = buildPublisherContext(params.context);

  const payload: Omit<CrmActionFailedPayload, "clientId"> = {
    sessionId: params.context.sessionId,
    journeyId: params.context.journeyId,
    nodeId: params.context.nodeId,
    workflowId: params.context.workflowId,
    actionType: params.actionType,
    pipelineId: params.pipelineId,
    stageId: params.stageId,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    durationMs,
  };

  await publisher.crm.actionFailed(publisherContext, payload);
}
