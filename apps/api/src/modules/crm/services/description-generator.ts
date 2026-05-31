/**
 * CRM Activity Description Generator
 *
 * Utility for building human-readable descriptions from CRM events.
 * Used when querying the events table to present activity logs.
 *
 * @module modules/crm/services/description-generator
 */

import { EventTypes, type BaseEvent } from "@journey/schemas";

// =============================================================================
// EVENT TYPE MAPPINGS
// =============================================================================

/** Map event types to activity types */
const EVENT_TO_ACTIVITY_MAP: Record<string, string> = {
  // Stage events
  [EventTypes.CRM_STAGE_CHANGED]: "stage_change",
  [EventTypes.CRM_STAGE_CREATED]: "stage_created",
  [EventTypes.CRM_STAGE_UPDATED]: "stage_updated",
  [EventTypes.CRM_STAGE_DELETED]: "stage_deleted",
  [EventTypes.CRM_STAGES_REORDERED]: "stages_reordered",
  // Pipeline events
  [EventTypes.CRM_PIPELINE_ENTERED]: "pipeline_entered",
  [EventTypes.CRM_PIPELINE_EXITED]: "pipeline_removed",
  [EventTypes.CRM_PIPELINE_CREATED]: "pipeline_created",
  [EventTypes.CRM_PIPELINE_UPDATED]: "pipeline_updated",
  [EventTypes.CRM_PIPELINE_DELETED]: "pipeline_deleted",
  [EventTypes.CRM_PIPELINE_DEFAULT_SET]: "pipeline_default_set",
  // Field and message events
  [EventTypes.CRM_FIELD_UPDATED]: "field_update",
  [EventTypes.CRM_MESSAGE_SENT]: "message_sent",
  // Tag events
  [EventTypes.TAG_ADDED]: "tag_added",
  [EventTypes.TAG_REMOVED]: "tag_removed",
};

/** Reverse map: activity types to event type patterns */
const ACTIVITY_TO_EVENTS_MAP: Record<string, string[]> = {
  stage_change: [EventTypes.CRM_STAGE_CHANGED],
  stage_created: [EventTypes.CRM_STAGE_CREATED],
  stage_updated: [EventTypes.CRM_STAGE_UPDATED],
  stage_deleted: [EventTypes.CRM_STAGE_DELETED],
  stages_reordered: [EventTypes.CRM_STAGES_REORDERED],
  pipeline_entered: [EventTypes.CRM_PIPELINE_ENTERED],
  pipeline_removed: [EventTypes.CRM_PIPELINE_EXITED],
  pipeline_created: [EventTypes.CRM_PIPELINE_CREATED],
  pipeline_updated: [EventTypes.CRM_PIPELINE_UPDATED],
  pipeline_deleted: [EventTypes.CRM_PIPELINE_DELETED],
  pipeline_default_set: [EventTypes.CRM_PIPELINE_DEFAULT_SET],
  field_update: [EventTypes.CRM_FIELD_UPDATED],
  message_sent: [EventTypes.CRM_MESSAGE_SENT],
  tag_added: [EventTypes.TAG_ADDED],
  tag_removed: [EventTypes.TAG_REMOVED],
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Map event type to activity type for display
 */
export function mapEventTypeToActivityType(eventType: string): string {
  return EVENT_TO_ACTIVITY_MAP[eventType] || eventType;
}

/**
 * Map activity types to event types for filtering queries
 * Returns event types that should be included when filtering by these activity types
 */
export function mapActivityTypesToEventTypes(activityTypes: string[]): string[] {
  const eventTypes: string[] = [];
  for (const activityType of activityTypes) {
    const events = ACTIVITY_TO_EVENTS_MAP[activityType];
    if (events) {
      eventTypes.push(...events);
    }
  }
  return eventTypes;
}

/**
 * Get all CRM-related event types
 * Used for querying events table for CRM activities
 */
export function getCrmEventTypes(): string[] {
  return Object.keys(EVENT_TO_ACTIVITY_MAP);
}

/**
 * Check if an event type is a CRM event that should appear in activity logs
 */
export function isCrmEvent(eventType: string): boolean {
  return eventType in EVENT_TO_ACTIVITY_MAP;
}

/**
 * Build a human-readable description for CRM activity
 * Works with both full events and event-like objects with type and payload
 */
export function buildActivityDescription(event: {
  type: string;
  payload: Record<string, unknown>;
}): string {
  const payload = event.payload;

  switch (event.type) {
    case EventTypes.CRM_STAGE_CHANGED: {
      const fromStage = payload.fromStageName as string | null;
      const toStage = payload.toStageName as string;
      const pipeline = payload.pipelineName as string;
      return fromStage
        ? `[${pipeline}] Stage changed from "${fromStage}" to "${toStage}"`
        : `[${pipeline}] Assigned to stage "${toStage}"`;
    }

    case EventTypes.CRM_STAGE_CREATED: {
      const stageName = payload.stageName as string;
      const pipeline = payload.pipelineName as string;
      return `[${pipeline}] Stage "${stageName}" created`;
    }

    case EventTypes.CRM_STAGE_UPDATED: {
      const stageName = payload.stageName as string;
      const pipeline = payload.pipelineName as string;
      return `[${pipeline}] Stage "${stageName}" updated`;
    }

    case EventTypes.CRM_STAGE_DELETED: {
      const stageName = payload.stageName as string;
      const pipeline = payload.pipelineName as string;
      return `[${pipeline}] Stage "${stageName}" deleted`;
    }

    case EventTypes.CRM_STAGES_REORDERED: {
      const pipeline = payload.pipelineName as string;
      return `[${pipeline}] Stages reordered`;
    }

    case EventTypes.CRM_PIPELINE_ENTERED: {
      const pipeline = payload.pipelineName as string;
      const stage = payload.stageName as string;
      return `Entered pipeline "${pipeline}" at stage "${stage}"`;
    }

    case EventTypes.CRM_PIPELINE_EXITED: {
      const pipeline = payload.pipelineName as string;
      const lastStage = payload.lastStageName as string | null;
      return lastStage
        ? `Removed from pipeline "${pipeline}" (was in stage "${lastStage}")`
        : `Removed from pipeline "${pipeline}"`;
    }

    case EventTypes.CRM_PIPELINE_CREATED: {
      const pipeline = payload.pipelineName as string;
      return `Pipeline "${pipeline}" created`;
    }

    case EventTypes.CRM_PIPELINE_UPDATED: {
      const pipeline = payload.pipelineName as string;
      return `Pipeline "${pipeline}" updated`;
    }

    case EventTypes.CRM_PIPELINE_DELETED: {
      const pipeline = payload.pipelineName as string;
      return `Pipeline "${pipeline}" deleted`;
    }

    case EventTypes.CRM_PIPELINE_DEFAULT_SET: {
      const pipeline = payload.pipelineName as string;
      return `Pipeline "${pipeline}" set as default`;
    }

    case EventTypes.CRM_FIELD_UPDATED: {
      const fieldName = payload.fieldName as string;
      return `Updated field "${fieldName}"`;
    }

    case EventTypes.CRM_MESSAGE_SENT: {
      const content = payload.content as string;
      const truncated = content.length > 50 ? `${content.slice(0, 50)}...` : content;
      return `Direct message sent: "${truncated}"`;
    }

    case EventTypes.TAG_ADDED: {
      const tagName = payload.tagName as string;
      return `Tag "${tagName}" added`;
    }

    case EventTypes.TAG_REMOVED: {
      const tagName = payload.tagName as string;
      return `Tag "${tagName}" removed`;
    }

    default:
      return event.type;
  }
}

/**
 * Transform an event from the events table into a CRM activity format
 */
export interface CrmActivityFromEvent {
  id: string;
  clientId: string;
  organizationId: string;
  activityType: string;
  description: string;
  metadata: Record<string, unknown>;
  performedBy: string | null;
  createdAt: Date;
}

export function eventToCrmActivity(event: {
  id: string;
  type: string;
  clientId: string | null;
  organizationId: string;
  payload: Record<string, unknown>;
  performedBy: string | null;
  timestamp: Date;
}): CrmActivityFromEvent | null {
  if (!event.clientId) return null;

  return {
    id: event.id,
    clientId: event.clientId,
    organizationId: event.organizationId,
    activityType: mapEventTypeToActivityType(event.type),
    description: buildActivityDescription({ type: event.type, payload: event.payload }),
    metadata: event.payload,
    performedBy: event.performedBy,
    createdAt: event.timestamp,
  };
}
