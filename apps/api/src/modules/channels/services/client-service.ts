/**
 * Client Service
 *
 * Manages channel clients (users) and their variables.
 * Clients represent users across messaging platforms (Telegram, WhatsApp, etc.)
 *
 * @module modules/channels/services/client-service
 */

import { clients, events, interactions, journeySessions, variables } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import type { ChannelUserInfo, ClientRecord, VariableOperation } from "@journey/schemas";
import { and, eq, inArray } from "drizzle-orm";

import type { ChannelServiceContext } from "./service-context";

const log = createLogger("client-service");

export type { VariableOperation };

// =============================================================================
// CLIENT OPERATIONS
// =============================================================================

/**
 * Find or create a channel user
 */
export async function findOrCreateChannelUser(ctx: ChannelServiceContext, info: ChannelUserInfo): Promise<string> {
  const { db } = ctx;
  try {
    // Check if user exists
    const existing = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, info.organizationId),
          eq(clients.platform, info.platform),
          eq(clients.platformUserId, info.platformUserId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update user info if changed
      await db
        .update(clients)
        .set({
          firstName: info.firstName,
          lastName: info.lastName,
          username: info.username,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, existing[0].id));

      log.debug({ userId: existing[0].id }, "client:userUpdated");
      return existing[0].id;
    }

    // Create new user
    const [created] = await db
      .insert(clients)
      .values({
        organizationId: info.organizationId,
        platformUserId: info.platformUserId,
        firstName: info.firstName,
        lastName: info.lastName,
        username: info.username,
        platform: info.platform,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: clients.id });

    log.info({ userId: created.id, platform: info.platform }, "client:userCreated");
    return created.id;
  } catch (error) {
    log.error({ platform: info.platform, platformUserId: info.platformUserId, err: serializeError(error) }, "client:userError");
    throw error;
  }
}

/**
 * Get client by ID
 * Returns full client record including user profile data
 */
export async function getClientById(ctx: ChannelServiceContext, clientId: string): Promise<ClientRecord | null> {
  const { db } = ctx;
  try {
    const results = await db.select().from(clients).where(eq(clients.id, clientId));

    if (results.length === 0) {
      return null;
    }

    const client = results[0];
    return {
      id: client.id,
      platform: client.platform,
      platformUserId: client.platformUserId,
      firstName: client.firstName,
      lastName: client.lastName,
      username: client.username,
    };
  } catch (error) {
    log.error({ clientId, err: serializeError(error) }, "client:getById:error");
    throw error;
  }
}

/**
 * Delete a channel user and all associated data
 * Explicitly deletes interactions, timers, and sessions before deleting the user
 * to ensure complete cleanup regardless of database CASCADE constraints
 */
export async function deleteChannelUser(ctx: ChannelServiceContext, userId: string): Promise<boolean> {
  const { db } = ctx;
  try {
    log.info({ userId }, "client:delete:start");

    // 1. Get all session IDs for this user
    const userSessions = await db.select({ id: journeySessions.id }).from(journeySessions).where(eq(journeySessions.clientId, userId));

    const sessionIds = userSessions.map((s) => s.id);

    if (sessionIds.length > 0) {
      // 2. Delete all interactions for these sessions
      const deletedInteractions = await db.delete(interactions).where(inArray(interactions.sessionId, sessionIds)).returning({ id: interactions.id });

      log.debug({ userId, deletedCount: deletedInteractions.length }, "client:delete:interactionsDeleted");

      // 3. Delete all events for these sessions to avoid orphaned history
      const deletedEvents = await db.delete(events).where(inArray(events.sessionId, sessionIds)).returning({ id: events.id });

      log.debug({ userId, deletedCount: deletedEvents.length }, "client:delete:eventsDeleted");

      // 4. Delete all sessions for this user
      const deletedSessions = await db.delete(journeySessions).where(eq(journeySessions.clientId, userId)).returning({ id: journeySessions.id });

      log.debug({ userId, deletedCount: deletedSessions.length }, "client:delete:sessionsDeleted");
    }

    // 5. Delete events by clientId (some events may not have sessionId)
    const deletedClientEvents = await db.delete(events).where(eq(events.clientId, userId)).returning({ id: events.id });
    if (deletedClientEvents.length > 0) {
      log.debug({ userId, deletedCount: deletedClientEvents.length }, "client:delete:clientEventsDeleted");
    }

    // 6. Delete user-scoped variables (no FK cascade)
    const deletedVariables = await db
      .delete(variables)
      .where(and(eq(variables.scope, "user"), eq(variables.ownerId, userId)))
      .returning({ id: variables.id });
    if (deletedVariables.length > 0) {
      log.debug({ userId, deletedCount: deletedVariables.length }, "client:delete:variablesDeleted");
    }

    // 7. Delete the channel user
    const result = await db.delete(clients).where(eq(clients.id, userId)).returning({ id: clients.id });

    if (result.length === 0) {
      log.warn({ userId }, "client:delete:notFound");
      return false;
    }

    log.info({ userId, sessionsDeleted: sessionIds.length }, "client:delete:success");
    return true;
  } catch (error) {
    log.error({ userId, err: serializeError(error) }, "client:delete:error");
    throw error;
  }
}

// =============================================================================
// USER VARIABLE OPERATIONS
// =============================================================================

/**
 * Get channel user variables
 * Reads from unified variables table (user scope)
 */
export async function getChannelUserVars(
  ctx: ChannelServiceContext,
  organizationId: string,
  userId: string
): Promise<Record<string, unknown>> {
  try {
    // Read from user_variables table (new unified storage)
    const vars = await ctx.variableService.getVariablesAsMap("user", userId);

    return vars;
  } catch (error) {
    log.error({ organizationId, userId, err: serializeError(error) }, "client:getUserVars:error");
    throw error;
  }
}

/**
 * Update user variables for a channel user
 * Uses unified variable service for consistent behavior with global/journey variables.
 * Supports event emission and caching.
 */
export async function updateChannelUserVars(
  ctx: ChannelServiceContext,
  organizationId: string,
  userId: string,
  operations: VariableOperation[]
): Promise<void> {
  try {
    if (!operations || operations.length === 0) return;

    await ctx.variableService.executeOperations("user", userId, operations);

    log.info({ organizationId, userId, operationCount: operations.length }, "client:updateUserVars:success");
  } catch (error) {
    log.error({ organizationId, userId, operations, err: serializeError(error) }, "client:updateUserVars:error");
    throw error;
  }
}
