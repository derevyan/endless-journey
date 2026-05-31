/**
 * Prompt Service
 *
 * CRUD operations for prompt definitions.
 *
 * @module modules/prompts/services/prompt-service
 */

import { prompts, promptVersions } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import type {
  CreatePromptInput,
  PromptFilters,
  PromptListResponse,
  PromptResponse,
  PromptVersionResponse,
  UpdatePromptInput,
} from "@journey/schemas";
import { BadRequestError, NotFoundError, PROMPT_SPECIAL_LABELS } from "@journey/schemas";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";

import { normalizeStringArray } from "./prompt-helpers";
import type { PromptServiceContext } from "./service-context";

const log = createLogger("prompt-service");

// =============================================================================
// TYPES
// =============================================================================

type PromptRow = typeof prompts.$inferSelect;
type PromptVersionRow = typeof promptVersions.$inferSelect;

// =============================================================================
// LIST PROMPTS
// =============================================================================

/**
 * List prompts with filtering and pagination
 */
export async function listPrompts(
  ctx: PromptServiceContext,
  filters?: PromptFilters
): Promise<PromptListResponse> {
  const { search, type, tags, isSystem, limit = 50, offset = 0 } = filters ?? {};

  try {
    // Build where conditions
    const conditions = [eq(prompts.organizationId, ctx.organizationId), isNull(prompts.deletedAt)];

    if (type) {
      conditions.push(eq(prompts.type, type));
    }

    if (typeof isSystem === "boolean") {
      conditions.push(eq(prompts.isSystem, isSystem));
    }

    if (search) {
      conditions.push(ilike(prompts.name, `%${search}%`));
    }

    if (tags && tags.length > 0) {
      // Check if any of the search tags are in the prompt's tags array
      conditions.push(sql`${prompts.tags} ?| array[${sql.join(tags.map((t) => sql`${t}`), sql`, `)}]`);
    }

    // Get total count
    const [{ count }] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(prompts)
      .where(and(...conditions));

    // Get prompts with pagination
    const rows = await ctx.db
      .select()
      .from(prompts)
      .where(and(...conditions))
      .orderBy(desc(prompts.updatedAt))
      .limit(limit)
      .offset(offset);

    // Fetch production and latest versions for each prompt
    const promptsWithVersions = await Promise.all(
      rows.map(async (row) => {
        const [productionVersion, latestVersion] = await Promise.all([
          getVersionByLabel(ctx, row.id, PROMPT_SPECIAL_LABELS.PRODUCTION),
          getVersionByLabel(ctx, row.id, PROMPT_SPECIAL_LABELS.LATEST),
        ]);

        return mapPromptToResponse(row, productionVersion, latestVersion);
      })
    );

    log.info({ organizationId: ctx.organizationId, count, filters }, "promptService:listPrompts");

    return {
      prompts: promptsWithVersions,
      total: count,
    };
  } catch (error) {
    log.error({ organizationId: ctx.organizationId, err: serializeError(error) }, "promptService:listPrompts:error");
    throw error;
  }
}

// =============================================================================
// GET PROMPT
// =============================================================================

/**
 * Get a single prompt by name
 */
export async function getPromptByName(ctx: PromptServiceContext, name: string): Promise<PromptResponse> {
  try {
    const [row] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, name), isNull(prompts.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Prompt", name);
    }

    const [productionVersion, latestVersion] = await Promise.all([
      getVersionByLabel(ctx, row.id, PROMPT_SPECIAL_LABELS.PRODUCTION),
      getVersionByLabel(ctx, row.id, PROMPT_SPECIAL_LABELS.LATEST),
    ]);

    log.info({ name, organizationId: ctx.organizationId }, "promptService:getPromptByName");

    return mapPromptToResponse(row, productionVersion, latestVersion);
  } catch (error) {
    log.error({ name, organizationId: ctx.organizationId, err: serializeError(error) }, "promptService:getPromptByName:error");
    throw error;
  }
}

/**
 * Get a single prompt by ID
 */
export async function getPromptById(ctx: PromptServiceContext, id: string): Promise<PromptResponse> {
  try {
    const [row] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.organizationId, ctx.organizationId), isNull(prompts.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Prompt", id);
    }

    const [productionVersion, latestVersion] = await Promise.all([
      getVersionByLabel(ctx, row.id, PROMPT_SPECIAL_LABELS.PRODUCTION),
      getVersionByLabel(ctx, row.id, PROMPT_SPECIAL_LABELS.LATEST),
    ]);

    log.info({ id, organizationId: ctx.organizationId }, "promptService:getPromptById");

    return mapPromptToResponse(row, productionVersion, latestVersion);
  } catch (error) {
    log.error({ id, organizationId: ctx.organizationId, err: serializeError(error) }, "promptService:getPromptById:error");
    throw error;
  }
}

// =============================================================================
// CREATE PROMPT
// =============================================================================

/**
 * Create a new prompt with initial version
 */
export async function createPrompt(
  ctx: PromptServiceContext,
  userId: string,
  input: CreatePromptInput
): Promise<PromptResponse> {
  const { name, description, type, content, tags, isSystem } = input;

  try {
    // Check for duplicate name
    const existing = await ctx.db
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, name), isNull(prompts.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestError(`Prompt with name '${name}' already exists`, { field: "name" });
    }

    // Create prompt and initial version in a transaction
    const result = await ctx.db.transaction(async (tx) => {
      // Create prompt definition
      const [prompt] = await tx
        .insert(prompts)
        .values({
          organizationId: ctx.organizationId,
          name,
          description,
          type,
          tags: tags ?? [],
          isSystem: isSystem ?? false,
          createdBy: userId,
        })
        .returning();

      // Create initial version with "latest" label
      const [version] = await tx
        .insert(promptVersions)
        .values({
          promptId: prompt.id,
          versionId: "v001",
          content,
          labels: [PROMPT_SPECIAL_LABELS.LATEST],
          createdBy: userId,
        })
        .returning();

      return { prompt, version };
    });

    log.info({ promptId: result.prompt.id, name, organizationId: ctx.organizationId, userId }, "promptService:createPrompt");

    return mapPromptToResponse(result.prompt, null, result.version);
  } catch (error) {
    log.error({ name, organizationId: ctx.organizationId, err: serializeError(error) }, "promptService:createPrompt:error");
    throw error;
  }
}

// =============================================================================
// UPDATE PROMPT
// =============================================================================

/**
 * Update prompt metadata (not content - use createVersion for that)
 */
export async function updatePrompt(
  ctx: PromptServiceContext,
  name: string,
  input: UpdatePromptInput
): Promise<PromptResponse> {
  try {
    const [row] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, name), isNull(prompts.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Prompt", name);
    }

    const [updated] = await ctx.db
      .update(prompts)
      .set({
        description: input.description !== undefined ? input.description : row.description,
        tags: input.tags !== undefined ? input.tags : row.tags,
        updatedAt: new Date(),
      })
      .where(eq(prompts.id, row.id))
      .returning();

    const [productionVersion, latestVersion] = await Promise.all([
      getVersionByLabel(ctx, updated.id, PROMPT_SPECIAL_LABELS.PRODUCTION),
      getVersionByLabel(ctx, updated.id, PROMPT_SPECIAL_LABELS.LATEST),
    ]);

    log.info({ promptId: updated.id, name, organizationId: ctx.organizationId }, "promptService:updatePrompt");

    return mapPromptToResponse(updated, productionVersion, latestVersion);
  } catch (error) {
    log.error({ name, organizationId: ctx.organizationId, err: serializeError(error) }, "promptService:updatePrompt:error");
    throw error;
  }
}

// =============================================================================
// DELETE PROMPT
// =============================================================================

/**
 * Soft delete a prompt (sets deletedAt)
 */
export async function deletePrompt(ctx: PromptServiceContext, name: string): Promise<void> {
  try {
    const [row] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, name), isNull(prompts.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Prompt", name);
    }

    await ctx.db
      .update(prompts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(prompts.id, row.id));

    log.info({ promptId: row.id, name, organizationId: ctx.organizationId }, "promptService:deletePrompt");
  } catch (error) {
    log.error({ name, organizationId: ctx.organizationId, err: serializeError(error) }, "promptService:deletePrompt:error");
    throw error;
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Get a version by label
 */
async function getVersionByLabel(
  ctx: PromptServiceContext,
  promptId: string,
  label: string
): Promise<PromptVersionRow | null> {
  const [version] = await ctx.db
    .select()
    .from(promptVersions)
    .where(
      and(
        eq(promptVersions.promptId, promptId),
        sql`${promptVersions.labels} @> ${JSON.stringify([label])}::jsonb`
      )
    )
    .orderBy(desc(promptVersions.createdAt))
    .limit(1);

  return version ?? null;
}

/**
 * Map database row to API response
 */
function mapPromptToResponse(
  row: PromptRow,
  productionVersion: PromptVersionRow | null,
  latestVersion: PromptVersionRow | null
): PromptResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    tags: normalizeStringArray(row.tags),
    isSystem: row.isSystem ?? false,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    productionVersion: productionVersion ? mapVersionToResponse(productionVersion) : null,
    latestVersion: latestVersion ? mapVersionToResponse(latestVersion) : null,
  };
}

/**
 * Map version row to response
 */
function mapVersionToResponse(row: PromptVersionRow): PromptVersionResponse {
  return {
    id: row.id,
    versionId: row.versionId,
    content: row.content,
    labels: normalizeStringArray(row.labels),
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

// Export the mapper for use in version-service
export { mapVersionToResponse };
