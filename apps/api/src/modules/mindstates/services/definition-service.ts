/**
 * Mindstate Definition Service
 *
 * CRUD operations for mindstate definitions (organization-level templates).
 * Definitions are templates that clients can instantiate into their own mindstates.
 *
 * @module modules/mindstates/services/definition-service
 */

import { loadPromptContent, mindstateDefinitions } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import {
  DEFAULT_MINDSTATE_CONFIG,
  type CreateMindstateDefinition,
  type CreateStateParameter,
  type MainAgent,
  type MindstateDefinition,
  type StateParameter,
  type UpdateMindstateDefinition,
} from "@journey/schemas";
import { and, eq, isNull } from "drizzle-orm";

import type { MindstateServiceContext } from "./service-context";

const log = createLogger("mindstate-definition-service");

// =============================================================================
// HELPERS
// =============================================================================

function normalizeStateParameters(
  parameters?: CreateStateParameter[] | StateParameter[]
): StateParameter[] {
  if (!parameters) return [];
  return parameters.map((param) => ({
    ...param,
    history: Array.isArray(param.history) ? param.history : [],
  }));
}

function buildUpdateChanges(data: UpdateMindstateDefinition): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      changes[key] = value;
    }
  }
  return changes;
}

// =============================================================================
// PROMPT RESOLUTION
// =============================================================================

/**
 * Resolve promptRef references in mindstate agents.
 * Loads prompt content from database and sets systemPrompt on each agent.
 */
async function resolvePromptRefs(
  ctx: MindstateServiceContext,
  definition: MindstateDefinition
): Promise<MindstateDefinition> {
  let resolvedCount = 0;

  // Resolve mainAgentConfig.promptRef
  const mainAgent = definition.mainAgentConfig;
  if (mainAgent.promptSource === "repository" && mainAgent.promptRef && !mainAgent.systemPrompt) {
    const { name, versionId, label } = mainAgent.promptRef;
    const content = await loadPromptContent(ctx.organizationId, name, { versionId, label }, ctx.db);
    if (content) {
      mainAgent.systemPrompt = content;
      resolvedCount++;
      log.debug({ promptName: name, versionId, label }, "mindstate:promptRef:mainAgent:resolved");
    }
  }

  // Resolve each systemAgent's promptRef
  for (const agent of definition.defaultAgents) {
    if (agent.promptSource === "repository" && agent.promptRef && !agent.systemPrompt) {
      const { name, versionId, label } = agent.promptRef;
      const content = await loadPromptContent(ctx.organizationId, name, { versionId, label }, ctx.db);
      if (content) {
        agent.systemPrompt = content;
        resolvedCount++;
        log.debug({ agentId: agent.id, promptName: name, versionId, label }, "mindstate:promptRef:systemAgent:resolved");
      }
    }
  }

  if (resolvedCount > 0) {
    log.info({ definitionKey: definition.key, resolvedCount }, "mindstate:promptRefs:resolved");
  }

  return definition;
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Map database row to MindstateDefinition type
 */
function mapRowToDefinition(row: typeof mindstateDefinitions.$inferSelect): MindstateDefinition {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    mainAgentConfig: row.mainAgentConfig,
    defaultAgents: row.defaultAgents,
    defaultParameters: row.defaultParameters,
    analysisMode: row.analysisMode ?? "automatic",
    categories: row.categories ?? [],
    status: row.status ?? "draft",
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

/**
 * Get a mindstate definition by key for an organization.
 * Automatically resolves promptRef references from the prompt repository.
 */
export async function getDefinition(
  ctx: MindstateServiceContext,
  key: string
): Promise<MindstateDefinition | null> {
  try {
    const results = await ctx.db
      .select()
      .from(mindstateDefinitions)
      .where(
        and(
          eq(mindstateDefinitions.organizationId, ctx.organizationId),
          eq(mindstateDefinitions.key, key)
        )
      );

    if (results.length === 0) {
      return null;
    }

    let definition = mapRowToDefinition(results[0]);

    // Resolve promptRef references from prompt repository
    definition = await resolvePromptRefs(ctx, definition);

    return definition;
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, key, err: serializeError(error) }, "definitionService:getDefinition:error");
    throw error;
  }
}

/**
 * Get a mindstate definition by ID.
 * Automatically resolves promptRef references from the prompt repository.
 */
export async function getDefinitionById(
  ctx: MindstateServiceContext,
  definitionId: string
): Promise<MindstateDefinition | null> {
  try {
    const results = await ctx.db
      .select()
      .from(mindstateDefinitions)
      .where(
        and(
          eq(mindstateDefinitions.id, definitionId),
          eq(mindstateDefinitions.organizationId, ctx.organizationId)
        )
      );

    if (results.length === 0) {
      return null;
    }

    let definition = mapRowToDefinition(results[0]);

    // Resolve promptRef references from prompt repository
    definition = await resolvePromptRefs(ctx, definition);

    return definition;
  } catch (error) {
    log.error({ definitionId, err: serializeError(error) }, "definitionService:getDefinitionById:error");
    throw error;
  }
}

/**
 * List all mindstate definitions for an organization
 */
export async function listDefinitions(
  ctx: MindstateServiceContext
): Promise<MindstateDefinition[]> {
  try {
    const results = await ctx.db
      .select()
      .from(mindstateDefinitions)
      .where(eq(mindstateDefinitions.organizationId, ctx.organizationId));

    return results.map(mapRowToDefinition);
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, err: serializeError(error) }, "definitionService:listDefinitions:error");
    throw error;
  }
}

/**
 * Create a new mindstate definition
 */
export async function createDefinition(
  ctx: MindstateServiceContext,
  data: CreateMindstateDefinition,
  performedBy?: string
): Promise<MindstateDefinition> {
  try {
    // Build default main agent config if not provided
    const mainAgentConfig: MainAgent = data.mainAgentConfig ?? {
      id: "main-agent",
      name: "Journey Assistant",
      role: "Main conversation agent",
      promptSource: "inline",
      systemPrompt: "You are a helpful assistant that provides personalized responses based on the user's current mental state.",
    };

    const [newDefinition] = await ctx.db
      .insert(mindstateDefinitions)
      .values({
        organizationId: ctx.organizationId,
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        mainAgentConfig,
        defaultAgents: data.defaultAgents ?? [],
        defaultParameters: normalizeStateParameters(data.defaultParameters),
        analysisMode: data.analysisMode ?? "automatic",
        categories: data.categories ?? [],
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.info({ organizationId: ctx.organizationId, key: data.key, definitionId: newDefinition.id }, "definitionService:createDefinition");

    // Publish SSE event
    await ctx.publisher.mindstate.definitionCreated(
      { organizationId: ctx.organizationId, performedBy: performedBy ?? "system" },
      { definitionId: newDefinition.id, definitionKey: data.key, definitionName: data.name }
    );

    return mapRowToDefinition(newDefinition);
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, key: data.key, err: serializeError(error) }, "definitionService:createDefinition:error");
    throw error;
  }
}

/**
 * Update a mindstate definition
 */
export async function updateDefinition(
  ctx: MindstateServiceContext,
  key: string,
  data: UpdateMindstateDefinition,
  performedBy?: string
): Promise<MindstateDefinition | null> {
  try {
    const existing = await getDefinition(ctx, key);
    if (!existing) {
      return null;
    }

    const changes = buildUpdateChanges(data);

    const [updated] = await ctx.db
      .update(mindstateDefinitions)
      .set({
        ...(data.key !== undefined && { key: data.key }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.mainAgentConfig !== undefined && { mainAgentConfig: data.mainAgentConfig }),
        ...(data.defaultAgents !== undefined && { defaultAgents: data.defaultAgents }),
        ...(data.defaultParameters !== undefined && { defaultParameters: normalizeStateParameters(data.defaultParameters) }),
        ...(data.analysisMode !== undefined && { analysisMode: data.analysisMode }),
        ...(data.categories !== undefined && { categories: data.categories }),
        ...(data.status !== undefined && { status: data.status }),
        updatedAt: new Date(),
      })
      .where(eq(mindstateDefinitions.id, existing.id))
      .returning();

    log.info({ organizationId: ctx.organizationId, key, definitionId: existing.id }, "definitionService:updateDefinition");

    // Publish SSE event
    await ctx.publisher.mindstate.definitionUpdated(
      { organizationId: ctx.organizationId, performedBy: performedBy ?? "system" },
      {
        definitionId: existing.id,
        definitionKey: updated.key,
        definitionName: updated.name,
        changes,
      }
    );

    return mapRowToDefinition(updated);
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, key, err: serializeError(error) }, "definitionService:updateDefinition:error");
    throw error;
  }
}

/**
 * Delete a mindstate definition
 */
export async function deleteDefinition(
  ctx: MindstateServiceContext,
  key: string,
  performedBy?: string
): Promise<boolean> {
  try {
    const existing = await getDefinition(ctx, key);
    if (!existing) {
      return false;
    }

    await ctx.db.delete(mindstateDefinitions).where(eq(mindstateDefinitions.id, existing.id));

    log.info({ organizationId: ctx.organizationId, key, definitionId: existing.id }, "definitionService:deleteDefinition");

    // Publish SSE event
    await ctx.publisher.mindstate.definitionDeleted(
      { organizationId: ctx.organizationId, performedBy: performedBy ?? "system" },
      { definitionId: existing.id, definitionKey: existing.key, definitionName: existing.name }
    );

    return true;
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, key, err: serializeError(error) }, "definitionService:deleteDefinition:error");
    throw error;
  }
}

/**
 * Ensure default mindstate definition exists for an organization
 * Creates the "Default Companion" mindstate if it doesn't exist
 */
export async function ensureDefaultMindstate(ctx: MindstateServiceContext): Promise<boolean> {
  try {
    const existing = await getDefinition(ctx, DEFAULT_MINDSTATE_CONFIG.key);
    if (existing) {
      log.debug({ organizationId: ctx.organizationId }, "definitionService:ensureDefault:exists");
      return false;
    }

    await createDefinition(ctx, DEFAULT_MINDSTATE_CONFIG);

    log.info({ organizationId: ctx.organizationId }, "definitionService:ensureDefault:created");
    return true;
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, err: serializeError(error) }, "definitionService:ensureDefault:error");
    throw error;
  }
}
