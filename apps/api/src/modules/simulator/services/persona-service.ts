/**
 * Persona Service
 *
 * CRUD operations for test personas used in simulator sessions.
 * Personas allow reusing the same client identity across multiple simulations.
 *
 * @module modules/simulator/services/persona-service
 */

import { clients, testPersonas } from "@journey/db";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@journey/logger";

import type { CreatePersonaRequest, UpdatePersonaRequest, Persona } from "@journey/schemas";
import type { SimulatorServiceContext } from "./service-context";
import { normalizePersonaProfile, normalizeUserVars } from "./profile-helpers";

const log = createLogger("persona-service");

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * List all personas for an organization
 */
export async function listPersonas(ctx: SimulatorServiceContext): Promise<Persona[]> {
  const results = await ctx.db
    .select()
    .from(testPersonas)
    .where(eq(testPersonas.organizationId, ctx.organizationId))
    .orderBy(testPersonas.name);

  return results.map(mapToPersona);
}

/**
 * Get a single persona by ID
 */
export async function getPersona(ctx: SimulatorServiceContext, id: string): Promise<Persona | null> {
  const [result] = await ctx.db
    .select()
    .from(testPersonas)
    .where(
      and(
        eq(testPersonas.id, id),
        eq(testPersonas.organizationId, ctx.organizationId)
      )
    );

  return result ? mapToPersona(result) : null;
}

/**
 * Create a new persona
 */
export async function createPersona(ctx: SimulatorServiceContext, input: CreatePersonaRequest): Promise<Persona> {
  // Auto-fill profile.firstName from persona name if not provided
  const profile = {
    firstName: input.name, // Use persona name as default firstName for CRM display
    ...normalizePersonaProfile(input.profile), // Allow explicit profile values to override
  };

  const [result] = await ctx.db
    .insert(testPersonas)
    .values({
      organizationId: ctx.organizationId,
      name: input.name,
      profile,
      userVars: normalizeUserVars(input.userVars),
    })
    .returning();

  log.info({ personaId: result.id, name: input.name, organizationId: ctx.organizationId }, "persona:created");

  return mapToPersona(result);
}

/**
 * Update a persona
 */
export async function updatePersona(
  ctx: SimulatorServiceContext,
  id: string,
  input: UpdatePersonaRequest
): Promise<Persona | null> {
  const [result] = await ctx.db
    .update(testPersonas)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.profile !== undefined && { profile: normalizePersonaProfile(input.profile) }),
      ...(input.userVars !== undefined && { userVars: normalizeUserVars(input.userVars) }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(testPersonas.id, id),
        eq(testPersonas.organizationId, ctx.organizationId)
      )
    )
    .returning();

  if (result) {
    log.info({ personaId: id }, "persona:updated");
  }

  return result ? mapToPersona(result) : null;
}

/**
 * Delete a persona and its associated client
 */
export async function deletePersona(ctx: SimulatorServiceContext, id: string): Promise<boolean> {
  // First get the persona to check if it has a client
  const persona = await getPersona(ctx, id);
  if (!persona) return false;

  // Delete the associated client if exists
  if (persona.clientId) {
    await ctx.db.delete(clients).where(eq(clients.id, persona.clientId));
    log.debug({ clientId: persona.clientId, personaId: id }, "persona:clientDeleted");
  }

  // Delete the persona
  const deleted = await ctx.db
    .delete(testPersonas)
    .where(
      and(
        eq(testPersonas.id, id),
        eq(testPersonas.organizationId, ctx.organizationId)
      )
    )
    .returning();

  if (deleted.length > 0) {
    log.info({ personaId: id }, "persona:deleted");
    return true;
  }

  return false;
}

/**
 * Set the client ID for a persona (called when session is created)
 */
export async function setPersonaClientId(ctx: SimulatorServiceContext, personaId: string, clientId: string): Promise<void> {
  await ctx.db
    .update(testPersonas)
    .set({ clientId, updatedAt: new Date() })
    .where(and(eq(testPersonas.id, personaId), eq(testPersonas.organizationId, ctx.organizationId)));

  log.debug({ personaId, clientId }, "persona:clientLinked");
}

/**
 * Get persona by client ID
 */
export async function getPersonaByClientId(
  ctx: SimulatorServiceContext,
  clientId: string
): Promise<Persona | null> {
  const [result] = await ctx.db
    .select()
    .from(testPersonas)
    .where(and(eq(testPersonas.clientId, clientId), eq(testPersonas.organizationId, ctx.organizationId)));

  return result ? mapToPersona(result) : null;
}

// =============================================================================
// HELPERS
// =============================================================================

function mapToPersona(row: typeof testPersonas.$inferSelect): Persona {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    clientId: row.clientId,
    profile: normalizePersonaProfile(row.profile),
    userVars: normalizeUserVars(row.userVars),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
