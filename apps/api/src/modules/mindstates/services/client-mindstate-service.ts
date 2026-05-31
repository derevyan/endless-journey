/**
 * Client Mindstate Service
 *
 * Operations for client mindstates (runtime instances of definitions).
 * Each client can have their own mindstate instance based on an organization's definition template.
 *
 * @module modules/mindstates/services/client-mindstate-service
 */

import { clientMindstates } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import { NotFoundError, type ClientMindstate } from "@journey/schemas";
import { and, eq } from "drizzle-orm";

import { getDefinition } from "./definition-service";
import type { MindstateServiceContext } from "./service-context";

const log = createLogger("client-mindstate-service");

/**
 * Map database row to ClientMindstate type
 */
function mapRowToClientMindstate(row: typeof clientMindstates.$inferSelect): ClientMindstate {
  return {
    id: row.id,
    clientId: row.clientId,
    definitionId: row.definitionId,
    stateParameters: row.stateParameters,
    systemAgents: row.systemAgents,
    agentInsights: row.agentInsights ?? [],
    lastAnalyzedAt: row.lastAnalyzedAt,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

/**
 * Get or create a client mindstate for a specific definition
 * Creates a new instance from the definition template if it doesn't exist
 */
export async function getOrCreateClientMindstate(
  ctx: MindstateServiceContext,
  clientId: string,
  definitionKey: string
): Promise<ClientMindstate> {
  try {
    // First, get the definition
    const definition = await getDefinition(ctx, definitionKey);
    if (!definition) {
      throw new NotFoundError("MindstateDefinition", definitionKey);
    }

    // Check if client mindstate already exists
    const existing = await ctx.db
      .select()
      .from(clientMindstates)
      .where(and(eq(clientMindstates.clientId, clientId), eq(clientMindstates.definitionId, definition.id)));

    if (existing.length > 0) {
      return mapRowToClientMindstate(existing[0]);
    }

    // Create new client mindstate from definition template
    const [newMindstate] = await ctx.db
      .insert(clientMindstates)
      .values({
        clientId,
        definitionId: definition.id,
        stateParameters: definition.defaultParameters,
        systemAgents: definition.defaultAgents,
        agentInsights: [],
        lastAnalyzedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.info({ clientId, definitionKey, mindstateId: newMindstate.id }, "clientMindstateService:create");

    return mapRowToClientMindstate(newMindstate);
  } catch (error) {
    log.error(
      { clientId, definitionKey, organizationId: ctx.organizationId, err: serializeError(error) },
      "clientMindstateService:getOrCreate:error"
    );
    throw error;
  }
}

/**
 * Get a client mindstate by ID
 */
export async function getClientMindstateById(
  ctx: MindstateServiceContext,
  mindstateId: string
): Promise<ClientMindstate | null> {
  try {
    const results = await ctx.db.select().from(clientMindstates).where(eq(clientMindstates.id, mindstateId));

    if (results.length === 0) {
      return null;
    }

    return mapRowToClientMindstate(results[0]);
  } catch (error) {
    log.error({ mindstateId, err: serializeError(error) }, "clientMindstateService:getById:error");
    throw error;
  }
}

/**
 * List all mindstates for a client
 */
export async function listClientMindstates(
  ctx: MindstateServiceContext,
  clientId: string
): Promise<ClientMindstate[]> {
  try {
    const results = await ctx.db.select().from(clientMindstates).where(eq(clientMindstates.clientId, clientId));

    return results.map(mapRowToClientMindstate);
  } catch (error) {
    log.error({ clientId, err: serializeError(error) }, "clientMindstateService:list:error");
    throw error;
  }
}
