/**
 * Workflow Event Emitter
 *
 * Unified workflow event emitter used by both:
 * - Journey execution (session-engine-factory)
 * - Workflow test endpoint (routes/workflows.ts)
 *
 * Consolidates duplicated event mapping logic into a single source.
 *
 * @module modules/workflows/services/event-emitter
 */

import { createLogger, serializeError } from "@journey/logger";
import {
  EventTypes,
  WorkflowEventTypes,
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
  type WorkflowEventEmitterFn,
  type WorkflowEventPayload,
  type WorkflowEmitterContext,
  type BaseEvent,
  type WorkflowStartedPayload,
  type WorkflowCompletedPayload,
  type WorkflowErrorPayload,
  type WorkflowStepStartedPayload,
  type WorkflowStepCompletedPayload,
  type WorkflowStepErrorPayload,
  type WorkflowPausedPayload,
  type WorkflowResumedPayload,
  type WorkflowApprovalRequestedPayload,
  type WorkflowApprovalResponsePayload,
  type WorkflowGuardBlockedPayload,
} from "@journey/schemas";

import { createEvent, publishEvent } from "../../../event-bus/event-bus";
import type { ContextForEvent } from "../../../event-bus/publisher-factory";
import type { IEventPublisher } from "../../../services/interfaces";

const log = createLogger("workflow-event-emitter");

type WorkflowPublisherContext = ContextForEvent<typeof EventTypes.WORKFLOW_STARTED>;

type WorkflowPublisherFn<T> = (ctx: WorkflowPublisherContext, data: T) => Promise<void>;

function isNonEmptyString(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasFullSessionContext(
  ctx: WorkflowEmitterContext
): ctx is WorkflowEmitterContext & { sessionId: string; clientId: string; journeyId: string } {
  return (
    isNonEmptyString(ctx.sessionId) &&
    isNonEmptyString(ctx.clientId) &&
    isNonEmptyString(ctx.journeyId)
  );
}

function enrichPayload(
  payload: Record<string, unknown>,
  ctx: WorkflowEmitterContext
): Record<string, unknown> {
  if (!ctx.workflowKey) return payload;
  return { ...payload, workflowKey: ctx.workflowKey };
}

function parsePayload<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: unknown } },
  payload: Record<string, unknown>,
  eventType: string
): T | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    log.warn({ eventType, issues: "validation_failed" }, "workflowEmitter:payloadInvalid");
    return null;
  }
  return result.data;
}

async function publishWorkflowEvent<T>(
  ctx: WorkflowEmitterContext,
  publisher: IEventPublisher,
  eventType: string,
  payload: T,
  publishFn: WorkflowPublisherFn<T>
): Promise<void> {
  if (hasFullSessionContext(ctx)) {
    const sessionCtx: WorkflowPublisherContext = {
      organizationId: ctx.organizationId,
      clientId: ctx.clientId,
      sessionId: ctx.sessionId,
      journeyId: ctx.journeyId,
      performedBy: ctx.performedBy,
      triggeredBy: ctx.triggeredBy,
    };

    await publishFn(sessionCtx, payload);
    return;
  }

  const options: Partial<BaseEvent> = {
    performedBy: ctx.performedBy,
    source: ctx.triggeredBy,
  };

  if (isNonEmptyString(ctx.sessionId)) {
    options.sessionId = ctx.sessionId;
  }
  if (isNonEmptyString(ctx.clientId)) {
    options.clientId = ctx.clientId;
  }
  if (isNonEmptyString(ctx.journeyId)) {
    options.journeyId = ctx.journeyId;
  }

  const event = await createEvent(eventType, ctx.organizationId, payload, options);
  await publishEvent(event);
}

/**
 * Create a workflow event emitter that publishes to the event bus.
 *
 * This function handles the mapping from WorkflowEventTypes to the appropriate
 * publisher methods. Events are emitted non-blocking to avoid slowing down
 * workflow execution.
 */
export function createWorkflowEmitter(
  ctx: WorkflowEmitterContext,
  publisher: IEventPublisher
): WorkflowEventEmitterFn {
  return (event: WorkflowEventPayload): void => {
    const enrichedPayload = enrichPayload(event.payload, ctx);

    void (async () => {
      try {
        switch (event.type) {
          case WorkflowEventTypes.WORKFLOW_STARTED: {
            const parsed = parsePayload<WorkflowStartedPayload>(
              WorkflowStartedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.started);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_COMPLETED: {
            const parsed = parsePayload<WorkflowCompletedPayload>(
              WorkflowCompletedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.completed);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_ERROR: {
            const parsed = parsePayload<WorkflowErrorPayload>(
              WorkflowErrorPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.error);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_STEP_STARTED: {
            const parsed = parsePayload<WorkflowStepStartedPayload>(
              WorkflowStepStartedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.stepStarted);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_STEP_COMPLETED: {
            const parsed = parsePayload<WorkflowStepCompletedPayload>(
              WorkflowStepCompletedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.stepCompleted);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_STEP_ERROR: {
            const parsed = parsePayload<WorkflowStepErrorPayload>(
              WorkflowStepErrorPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.stepError);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_PAUSED: {
            const parsed = parsePayload<WorkflowPausedPayload>(
              WorkflowPausedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.paused);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_RESUMED: {
            const parsed = parsePayload<WorkflowResumedPayload>(
              WorkflowResumedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.resumed);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_GUARD_BLOCKED: {
            const parsed = parsePayload<WorkflowGuardBlockedPayload>(
              WorkflowGuardBlockedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.guardBlocked);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_APPROVAL_REQUESTED: {
            const parsed = parsePayload<WorkflowApprovalRequestedPayload>(
              WorkflowApprovalRequestedPayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.approvalRequested);
            break;
          }
          case WorkflowEventTypes.WORKFLOW_APPROVAL_RESPONSE: {
            const parsed = parsePayload<WorkflowApprovalResponsePayload>(
              WorkflowApprovalResponsePayloadSchema,
              enrichedPayload,
              event.type
            );
            if (!parsed) return;
            await publishWorkflowEvent(ctx, publisher, event.type, parsed, publisher.workflow.approvalResponse);
            break;
          }
          default:
            log.debug({ eventType: event.type }, "workflowEmitter:unknownType");
        }
      } catch (err) {
        log.warn(
          { eventType: event.type, err: serializeError(err) },
          "workflowEmitter:emitFailed"
        );
      }
    })();
  };
}
