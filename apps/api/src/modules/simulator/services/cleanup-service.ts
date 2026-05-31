/**
 * Simulator Cleanup Service
 *
 * Handles cleanup of test data created during simulator sessions:
 * - Reset persona data (keep client, clear tags/CRM/sessions)
 * - Bulk cleanup all test data for an organization
 *
 * @module modules/simulator/services/cleanup-service
 */

import {
  clients,
  clientTags,
  crmClientStages,
  crmStageHistory,
  crmClientFieldValues,
  clientMindstates,
  agentMemories,
  journeySessions,
  variables,
} from "@journey/db";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { createLogger, serializeError } from "@journey/logger";
import type { BulkCleanupResult, ResetResult } from "@journey/schemas";
import { getPersona, listPersonas } from "./persona-service";
import type { SimulatorServiceContext } from "./service-context";

const log = createLogger("cleanup-service");

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

/**
 * Reset accumulated data for a client and delete old sessions.
 * Used when reusing the anonymous simulator client to ensure fresh state.
 *
 * Deletes:
 * - journeySessions (CASCADE deletes: interactions, sentMessages)
 * - clientTags
 * - crmClientStages, crmStageHistory, crmClientFieldValues
 * - clientMindstates (mindstateAnalysisLog cascades)
 * - agentMemories
 * - variables (scope=user)
 *
 * Updates:
 * - Clears client metadata (playback flags, etc.)
 *
 * CRITICAL: Sessions must be deleted to prevent stale history from being loaded
 * into fresh sessions, which causes the engine to treat them as "resume" operations.
 */
export async function resetClientData(ctx: SimulatorServiceContext, clientId: string): Promise<void> {
  log.debug({ clientId }, "cleanup:resetClientDataStart");

  await ctx.db.transaction(async (tx) => {
    // 1. Delete tags
    await tx.delete(clientTags).where(eq(clientTags.clientId, clientId));

    // 2. Delete CRM data (stages, history, field values)
    await tx.delete(crmClientStages).where(eq(crmClientStages.clientId, clientId));
    await tx.delete(crmStageHistory).where(eq(crmStageHistory.clientId, clientId));
    await tx.delete(crmClientFieldValues).where(eq(crmClientFieldValues.clientId, clientId));

    // 3. Delete mindstates (analysisLog cascades)
    await tx.delete(clientMindstates).where(eq(clientMindstates.clientId, clientId));

    // 4. Delete agent memories
    await tx.delete(agentMemories).where(eq(agentMemories.clientId, clientId));

    // 5. Delete user variables
    await tx.delete(variables).where(and(eq(variables.scope, "user"), eq(variables.ownerId, clientId)));

    // 6. ✅ DELETE JOURNEY SESSIONS (CASCADE DELETES INTERACTIONS + SENT_MESSAGES)
    // CRITICAL: Old sessions with stale history break engine resume detection.
    // If not deleted, loadHistoryFromDatabase() loads old events, causing fresh sessions to be
    // treated as "resume" operations, which skips the start node handler and blocks the simulator.
    await tx.delete(journeySessions).where(eq(journeySessions.clientId, clientId));

    // 7. Clear client metadata (playback flags, etc.)
    // CRITICAL: Prevents stale playback mode flags from blocking future simulator sessions
    await tx
      .update(clients)
      .set({ metadata: null, updatedAt: new Date() })
      .where(eq(clients.id, clientId));
  });

  log.debug({ clientId }, "cleanup:resetClientDataComplete");
}

/**
 * Reset a single persona's accumulated data
 * Keeps the client record, clears associated data
 */
export async function resetPersonaData(
  ctx: SimulatorServiceContext,
  personaId: string
): Promise<ResetResult | null> {
  const persona = await getPersona(ctx, personaId);
  if (!persona) return null;

  if (!persona.clientId) {
    log.info({ personaId }, "cleanup:personaNoClient");
    return {
      tagsDeleted: 0,
      crmStagesDeleted: 0,
      sessionsDeleted: 0,
      variablesReset: false,
    };
  }

  const clientId = persona.clientId;
  log.info({ personaId, clientId }, "cleanup:resetPersonaStart");

  // Use transaction for atomicity
  const result = await ctx.db.transaction(async (tx) => {
    // 1. Delete tags
    const deletedTags = await tx
      .delete(clientTags)
      .where(eq(clientTags.clientId, clientId))
      .returning({ clientId: clientTags.clientId });

    // 2. Delete CRM stages
    const deletedStages = await tx
      .delete(crmClientStages)
      .where(eq(crmClientStages.clientId, clientId))
      .returning({ id: crmClientStages.id });

    // 3. Delete simulation sessions (keep client)
    const deletedSessions = await tx
      .delete(journeySessions)
      .where(
        and(
          eq(journeySessions.clientId, clientId),
          eq(journeySessions.mode, "simulation")
        )
      )
      .returning({ id: journeySessions.id });

    // 4. Reset user variables to persona defaults
    await tx
      .delete(variables)
      .where(and(eq(variables.scope, "user"), eq(variables.ownerId, clientId)));

    if (persona.userVars && Object.keys(persona.userVars).length > 0) {
      const variableRows: Array<typeof variables.$inferInsert> = Object.entries(persona.userVars).map(
        ([key, value]) => ({
        organizationId: ctx.organizationId,
        scope: "user",
        ownerId: clientId,
        key,
        value,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        })
      );

      await tx.insert(variables).values(variableRows);
    }

    return {
      tagsDeleted: deletedTags.length,
      crmStagesDeleted: deletedStages.length,
      sessionsDeleted: deletedSessions.length,
      variablesReset: true,
    };
  });

  log.info({ personaId, clientId, result }, "cleanup:resetPersonaComplete");
  return result;
}

/**
 * Bulk cleanup all test data for organization
 */
export async function cleanupAllTestData(
  ctx: SimulatorServiceContext
): Promise<BulkCleanupResult> {
  log.info({ organizationId: ctx.organizationId }, "cleanup:bulkStart");

  // 1. Get all personas for org
  const personas = await listPersonas(ctx);
  const personaClientIds = personas
    .map((p) => p.clientId)
    .filter((id): id is string => id !== null);

  // 2. Reset each persona
  let totalTagsDeleted = 0;
  let totalSessionsDeleted = 0;

  for (const persona of personas) {
    try {
      const result = await resetPersonaData(ctx, persona.id);
      if (result) {
        totalTagsDeleted += result.tagsDeleted;
        totalSessionsDeleted += result.sessionsDeleted;
      }
    } catch (error) {
      log.error({ personaId: persona.id, err: serializeError(error) }, "cleanup:resetPersonaFailed");
      // Continue with other personas
    }
  }

  // 3. Find anonymous test clients (is_test=true, not linked to persona)
  const anonymousClientsQuery = ctx.db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.isTest, true),
        eq(clients.platform, "simulator"),
        eq(clients.organizationId, ctx.organizationId)
      )
    );

  // Filter out persona clients if there are any
  const anonymousClients = personaClientIds.length > 0
    ? await ctx.db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.isTest, true),
            eq(clients.platform, "simulator"),
            eq(clients.organizationId, ctx.organizationId),
            notInArray(clients.id, personaClientIds)
          )
        )
    : await anonymousClientsQuery;

  const anonymousClientIds = anonymousClients.map((c) => c.id);

  // 4. Delete anonymous clients and their data
  if (anonymousClientIds.length > 0) {
    await ctx.db.transaction(async (tx) => {
      // Tags
      const deletedTags = await tx
        .delete(clientTags)
        .where(inArray(clientTags.clientId, anonymousClientIds))
        .returning({ clientId: clientTags.clientId });
      totalTagsDeleted += deletedTags.length;

      // CRM stages
      await tx
        .delete(crmClientStages)
        .where(inArray(crmClientStages.clientId, anonymousClientIds));

      // Sessions
      const deletedSessions = await tx
        .delete(journeySessions)
        .where(inArray(journeySessions.clientId, anonymousClientIds))
        .returning({ id: journeySessions.id });
      totalSessionsDeleted += deletedSessions.length;

      // Finally, delete the clients themselves
      await tx
        .delete(clients)
        .where(inArray(clients.id, anonymousClientIds));
    });
  }

  const result: BulkCleanupResult = {
    personasReset: personas.length,
    anonymousClientsDeleted: anonymousClientIds.length,
    totalTagsDeleted,
    totalSessionsDeleted,
  };

  log.info({ organizationId: ctx.organizationId, result }, "cleanup:bulkComplete");
  return result;
}
