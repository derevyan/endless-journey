/**
 * Users Service
 *
 * Data access and aggregation for user list, sessions, and activity timelines.
 *
 * @module modules/users/services/user-service
 */

import { clients, clientTags, interactions, journeys, journeySessions, tagDefinitions } from "@journey/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { EventTypes, NotFoundError, createJourneyIdOrSlug, type JourneyIdOrSlug } from "@journey/schemas";
import type {
  ListUsersParams,
  UserActivityEntry,
  UserActivityEventType,
  UserActivityParams,
  UserListItem,
  UserListResult,
  UserSessionInfo,
} from "@journey/schemas";
import { truncate } from "../../../lib/utils";
import { isRecord } from "../../../lib/type-guards";
import type { UserServiceContext } from "./service-context";

const ACTIVITY_MAX_RESULTS = 200;
const ACTIVITY_MESSAGE_PREVIEW_LIMIT = 35;
const ACTIVITY_INTERACTION_FETCH_LIMIT = 200;

interface InteractionRow {
  id: string;
  sessionId: string;
  type: string;
  nodeId: string;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  timestamp: Date | null;
}

// =============================================================================
// TAG FILTERING
// =============================================================================

function buildUserHasAnyTagCondition(ctx: UserServiceContext, tags: string[]) {
  if (tags.length === 0) {
    return undefined;
  }

  return inArray(
    clients.id,
    ctx.db
      .select({ clientId: clientTags.clientId })
      .from(clientTags)
      .innerJoin(tagDefinitions, eq(tagDefinitions.id, clientTags.tagId))
      .where(inArray(tagDefinitions.name, tags))
  );
}

// =============================================================================
// LIST USERS
// =============================================================================

export async function listOrganizationUsers(
  ctx: UserServiceContext,
  params: ListUsersParams
): Promise<UserListResult> {
  const { organizationId, journeyId, tags, limit, offset } = params;

  let journeyFilterId: string | undefined;
  if (journeyId) {
    let journeyIdOrSlug: JourneyIdOrSlug;
    try {
      journeyIdOrSlug = createJourneyIdOrSlug(journeyId);
    } catch (error) {
      throw new NotFoundError("Journey", journeyId, error);
    }

    const journey = await ctx.journeyService.getJourneyById(journeyIdOrSlug, organizationId);
    if (!journey) {
      throw new NotFoundError("Journey", journeyId);
    }
    journeyFilterId = journey.id;
  }

  const conditions = [eq(journeys.organizationId, organizationId)];
  if (journeyFilterId) {
    conditions.push(eq(journeySessions.journeyId, journeyFilterId));
  }

  const tagCondition = buildUserHasAnyTagCondition(ctx, tags);
  if (tagCondition) {
    conditions.push(tagCondition);
  }

  const usersWithSessions = await ctx.db
    .select({
      id: clients.id,
      platformUserId: clients.platformUserId,
      firstName: clients.firstName,
      lastName: clients.lastName,
      username: clients.username,
      platform: clients.platform,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      sessionCount: sql<number>`count(distinct ${journeySessions.id})::int`,
      lastActiveAt: sql<string>`max(${journeySessions.updatedAt})`,
    })
    .from(clients)
    .innerJoin(journeySessions, eq(journeySessions.clientId, clients.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(and(...conditions))
    .groupBy(clients.id)
    .orderBy(desc(sql`max(${journeySessions.updatedAt})`))
    .limit(limit)
    .offset(offset);

  const userIds = usersWithSessions.map((u) => u.id);
  const userTagsMap = userIds.length > 0 ? await ctx.tagService.getAllTagsForUsers(userIds) : new Map<string, string[]>();

  const users = usersWithSessions.map((user) => ({
    ...user,
    tags: userTagsMap.get(user.id) || [],
  }));

  const countResult = await ctx.db
    .select({
      count: sql<number>`count(distinct ${clients.id})::int`,
    })
    .from(clients)
    .innerJoin(journeySessions, eq(journeySessions.clientId, clients.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(and(...conditions));

  return {
    users,
    total: countResult[0]?.count ?? 0,
  };
}

// =============================================================================
// USER SESSIONS
// =============================================================================

export async function listUserSessions(
  ctx: UserServiceContext,
  organizationId: string,
  clientId: string
): Promise<UserSessionInfo[]> {
  return ctx.db
    .select({
      id: journeySessions.id,
      journeyId: journeySessions.journeyId,
      journeyName: journeys.name,
      currentNodeId: journeySessions.currentNodeId,
      status: journeySessions.status,
      createdAt: journeySessions.createdAt,
      updatedAt: journeySessions.updatedAt,
      completedAt: journeySessions.completedAt,
    })
    .from(journeySessions)
    .innerJoin(journeys, eq(journeys.id, journeySessions.journeyId))
    .where(and(eq(journeySessions.clientId, clientId), eq(journeys.organizationId, organizationId)))
    .orderBy(desc(journeySessions.updatedAt));
}

export async function userHasSessionsInOrg(
  ctx: UserServiceContext,
  organizationId: string,
  clientId: string
): Promise<boolean> {
  const rows = await ctx.db
    .select({ id: journeySessions.id })
    .from(journeySessions)
    .innerJoin(journeys, eq(journeys.id, journeySessions.journeyId))
    .where(and(eq(journeySessions.clientId, clientId), eq(journeys.organizationId, organizationId)))
    .limit(1);

  return rows.length > 0;
}

// =============================================================================
// USER ACTIVITY
// =============================================================================

export async function listUserActivity(
  ctx: UserServiceContext,
  params: UserActivityParams
): Promise<UserActivityEntry[]> {
  const { organizationId, clientId } = params;
  const limit = params.limit ?? ACTIVITY_MAX_RESULTS;
  const offset = params.offset ?? 0;

  const sessions: UserSessionInfo[] = await ctx.db
    .select({
      id: journeySessions.id,
      journeyId: journeySessions.journeyId,
      journeyName: journeys.name,
      currentNodeId: journeySessions.currentNodeId,
      status: journeySessions.status,
      createdAt: journeySessions.createdAt,
      updatedAt: journeySessions.updatedAt,
      completedAt: journeySessions.completedAt,
    })
    .from(journeySessions)
    .innerJoin(journeys, eq(journeys.id, journeySessions.journeyId))
    .where(and(eq(journeySessions.clientId, clientId), eq(journeys.organizationId, organizationId)))
    .orderBy(desc(journeySessions.updatedAt));

  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s) => s.id);

  const rawInteractions = await ctx.db
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
    .limit(ACTIVITY_INTERACTION_FETCH_LIMIT);

  const normalizedInteractions: InteractionRow[] = rawInteractions.map((row) => ({
    ...row,
    payload: isRecord(row.payload) ? row.payload : null,
    metadata: isRecord(row.metadata) ? row.metadata : null,
  }));

  const interactionsBySession = new Map<string, InteractionRow[]>();
  for (const row of normalizedInteractions) {
    const list = interactionsBySession.get(row.sessionId) || [];
    list.push(row);
    interactionsBySession.set(row.sessionId, list);
  }
  for (const list of interactionsBySession.values()) {
    list.sort((a, b) => {
      const aTs = a.timestamp ? a.timestamp.getTime() : 0;
      const bTs = b.timestamp ? b.timestamp.getTime() : 0;
      return aTs - bTs;
    });
  }

  const activityEntries: UserActivityEntry[] = [];
  for (const session of sessions) {
    const sessionInteractions = interactionsBySession.get(session.id) || [];
    activityEntries.push(...buildSessionActivity(session, sessionInteractions, clientId));
  }

  activityEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return activityEntries.slice(offset, offset + limit);
}

// =============================================================================
// ACTIVITY MAPPING
// =============================================================================

function buildSessionActivity(
  session: UserSessionInfo,
  interactionsForSession: InteractionRow[],
  userId: string
): UserActivityEntry[] {
  const entries: UserActivityEntry[] = [];
  const sessionStart = session.createdAt ?? interactionsForSession[0]?.timestamp ?? new Date();

  entries.push(createSessionBoundaryEntry(session, userId, sessionStart, null, "session_started"));

  let previousTimestamp: Date | null = sessionStart;

  for (const interaction of interactionsForSession) {
    const currentTs: Date = interaction.timestamp ?? previousTimestamp ?? sessionStart;
    const delta = previousTimestamp ? Math.max(currentTs.getTime() - previousTimestamp.getTime(), 0) : null;
    entries.push(mapInteractionToActivity(interaction, session, userId, delta));
    previousTimestamp = currentTs;
  }

  const endTimestamp = session.completedAt || session.updatedAt;
  if (endTimestamp) {
    const delta = previousTimestamp ? Math.max(endTimestamp.getTime() - previousTimestamp.getTime(), 0) : null;
    entries.push(createSessionBoundaryEntry(session, userId, endTimestamp, delta, "session_completed"));
  }

  return entries;
}

function createSessionBoundaryEntry(
  session: UserSessionInfo,
  userId: string,
  timestamp: Date,
  timeSincePrevMs: number | null,
  type: Extract<UserActivityEventType, "session_started" | "session_completed">
): UserActivityEntry {
  const isStart = type === "session_started";
  const label = isStart ? "Session started" : "Session ended";
  const description = isStart
    ? `Started journey "${session.journeyName ?? "Unknown Journey"}"`
    : `Session ${session.status ?? "completed"} in "${session.journeyName ?? "Unknown Journey"}"`;

  return {
    id: `${session.id}:${type}`,
    userId,
    sessionId: session.id,
    journeyId: session.journeyId,
    journeyName: session.journeyName ?? "Unknown Journey",
    nodeId: session.currentNodeId || null,
    eventType: type,
    actor: "system",
    title: label,
    description,
    timestamp: timestamp.toISOString(),
    timeSincePrevMs: isStart ? null : timeSincePrevMs,
    rawType: `session.${isStart ? "start" : "end"}`,
    metadata: {
      status: session.status,
    },
  };
}

function mapInteractionToActivity(
  interaction: InteractionRow,
  session: UserSessionInfo,
  userId: string,
  timeSincePrevMs: number | null
): UserActivityEntry {
  const payload = interaction.payload || {};
  const safePayload = sanitizeInteractionPayload(interaction.type, payload);
  const baseTimestamp = interaction.timestamp ?? new Date();

  const base: UserActivityEntry = {
    id: interaction.id,
    userId,
    sessionId: interaction.sessionId,
    journeyId: session.journeyId,
    journeyName: session.journeyName ?? "Unknown Journey",
    nodeId: interaction.nodeId || (typeof payload.nodeId === "string" ? payload.nodeId : null),
    eventType: "system",
    actor: interaction.type.startsWith("user.") ? "user" : "system",
    title: interaction.type,
    description: null,
    timestamp: baseTimestamp.toISOString(),
    timeSincePrevMs,
    rawType: interaction.type,
    payload: safePayload,
    metadata: {
      ...(interaction.metadata || {}),
      sessionStatus: session.status,
    },
  };

  switch (interaction.type) {
    case EventTypes.USER_MESSAGE: {
      const messageText = getPayloadString(payload, "text");
      const preview = messageText ? truncate(messageText, ACTIVITY_MESSAGE_PREVIEW_LIMIT) : null;
      return {
        ...base,
        eventType: "user_message",
        actor: "user",
        title: "User message",
        description: preview,
        metadata: {
          ...base.metadata,
          ...(preview ? { messageText: preview } : {}),
        },
      };
    }
    case EventTypes.USER_CLICK:
      return {
        ...base,
        eventType: "user_click",
        actor: "user",
        title: "Button clicked",
        description: payload.buttonLabel
          ? String(payload.buttonLabel)
          : payload.buttonId != null
            ? `Button ${String(payload.buttonId)}`
            : null,
        metadata: { ...base.metadata, buttonId: payload.buttonId, buttonLabel: payload.buttonLabel },
      };
    case EventTypes.ENGINE_MESSAGE: {
      const content = getPayloadString(payload, "content");
      const preview = content ? truncate(content, ACTIVITY_MESSAGE_PREVIEW_LIMIT) : null;
      return {
        ...base,
        eventType: "bot_message",
        actor: "bot",
        title: "Bot message",
        description: preview,
        metadata: {
          ...base.metadata,
          ...(preview ? { messageContent: preview } : {}),
        },
      };
    }
    case EventTypes.ENGINE_TRANSITION: {
      const from = typeof payload.from === "string" ? payload.from : undefined;
      const to = typeof payload.to === "string" ? payload.to : undefined;
      return {
        ...base,
        eventType: "node_transition",
        actor: "system",
        title: "Moved to node",
        nodeId: to ?? base.nodeId,
        description: from || to ? `${from ?? "unknown"} → ${to ?? "unknown"}` : base.nodeId ?? "Transition",
        metadata: { ...base.metadata, from, to },
      };
    }
    case EventTypes.TIMER_EXPIRED:
      return {
        ...base,
        eventType: "timeout",
        actor: "system",
        title: "Timeout",
        description: payload.edgeId != null ? `Edge ${String(payload.edgeId)}` : "Edge timeout",
        metadata: { ...base.metadata, edgeId: payload.edgeId },
      };
    case EventTypes.ENGINE_ERROR:
      return {
        ...base,
        eventType: "error",
        actor: "system",
        title: "Error",
        description: payload.message ? truncate(String(payload.message), 160) : "Engine error",
      };
    case EventTypes.SESSION_TAGS:
      return {
        ...base,
        eventType: "tags",
        actor: "system",
        title: "Tags updated",
        description: summarizeTags(payload),
      };
    case EventTypes.SESSION_VARIABLES:
      return {
        ...base,
        eventType: "variables",
        actor: "system",
        title: "Variables updated",
        description: summarizeVariables(payload),
      };
    case EventTypes.JOURNEY_TELEPORT:
      return {
        ...base,
        eventType: "teleport",
        actor: "system",
        title: "Teleported",
        description: summarizeTeleport(payload),
        metadata: { ...base.metadata, toJourneyId: payload.toJourneyId, toNodeId: payload.toNodeId },
      };
    case EventTypes.MINDSTATE_UPDATED:
      return {
        ...base,
        eventType: "mindstate",
        actor: "system",
        title: "Mindstate",
        description: payload.key ? String(payload.key) : "Mindstate update",
      };
    case EventTypes.JOURNEY_CRM:
      return {
        ...base,
        eventType: "crm",
        actor: "system",
        title: "CRM",
        description: payload.action ? String(payload.action) : "CRM event",
      };
    case EventTypes.WEBHOOK_EXECUTED:
      return {
        ...base,
        eventType: "webhook",
        actor: "system",
        title: payload.label ? `Webhook: ${payload.label}` : "Webhook executed",
        description: payload.method ? `${payload.method}${payload.isMock ? " (mock)" : ""}` : null,
      };
    case EventTypes.TIMER_FOLLOWUP:
      return {
        ...base,
        eventType: "followup",
        actor: "system",
        title: "Follow-up",
        description: payload.stepIndex != null ? `Step ${Number(payload.stepIndex) + 1}` : "Follow-up sent",
      };
    case EventTypes.LLM_HITL:
      return {
        ...base,
        eventType: "hitl",
        actor: "system",
        title: "Human-in-the-Loop",
        description: payload.reason ? String(payload.reason) : "HITL triggered",
      };
    case EventTypes.LLM_GUARD_BLOCKED:
      return {
        ...base,
        eventType: "guard_blocked",
        actor: "system",
        title: "Guard Blocked",
        description: payload.guardType ? `${payload.guardType} guard blocked transition` : "Edge blocked by guard",
        metadata: { ...base.metadata, edgeId: payload.edgeId, guardType: payload.guardType },
      };
    case EventTypes.LLM_GUARD_FALLBACK:
      return {
        ...base,
        eventType: "guard_fallback",
        actor: "system",
        title: "Guard Fallback",
        description: payload.fallbackEdgeId ? `Fallback edge ${payload.fallbackEdgeId}` : "Fallback edge used",
        metadata: { ...base.metadata, fallbackEdgeId: payload.fallbackEdgeId, blockedEdges: payload.blockedEdges },
      };
    default:
      return base;
  }
}

function summarizeTags(payload: Record<string, unknown>): string {
  const additions = getStringArray(payload.addTags);
  const removals = getStringArray(payload.removeTags);
  const parts: string[] = [];
  if (additions.length) parts.push(`+${additions.join(", ")}`);
  if (removals.length) parts.push(`-${removals.join(", ")}`);
  const scope = typeof payload.scope === "string" ? payload.scope : null;
  if (scope === "global") parts.push("(global)");
  return parts.join(" ").trim() || "Tags updated";
}

function summarizeVariables(payload: Record<string, unknown>): string {
  const operations = Array.isArray(payload.operations)
    ? payload.operations.filter(isRecord).map((op) => ({
        op: typeof op.op === "string" ? op.op : undefined,
        key: typeof op.key === "string" ? op.key : undefined,
        scope: typeof op.scope === "string" ? op.scope : undefined,
      }))
    : [];
  if (operations.length === 0) {
    return "Variables updated";
  }

  const grouped: Record<string, string[]> = { user: [], journey: [], global: [] };
  for (const op of operations) {
    const opName = op.op && op.key ? `${op.op}(${op.key})` : op.key || op.op || "op";
    const scope = op.scope ?? "journey";
    if (!grouped[scope]) grouped[scope] = [];
    grouped[scope].push(opName);
  }

  const parts: string[] = [];
  if (grouped.user.length) parts.push(`User: ${grouped.user.join(", ")}`);
  if (grouped.journey.length) parts.push(`Journey: ${grouped.journey.join(", ")}`);
  if (grouped.global.length) parts.push(`Global: ${grouped.global.join(", ")}`);

  return parts.join(" | ");
}

function summarizeTeleport(payload: Record<string, unknown>): string {
  const toJourney = getPayloadString(payload, "toJourneyName") ?? getPayloadString(payload, "toJourneyId");
  const toNode = getPayloadString(payload, "toNodeId") ?? undefined;
  if (toJourney && toNode) return `${toJourney} @ ${toNode}`;
  if (toJourney) return `to ${toJourney}`;
  if (toNode) return `to ${toNode}`;
  return "Teleport";
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function sanitizeInteractionPayload(type: string, payload: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case EventTypes.USER_MESSAGE:
      return truncatePayloadField(payload, "text");
    case EventTypes.ENGINE_MESSAGE:
      return truncatePayloadField(payload, "content");
    default:
      return payload;
  }
}

function truncatePayloadField(payload: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = payload[key];
  if (typeof value !== "string") return payload;
  return { ...payload, [key]: truncate(value, ACTIVITY_MESSAGE_PREVIEW_LIMIT) };
}

function getPayloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : String(value);
}
