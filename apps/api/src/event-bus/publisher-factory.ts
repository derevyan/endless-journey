/**
 * Event Publisher Factory
 *
 * Creates type-safe, consistent publisher functions for all event types.
 * Reduces boilerplate by generating publishers from the event registry.
 *
 * @module events/publisher-factory
 */

import { createLogger } from "@journey/logger";
import {
  EVENT_REGISTRY,
  EventTypes,
  type EventType,
  type EventPayload,
  type EventContextType,
  type EventSource,
  getEventContextType,
  getEventLogContext,
} from "@journey/schemas";

import { createEvent, publishEvent } from "./event-bus";
import {
  safePublishEvent,
  mapTriggerToSource,
  type EventTrigger,
} from "./utils";

const log = createLogger("event-publisher-factory");

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * Base context required for all events
 */
export interface OrgContext {
  organizationId: string;
  performedBy: string;
}

/**
 * Context for client-specific events
 */
export interface ClientContext extends OrgContext {
  clientId: string;
  sessionId?: string;
  journeyId?: string;
  triggeredBy: EventTrigger;
}

/**
 * Context for session-specific events (interactions, transitions)
 */
export interface SessionContext extends ClientContext {
  sessionId: string;
  journeyId: string;
}

/**
 * Map context type to the correct context interface
 */
export type ContextForType<T extends EventContextType> = T extends "org"
  ? OrgContext
  : T extends "client"
    ? ClientContext
    : T extends "session"
      ? SessionContext
      : never;

/**
 * Get the correct context type for an event type
 */
export type ContextForEvent<T extends EventType> = ContextForType<
  (typeof EVENT_REGISTRY)[T]["contextType"]
>;

// =============================================================================
// PAYLOAD DATA TYPES
// =============================================================================

/**
 * Extract payload data (without auto-added fields like triggeredBy, *By)
 * These fields are added automatically from context
 */
type AutoAddedFields =
  | "triggeredBy"
  | "createdBy"
  | "updatedBy"
  | "deletedBy"
  | "assignedBy"
  | "removedBy"
  | "sentBy"
  | "setBy"
  | "reorderedBy"
  | "activatedBy"
  | "deactivatedBy"
  | "registeredBy"
  | "changedBy"
  | "clientId";

export type PayloadDataForEvent<T extends EventType> = Omit<
  EventPayload<T>,
  AutoAddedFields
>;

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a type-safe event publisher for a specific event type
 *
 * @param eventType - The event type to create a publisher for
 * @returns A typed publish function
 *
 * @example
 * const publishStageChanged = createEventPublisher("crm.stage.changed");
 * await publishStageChanged(ctx, { pipelineId: "...", ... });
 */
export function createEventPublisher<T extends EventType>(eventType: T) {
  const registration = EVENT_REGISTRY[eventType];
  const contextType = registration.contextType;
  const logContext = getEventLogContext(eventType);

  return async function publish(
    ctx: ContextForEvent<T>,
    data: PayloadDataForEvent<T>
  ): Promise<void> {
    const payload = buildPayload(eventType, ctx, data);

    await safePublishEvent(
      eventType,
      async () => {
        const event = await createEvent(eventType, ctx.organizationId, payload, {
          clientId: "clientId" in ctx ? ctx.clientId : undefined,
          sessionId: "sessionId" in ctx ? ctx.sessionId : undefined,
          journeyId: "journeyId" in ctx ? ctx.journeyId : undefined,
          performedBy: ctx.performedBy,
          source: getSourceFromContext(ctx, contextType),
        });
        await publishEvent(event);
      },
      logContext
    );

    log.debug(
      buildLogData(eventType, ctx, data),
      `${logContext}:${getEventAction(eventType)}`
    );
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build the full payload including auto-added fields from context
 */
function buildPayload<T extends EventType>(
  eventType: T,
  ctx: ContextForEvent<T>,
  data: PayloadDataForEvent<T>
): EventPayload<T> {
  const contextType = getEventContextType(eventType);
  const payload: Record<string, unknown> = { ...data };

  // Add clientId for client/session events
  if (contextType === "client" || contextType === "session") {
    const clientCtx = ctx as ClientContext;
    payload.clientId = clientCtx.clientId;

    // Add triggeredBy if the payload schema expects it
    if (hasTriggeredBy(eventType)) {
      payload.triggeredBy = clientCtx.triggeredBy;
    }
  }

  // Add *By fields based on event type
  const action = getEventAction(eventType);
  const performer = ctx.performedBy || "system";

  switch (action) {
    case "created":
      payload.createdBy = performer;
      break;
    case "updated":
      payload.updatedBy = performer;
      break;
    case "deleted":
      payload.deletedBy = performer;
      break;
    case "assigned":
      payload.assignedBy = performer;
      break;
    case "removed":
      payload.removedBy = performer;
      break;
    case "sent":
      payload.sentBy = performer;
      break;
    case "default_set":
      payload.setBy = performer;
      break;
    case "reordered":
      payload.reorderedBy = performer;
      break;
    case "activated":
      payload.activatedBy = performer;
      break;
    case "deactivated":
      payload.deactivatedBy = performer;
      break;
    case "registered":
      payload.registeredBy = performer;
      break;
    case "changed":
      payload.changedBy = performer;
      break;
    default:
      // Log warning for unknown action types to catch missing implementations
      if (action) {
        log.debug({ action, eventType }, "publisher-factory:unknownAction");
      }
  }

  return payload as EventPayload<T>;
}

/**
 * Get event source from context
 */
function getSourceFromContext(
  ctx: OrgContext | ClientContext | SessionContext,
  contextType: EventContextType
): EventSource {
  if (contextType === "org") {
    return "manual";
  }
  const clientCtx = ctx as ClientContext;
  return mapTriggerToSource(clientCtx.triggeredBy);
}

/**
 * Extract the action from an event type
 * e.g., "crm.stage.changed" -> "changed"
 */
function getEventAction(eventType: EventType): string {
  const parts = eventType.split(".");
  return parts[parts.length - 1];
}

/**
 * Check if event type expects triggeredBy in payload
 */
function hasTriggeredBy(eventType: EventType): boolean {
  const eventsWithTriggeredBy: EventType[] = [
    EventTypes.CRM_STAGE_CHANGED,
    EventTypes.CRM_PIPELINE_ENTERED,
    EventTypes.CRM_PIPELINE_EXITED,
  ];
  return eventsWithTriggeredBy.includes(eventType);
}

/**
 * Build log data for debugging
 */
function buildLogData<T extends EventType>(
  eventType: T,
  ctx: ContextForEvent<T>,
  data: PayloadDataForEvent<T>
): Record<string, unknown> {
  const logData: Record<string, unknown> = {};

  // Add clientId if available
  if ("clientId" in ctx) {
    logData.clientId = ctx.clientId;
  }

  // Add key identifiers from data
  const dataObj = data as Record<string, unknown>;
  const keyFields = [
    "pipelineId",
    "stageId",
    "tagId",
    "tagName",
    "botId",
    "journeyId",
    "variableName",
    "fieldKey",
    "messageId",
  ];

  for (const field of keyFields) {
    if (field in dataObj) {
      logData[field] = dataObj[field];
    }
  }

  return logData;
}

// =============================================================================
// BATCH PUBLISHER
// =============================================================================

/**
 * Create a batch publisher for multiple events of the same type
 */
export function createBatchPublisher<T extends EventType>(eventType: T) {
  const publisher = createEventPublisher(eventType);

  return async function publishBatch(
    items: Array<{
      ctx: ContextForEvent<T>;
      data: PayloadDataForEvent<T>;
    }>
  ): Promise<void> {
    await Promise.allSettled(
      items.map(({ ctx, data }) => publisher(ctx, data))
    );
  };
}
