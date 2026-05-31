/**
 * CRM Activity Service
 *
 * Provides unified activity timeline combining CRM events with journey interactions.
 *
 * @module modules/crm/services/activity-service
 */

import {
  crmDirectMessages,
  events,
  interactions,
  journeySessions,
  journeys,
  user,
} from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { EventTypes } from "@journey/schemas";
import type { ActivityEntry, CrmActivityType, CrmTimelineOptions } from "@journey/schemas";
import { and, eq, desc, inArray } from "drizzle-orm";

import { truncate } from "../../../lib/utils";
import {
  buildActivityDescription,
  getCrmEventTypes,
  mapActivityTypesToEventTypes,
  mapEventTypeToActivityType,
} from "./description-generator";
import type { CrmServiceContext } from "./service-context";

const log = createLogger("crm-activity-service");

// =============================================================================
// TIMELINE QUERIES
// =============================================================================

/**
 * Get unified activity timeline for a client
 * Combines CRM activities, journey interactions, and direct messages
 */
export async function getClientTimeline(
  ctx: CrmServiceContext,
  clientId: string,
  options: CrmTimelineOptions = {}
): Promise<ActivityEntry[]> {
  const { organizationId } = ctx;
  const { limit = 50, offset = 0, types } = options;

  try {
    // Get CRM activities
    const crmActivities = await getCrmActivities(ctx, clientId, types);

    // Get journey interactions
    const journeyInteractions = await getJourneyInteractions(ctx, clientId, types);

    // Get direct messages
    const directMessages = await getDirectMessageActivities(ctx, clientId, types);

    // Combine and sort by date
    const allActivities = [...crmActivities, ...journeyInteractions, ...directMessages];
    allActivities.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA; // Descending
    });

    // Apply pagination
    const paginated = allActivities.slice(offset, offset + limit);

    log.debug(
      { clientId, organizationId, total: allActivities.length, returned: paginated.length },
      "crmActivityService:getClientTimeline"
    );

    return paginated;
  } catch (error) {
    log.error(
      { clientId, organizationId, err: serializeError(error) },
      "crmActivityService:getClientTimeline:error"
    );
    throw error;
  }
}

/**
 * Get CRM activities for a client
 * Queries the events table for CRM-related events and computes descriptions on-read
 */
async function getCrmActivities(
  ctx: CrmServiceContext,
  clientId: string,
  types?: CrmActivityType[]
): Promise<ActivityEntry[]> {
  const { db, organizationId } = ctx;
  // Determine which CRM event types to query
  let eventTypesToQuery: string[];

  if (types && types.length > 0) {
    // Map activity types to event types for filtering
    eventTypesToQuery = mapActivityTypesToEventTypes(types);
    if (eventTypesToQuery.length === 0) {
      return [];
    }
  } else {
    // Query all CRM event types
    eventTypesToQuery = getCrmEventTypes();
  }

  const crmEvents = await db
    .select({
      id: events.id,
      clientId: events.clientId,
      type: events.type,
      payload: events.payload,
      performedBy: events.performedBy,
      performedByName: user.name,
      createdAt: events.createdAt,
    })
    .from(events)
    .leftJoin(user, eq(user.id, events.performedBy))
    .where(
      and(
        eq(events.clientId, clientId),
        eq(events.organizationId, organizationId),
        inArray(events.type, eventTypesToQuery)
      )
    )
    .orderBy(desc(events.createdAt));

  // Filter out events without clientId and transform to ActivityEntry format
  return crmEvents
    .filter((e) => e.clientId !== null)
    .map((e) => ({
      id: e.id,
      clientId: e.clientId!,
      type: mapEventTypeToActivityType(e.type) as CrmActivityType,
      description: buildActivityDescription({
        type: e.type,
        payload: e.payload as Record<string, unknown>,
      }),
      metadata: e.payload as Record<string, unknown> | null,
      performedBy: e.performedBy,
      performedByName: e.performedByName,
      createdAt: e.createdAt,
      source: "crm" as const,
    }));
}

/**
 * Get journey interactions for a client
 */
async function getJourneyInteractions(
  ctx: CrmServiceContext,
  clientId: string,
  types?: CrmActivityType[]
): Promise<ActivityEntry[]> {
  const { db, organizationId } = ctx;
  // Skip if filtering for non-interaction types
  if (types && !types.includes("user_interaction") && !types.includes("journey_started") && !types.includes("journey_completed")) {
    return [];
  }

  // Get sessions for this client in this org
  const sessions = await db
    .select({
      sessionId: journeySessions.id,
      journeyName: journeys.name,
    })
    .from(journeySessions)
    .innerJoin(journeys, eq(journeys.id, journeySessions.journeyId))
    .where(
      and(
        eq(journeySessions.clientId, clientId),
        eq(journeys.organizationId, organizationId)
      )
    );

  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s) => s.sessionId);
  const sessionJourneyMap = new Map(sessions.map((s) => [s.sessionId, s.journeyName]));

  // Get recent interactions
  const recentInteractions = await db
    .select({
      id: interactions.id,
      sessionId: interactions.sessionId,
      type: interactions.type,
      nodeId: interactions.nodeId,
      payload: interactions.payload,
      metadata: interactions.metadata,
      timestamp: interactions.timestamp,
    })
    .from(interactions)
    .where(inArray(interactions.sessionId, sessionIds))
    .orderBy(desc(interactions.timestamp))
    .limit(500); // Reasonable limit for combined timeline (final pagination applied in getClientTimeline)

  return recentInteractions.map((i) => {
    const journeyName = sessionJourneyMap.get(i.sessionId) || "Unknown";
    const description = formatInteractionDescription(i.type, i.payload as Record<string, unknown>, journeyName);

    return {
      id: i.id,
      clientId,
      type: mapInteractionType(i.type),
      description,
      metadata: {
        nodeId: i.nodeId,
        payload: i.payload,
        sessionId: i.sessionId,
        journeyName,
        ...(i.metadata as Record<string, unknown> || {}),
      },
      performedBy: null,
      performedByName: null,
      createdAt: i.timestamp,
      source: "journey" as const,
    };
  });
}

/**
 * Get direct message activities for a client
 */
async function getDirectMessageActivities(
  ctx: CrmServiceContext,
  clientId: string,
  types?: CrmActivityType[]
): Promise<ActivityEntry[]> {
  const { db, organizationId } = ctx;
  if (types && !types.includes("message_sent")) {
    return [];
  }

  const messages = await db
    .select({
      id: crmDirectMessages.id,
      clientId: crmDirectMessages.clientId,
      content: crmDirectMessages.content,
      status: crmDirectMessages.status,
      sentBy: crmDirectMessages.sentBy,
      sentByName: user.name,
      sentAt: crmDirectMessages.sentAt,
    })
    .from(crmDirectMessages)
    .leftJoin(user, eq(user.id, crmDirectMessages.sentBy))
    .where(
      and(
        eq(crmDirectMessages.clientId, clientId),
        eq(crmDirectMessages.organizationId, organizationId)
      )
    )
    .orderBy(desc(crmDirectMessages.sentAt));

  return messages.map((m) => ({
    id: m.id,
    clientId: m.clientId,
    type: "message_sent" as CrmActivityType,
    description: `Direct message sent: "${truncate(m.content, 50)}"`,
    metadata: {
      content: m.content,
      status: m.status,
    },
    performedBy: m.sentBy,
    performedByName: m.sentByName,
    createdAt: m.sentAt,
    source: "message" as const,
  }));
}

// =============================================================================
// HELPERS
// =============================================================================

function mapInteractionType(type: string): CrmActivityType {
  if (type.startsWith("user.")) return "user_interaction";
  if (type === EventTypes.ENGINE_MESSAGE) return "message_sent";
  if (type === EventTypes.JOURNEY_SESSION_STARTED) return "journey_started";
  if (type === EventTypes.JOURNEY_SESSION_COMPLETED) return "journey_completed";
  return "user_interaction";
}

function formatInteractionDescription(
  type: string,
  payload: Record<string, unknown>,
  journeyName: string
): string {
  switch (type) {
    case EventTypes.USER_MESSAGE:
      return `User sent message in "${journeyName}": "${truncate(String(payload?.text || ""), 50)}"`;
    case EventTypes.USER_CLICK:
      return `User clicked button in "${journeyName}": "${payload?.buttonLabel || payload?.buttonId || "button"}"`;
    case EventTypes.ENGINE_MESSAGE:
      return `Bot sent message in "${journeyName}"`;
    case EventTypes.ENGINE_TRANSITION:
      return `Moved to node "${payload?.targetNodeId}" in "${journeyName}"`;
    case EventTypes.JOURNEY_SESSION_STARTED:
      return `Started journey "${journeyName}"`;
    case EventTypes.JOURNEY_SESSION_COMPLETED:
      return `Completed journey "${journeyName}"`;
    default:
      return `${type} in "${journeyName}"`;
  }
}
