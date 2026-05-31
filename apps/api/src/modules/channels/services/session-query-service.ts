/**
 * Session Query Service
 *
 * Complex session queries with joins and bulk operations.
 * Separated for better testability and maintainability.
 *
 * @module modules/channels/services/session-query-service
 */

import { clients, journeys, journeySessions, journeyTransfers, interactions, nodeOutputs } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import type { InteractionEvent, NodeOutput, SessionFilters, SessionListItem, SessionWithInteractions } from "@journey/schemas";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getSessionById } from "./session-service";
import type { ChannelServiceContext, SessionQueryContext } from "./service-context";

const log = createLogger("session-query-service");

// =============================================================================
// SESSION QUERIES (for Users Viewer)
// =============================================================================

/**
 * Get all sessions for a journey with user info
 */
export async function getSessionsByJourneyId(
  ctx: ChannelServiceContext,
  journeyId: string,
  filters: SessionFilters = {}
): Promise<SessionListItem[]> {
  const { status, limit = 50, offset = 0 } = filters;

  try {
    log.debug({ journeyId, filters }, "sessionQuery:getSessionsByJourney:start");

    // Build the query with join to get user info
    const baseQuery = ctx.db
      .select({
        id: journeySessions.id,
        currentNodeId: journeySessions.currentNodeId,
        status: journeySessions.status,
        createdAt: journeySessions.createdAt,
        updatedAt: journeySessions.updatedAt,
        userId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        username: clients.username,
      })
      .from(journeySessions)
      .innerJoin(clients, eq(journeySessions.clientId, clients.id))
      .where(status ? and(eq(journeySessions.journeyId, journeyId), eq(journeySessions.status, status)) : eq(journeySessions.journeyId, journeyId))
      .orderBy(desc(journeySessions.updatedAt))
      .limit(limit)
      .offset(offset);

    const results = await baseQuery;

    const sessions: SessionListItem[] = results.map((row) => ({
      id: row.id,
      currentNodeId: row.currentNodeId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.userId,
        firstName: row.firstName,
        lastName: row.lastName,
        username: row.username,
      },
    }));

    log.debug({ journeyId, count: sessions.length }, "sessionQuery:getSessionsByJourney:success");

    return sessions;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "sessionQuery:getSessionsByJourney:error");
    throw error;
  }
}

/**
 * Get a single session with all interactions
 */
export async function getSessionWithInteractions(
  ctx: ChannelServiceContext,
  sessionId: string
): Promise<SessionWithInteractions | null> {
  try {
    log.debug({ sessionId }, "sessionQuery:getSessionWithInteractions:start");

    // First, get the session without join to verify it exists
    const sessionRecord = await getSessionById(ctx, sessionId);
    if (!sessionRecord) {
      log.warn({ sessionId }, "sessionQuery:getSessionWithInteractions:sessionNotFound");
      return null;
    }

    // Verify organization ownership if context has organizationId
    // This prevents cross-organization session access
    if (ctx.organizationId) {
      const sessionOrgId = sessionRecord.channelId
        ? await ctx.db
            .select({ organizationId: journeySessions.organizationId })
            .from(journeySessions)
            .where(eq(journeySessions.id, sessionId))
            .limit(1)
            .then((r) => r[0]?.organizationId)
        : null;

      if (sessionOrgId && sessionOrgId !== ctx.organizationId) {
        log.warn(
          { sessionId, expected: ctx.organizationId, actual: sessionOrgId },
          "sessionQuery:getSessionWithInteractions:orgMismatch"
        );
        return null;
      }
    }

    // Get user info separately
    const userResults = await ctx.db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        username: clients.username,
      })
      .from(clients)
      .where(eq(clients.id, sessionRecord.clientId))
      .limit(1);

    if (userResults.length === 0) {
      log.error({ sessionId, clientId: sessionRecord.clientId }, "sessionQuery:getSessionWithInteractions:userNotFound");
      // Return null if user doesn't exist (shouldn't happen, but handle gracefully)
      return null;
    }

    const user = userResults[0];

    // Get all interactions for this session (oldest first for path computation)
    const interactionResults = await ctx.db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, sessionId))
      .orderBy(interactions.timestamp);

    const sessionInteractions: InteractionEvent[] = interactionResults.map((i) => ({
      id: i.id,
      timestamp: i.timestamp?.toISOString() || new Date().toISOString(),
      type: i.type as InteractionEvent["type"],
      nodeId: i.nodeId,
      payload: i.payload,
      metadata: i.metadata as Record<string, unknown> | undefined,
    }));

    // Get node outputs for this session (for Outputs tab in playback mode)
    const outputResults = await ctx.db.select().from(nodeOutputs).where(eq(nodeOutputs.sessionId, sessionId));

    const sessionNodeOutputs: Record<string, NodeOutput> = outputResults.reduce(
      (acc, o) => ({
        ...acc,
        [o.sanitizedLabel]: {
          nodeId: o.nodeId,
          nodeLabel: o.nodeLabel || o.sanitizedLabel,
          nodeType: o.nodeType || "unknown",
          executedAt: o.executedAt.toISOString(),
          data: o.data,
        },
      }),
      {} as Record<string, NodeOutput>
    );

    const tags = sessionRecord.tags;

    const result: SessionWithInteractions = {
      id: sessionRecord.id,
      clientId: sessionRecord.clientId,
      channelId: sessionRecord.channelId,
      journeyId: sessionRecord.journeyId,
      currentNodeId: sessionRecord.currentNodeId,
      status: sessionRecord.status,
      mode: sessionRecord.mode,
      context: {},
      tags,
      createdAt: sessionRecord.createdAt,
      updatedAt: sessionRecord.updatedAt,
      completedAt: sessionRecord.completedAt,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      interactions: sessionInteractions,
      nodeOutputs: sessionNodeOutputs,
    };

    log.debug({ sessionId, interactionCount: sessionInteractions.length }, "sessionQuery:getSessionWithInteractions:success");

    return result;
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "sessionQuery:getSessionWithInteractions:error");
    throw error;
  }
}

/**
 * Get all active sessions for a journey (for deactivation)
 * Returns session IDs for bulk operations
 *
 * Note: Uses SessionQueryContext (minimal db-only context) to avoid circular dependencies
 * when called from journey-service.ts during deactivation/reactivation
 */
export async function getActiveSessionsForJourney(ctx: SessionQueryContext, journeyId: string): Promise<string[]> {
  try {
    const results = await ctx.db
      .select({ id: journeySessions.id })
      .from(journeySessions)
      .where(and(eq(journeySessions.journeyId, journeyId), eq(journeySessions.status, "active")));

    return results.map((r) => r.id);
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "sessionQuery:getActiveSessionsForJourney:error");
    throw error;
  }
}

/**
 * Get all paused sessions for a journey (for reactivation)
 * Returns session IDs for bulk operations
 *
 * Note: Uses SessionQueryContext (minimal db-only context) to avoid circular dependencies
 */
export async function getPausedSessionsForJourney(ctx: SessionQueryContext, journeyId: string): Promise<string[]> {
  try {
    const results = await ctx.db
      .select({ id: journeySessions.id })
      .from(journeySessions)
      .where(and(eq(journeySessions.journeyId, journeyId), eq(journeySessions.status, "paused")));

    return results.map((r) => r.id);
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "sessionQuery:getPausedSessionsForJourney:error");
    throw error;
  }
}

/**
 * Get count of active sessions for a journey
 * Used for UI display before deactivation
 */
export async function getActiveSessionCountForJourney(ctx: ChannelServiceContext, journeyId: string): Promise<number> {
  try {
    const results = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(journeySessions)
      .where(and(eq(journeySessions.journeyId, journeyId), eq(journeySessions.status, "active")));

    return results[0]?.count ?? 0;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "sessionQuery:getActiveSessionCountForJourney:error");
    throw error;
  }
}

/**
 * Bulk update session status (for pause/terminate operations)
 *
 * Note: Uses SessionQueryContext (minimal db-only context) to avoid circular dependencies
 */
export async function bulkUpdateSessionStatus(
  ctx: SessionQueryContext,
  sessionIds: string[],
  status: "active" | "paused" | "completed" | "dropped"
): Promise<number> {
  if (sessionIds.length === 0) return 0;

  try {
    const result = await ctx.db
      .update(journeySessions)
      .set({
        status,
        updatedAt: new Date(),
        ...(status === "completed" && { completedAt: new Date() }),
      })
      .where(inArray(journeySessions.id, sessionIds))
      .returning({ id: journeySessions.id });

    log.info({ sessionCount: result.length, status }, "sessionQuery:bulkUpdateSessionStatus:success");
    return result.length;
  } catch (error) {
    log.error({ sessionCount: sessionIds.length, status, err: serializeError(error) }, "sessionQuery:bulkUpdateSessionStatus:error");
    throw error;
  }
}

/**
 * Reset all sessions for a journey (development only)
 * Deletes all sessions and their interactions for a given journey
 */
export async function resetJourneySessions(ctx: ChannelServiceContext, journeyId: string): Promise<number> {
  try {
    log.warn({ journeyId }, "sessionQuery:resetJourneySessions:start");

    // Get all session IDs for this journey
    const sessionsToDelete = await ctx.db
      .select({ id: journeySessions.id })
      .from(journeySessions)
      .where(eq(journeySessions.journeyId, journeyId));

    const sessionIds = sessionsToDelete.map((s) => s.id);

    if (sessionIds.length === 0) {
      log.info({ journeyId }, "sessionQuery:resetJourneySessions:noSessions");
      return 0;
    }

    // Delete sessions (interactions are cascade-deleted via FK)
    await ctx.db.delete(journeySessions).where(eq(journeySessions.journeyId, journeyId));

    log.warn({ journeyId, deletedCount: sessionIds.length }, "sessionQuery:resetJourneySessions:success");

    return sessionIds.length;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "sessionQuery:resetJourneySessions:error");
    throw error;
  }
}

// =============================================================================
// JOURNEY ROUTING QUERIES (for IJourneyService)
// =============================================================================

/**
 * User's active journey session info for journey routing
 */
export interface UserActiveSession {
  sessionId: string;
  journeyId: string;
  journeyName: string;
  status: "active" | "paused";
  currentNodeId: string;
  startedAt: Date;
}

/**
 * Journey transfer audit event
 */
export interface JourneyTransferEvent {
  organizationId: string;
  clientId: string;
  fromJourneyId: string;
  toJourneyId: string;
  fromSessionId?: string;
  toSessionId?: string;
  triggeredBy: "ai_tool" | "teleport_node" | "api";
  success: boolean;
  errorMessage?: string;
}

/**
 * Get all active/paused sessions for a user across all journeys.
 * Used by IJourneyService for conflict detection and context awareness.
 */
export async function getActiveSessionsForUser(
  ctx: ChannelServiceContext,
  userId: string
): Promise<UserActiveSession[]> {
  try {
    log.debug({ userId }, "sessionQuery:getActiveSessionsForUser:start");

    const results = await ctx.db
      .select({
        sessionId: journeySessions.id,
        journeyId: journeySessions.journeyId,
        journeyName: journeys.name,
        status: journeySessions.status,
        currentNodeId: journeySessions.currentNodeId,
        startedAt: journeySessions.createdAt,
      })
      .from(journeySessions)
      .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
      .where(
        and(
          eq(journeySessions.clientId, userId),
          or(eq(journeySessions.status, "active"), eq(journeySessions.status, "paused"))
        )
      )
      .orderBy(desc(journeySessions.updatedAt));

    const sessions: UserActiveSession[] = results.map((row) => ({
      sessionId: row.sessionId,
      journeyId: row.journeyId,
      journeyName: row.journeyName,
      status: row.status as "active" | "paused",
      currentNodeId: row.currentNodeId,
      startedAt: row.startedAt || new Date(),
    }));

    log.debug({ userId, count: sessions.length }, "sessionQuery:getActiveSessionsForUser:success");

    return sessions;
  } catch (error) {
    log.error({ userId, err: serializeError(error) }, "sessionQuery:getActiveSessionsForUser:error");
    throw error;
  }
}

/**
 * Check if a user has ever completed a specific journey.
 * Used by IJourneyService for completion history checks.
 */
export async function hasUserCompletedJourney(
  ctx: ChannelServiceContext,
  userId: string,
  journeyId: string
): Promise<boolean> {
  try {
    log.debug({ userId, journeyId }, "sessionQuery:hasUserCompletedJourney:start");

    const results = await ctx.db
      .select({ id: journeySessions.id })
      .from(journeySessions)
      .where(
        and(
          eq(journeySessions.clientId, userId),
          eq(journeySessions.journeyId, journeyId),
          eq(journeySessions.status, "completed")
        )
      )
      .limit(1);

    const hasCompleted = results.length > 0;

    log.debug({ userId, journeyId, hasCompleted }, "sessionQuery:hasUserCompletedJourney:success");

    return hasCompleted;
  } catch (error) {
    log.error({ userId, journeyId, err: serializeError(error) }, "sessionQuery:hasUserCompletedJourney:error");
    throw error;
  }
}

/**
 * Log a journey transfer event to the audit table.
 * Records both successful and failed transfer attempts.
 */
export async function logJourneyTransfer(ctx: ChannelServiceContext, event: JourneyTransferEvent): Promise<void> {
  try {
    log.info(
      {
        clientId: event.clientId,
        fromJourneyId: event.fromJourneyId,
        toJourneyId: event.toJourneyId,
        triggeredBy: event.triggeredBy,
        success: event.success,
      },
      "sessionQuery:logJourneyTransfer:start"
    );

    await ctx.db.insert(journeyTransfers).values({
      organizationId: event.organizationId,
      clientId: event.clientId,
      fromJourneyId: event.fromJourneyId,
      toJourneyId: event.toJourneyId,
      fromSessionId: event.fromSessionId,
      toSessionId: event.toSessionId,
      triggeredBy: event.triggeredBy,
      success: event.success,
      errorMessage: event.errorMessage,
    });

    log.info(
      {
        clientId: event.clientId,
        fromJourneyId: event.fromJourneyId,
        toJourneyId: event.toJourneyId,
        success: event.success,
      },
      "sessionQuery:logJourneyTransfer:success"
    );
  } catch (error) {
    // Intentionally swallowed: Audit logging should not fail transfer operations.
    // The primary operation (session transfer) succeeded - audit is secondary.
    // Consider adding metrics/alerting for persistent failures in monitoring.
    log.error(
      {
        clientId: event.clientId,
        fromJourneyId: event.fromJourneyId,
        toJourneyId: event.toJourneyId,
        err: serializeError(error),
        note: "audit_logging_failed_intentionally_swallowed",
      },
      "sessionQuery:logJourneyTransfer:error"
    );
  }
}
