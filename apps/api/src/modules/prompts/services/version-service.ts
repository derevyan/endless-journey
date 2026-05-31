/**
 * Prompt Version Service
 *
 * Version history and label management for prompts.
 *
 * @module modules/prompts/services/version-service
 */

import { prompts, promptVersions } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, NotFoundError, PROMPT_SPECIAL_LABELS } from "@journey/schemas";
import type { CreateVersionInput, PromptVersionResponse, UpdateLabelsInput } from "@journey/schemas";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { normalizeStringArray } from "./prompt-helpers";
import { mapVersionToResponse } from "./prompt-service";
import type { PromptServiceContext } from "./service-context";

const log = createLogger("version-service");

// =============================================================================
// TYPES
// =============================================================================

type PromptVersionRow = typeof promptVersions.$inferSelect;

// =============================================================================
// LIST VERSIONS
// =============================================================================

/**
 * List all versions for a prompt
 */
export async function listVersions(ctx: PromptServiceContext, promptName: string): Promise<PromptVersionResponse[]> {
  try {
    // Get prompt first
    const [prompt] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (!prompt) {
      throw new NotFoundError("Prompt", promptName);
    }

    const versions = await ctx.db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, prompt.id))
      .orderBy(desc(promptVersions.createdAt));

    log.info({ promptName, organizationId: ctx.organizationId, count: versions.length }, "versionService:listVersions");

    return versions.map(mapVersionToResponse);
  } catch (error) {
    log.error({ promptName, organizationId: ctx.organizationId, err: serializeError(error) }, "versionService:listVersions:error");
    throw error;
  }
}

// =============================================================================
// GET VERSION
// =============================================================================

/**
 * Get a specific version by versionId
 */
export async function getVersion(
  ctx: PromptServiceContext,
  promptName: string,
  versionId: string
): Promise<PromptVersionResponse> {
  try {
    const [prompt] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (!prompt) {
      throw new NotFoundError("Prompt", promptName);
    }

    const [version] = await ctx.db
      .select()
      .from(promptVersions)
      .where(and(eq(promptVersions.promptId, prompt.id), eq(promptVersions.versionId, versionId)))
      .limit(1);

    if (!version) {
      throw new NotFoundError("Prompt version", versionId);
    }

    log.info({ promptName, versionId, organizationId: ctx.organizationId }, "versionService:getVersion");

    return mapVersionToResponse(version);
  } catch (error) {
    log.error({ promptName, versionId, organizationId: ctx.organizationId, err: serializeError(error) }, "versionService:getVersion:error");
    throw error;
  }
}

/**
 * Get version by label (production, latest, etc.)
 */
export async function getVersionByLabel(
  ctx: PromptServiceContext,
  promptName: string,
  label: string
): Promise<PromptVersionResponse> {
  try {
    const [prompt] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (!prompt) {
      throw new NotFoundError("Prompt", promptName);
    }

    const [version] = await ctx.db
      .select()
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.promptId, prompt.id),
          sql`${promptVersions.labels} @> ${JSON.stringify([label])}::jsonb`
        )
      )
      .orderBy(desc(promptVersions.createdAt))
      .limit(1);

    if (!version) {
      // Fallback to latest if requested label not found
      if (label === PROMPT_SPECIAL_LABELS.PRODUCTION) {
        log.info({ promptName, organizationId: ctx.organizationId }, "versionService:getVersionByLabel:fallbackToLatest");
        return getVersionByLabel(ctx, promptName, PROMPT_SPECIAL_LABELS.LATEST);
      }
      throw new NotFoundError("Prompt version", `${promptName}@${label}`);
    }

    log.info({ promptName, label, organizationId: ctx.organizationId }, "versionService:getVersionByLabel");

    return mapVersionToResponse(version);
  } catch (error) {
    log.error({ promptName, label, organizationId: ctx.organizationId, err: serializeError(error) }, "versionService:getVersionByLabel:error");
    throw error;
  }
}

// =============================================================================
// CREATE VERSION
// =============================================================================

/**
 * Create a new version for a prompt
 * Automatically assigns "latest" label (removing from previous version)
 */
export async function createVersion(
  ctx: PromptServiceContext,
  promptName: string,
  userId: string,
  input: CreateVersionInput
): Promise<PromptVersionResponse> {
  const { content, labels, notes } = input;

  try {
    // Get prompt
    const [prompt] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (!prompt) {
      throw new NotFoundError("Prompt", promptName);
    }

    // Prepare labels - always include "latest"
    const newLabels = labels ? [...new Set([...labels, PROMPT_SPECIAL_LABELS.LATEST])] : [PROMPT_SPECIAL_LABELS.LATEST];

    // Create version in transaction (atomic version ID generation + label management)
    const version = await ctx.db.transaction(async (tx) => {
      // Get latest version inside transaction to prevent race conditions
      const [latestVersion] = await tx
        .select({ versionId: promptVersions.versionId })
        .from(promptVersions)
        .where(eq(promptVersions.promptId, prompt.id))
        .orderBy(desc(promptVersions.createdAt))
        .limit(1);

      // Generate next version ID (v001, v002, etc.)
      const nextVersionNum = latestVersion ? parseInt(latestVersion.versionId.slice(1), 10) + 1 : 1;
      const newVersionId = `v${nextVersionNum.toString().padStart(3, "0")}`;

      // Remove "latest" label from all existing versions
      await tx.execute(sql`
        UPDATE ${promptVersions}
        SET labels = labels - '${sql.raw(PROMPT_SPECIAL_LABELS.LATEST)}'
        WHERE prompt_id = ${prompt.id}
      `);

      // If adding "production" label, remove it from other versions
      if (newLabels.includes(PROMPT_SPECIAL_LABELS.PRODUCTION)) {
        await tx.execute(sql`
          UPDATE ${promptVersions}
          SET labels = labels - '${sql.raw(PROMPT_SPECIAL_LABELS.PRODUCTION)}'
          WHERE prompt_id = ${prompt.id}
        `);
      }

      // Create new version
      const [created] = await tx
        .insert(promptVersions)
        .values({
          promptId: prompt.id,
          versionId: newVersionId,
          content,
          labels: newLabels,
          notes,
          createdBy: userId,
        })
        .returning();

      // Update prompt's updatedAt
      await tx.update(prompts).set({ updatedAt: new Date() }).where(eq(prompts.id, prompt.id));

      return created;
    });

    log.info({ promptName, versionId: version.versionId, organizationId: ctx.organizationId, userId }, "versionService:createVersion");

    return mapVersionToResponse(version);
  } catch (error) {
    log.error({ promptName, organizationId: ctx.organizationId, err: serializeError(error) }, "versionService:createVersion:error");
    throw error;
  }
}

// =============================================================================
// UPDATE LABELS
// =============================================================================

/**
 * Update labels for a specific version
 * Handles special label logic (moving "production" from other versions)
 */
export async function updateLabels(
  ctx: PromptServiceContext,
  promptName: string,
  versionId: string,
  input: UpdateLabelsInput
): Promise<PromptVersionResponse> {
  const { labels } = input;

  try {
    // Get prompt
    const [prompt] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (!prompt) {
      throw new NotFoundError("Prompt", promptName);
    }

    // Get version
    const [version] = await ctx.db
      .select()
      .from(promptVersions)
      .where(and(eq(promptVersions.promptId, prompt.id), eq(promptVersions.versionId, versionId)))
      .limit(1);

    if (!version) {
      throw new NotFoundError("Prompt version", versionId);
    }

    // Update labels in transaction
    const updated = await ctx.db.transaction(async (tx) => {
      // "latest" is a reserved label - users cannot add/remove it manually
      // Filter it out from user input and preserve current state
      const currentLabels = normalizeStringArray(version.labels);
      const hasLatest = currentLabels.includes(PROMPT_SPECIAL_LABELS.LATEST);
      const userLabels = labels.filter((l) => l !== PROMPT_SPECIAL_LABELS.LATEST);
      const finalLabels = hasLatest ? [...userLabels, PROMPT_SPECIAL_LABELS.LATEST] : userLabels;

      // If adding "production" label, remove it from other versions
      if (finalLabels.includes(PROMPT_SPECIAL_LABELS.PRODUCTION)) {
        await tx.execute(sql`
          UPDATE ${promptVersions}
          SET labels = labels - '${sql.raw(PROMPT_SPECIAL_LABELS.PRODUCTION)}'
          WHERE prompt_id = ${prompt.id} AND id != ${version.id}
        `);
      }

      // Update this version's labels (with preserved "latest" if it had it)
      const [result] = await tx
        .update(promptVersions)
        .set({ labels: finalLabels })
        .where(eq(promptVersions.id, version.id))
        .returning();

      // Update prompt's updatedAt
      await tx.update(prompts).set({ updatedAt: new Date() }).where(eq(prompts.id, prompt.id));

      return result;
    });

    log.info({ promptName, versionId, labels, organizationId: ctx.organizationId }, "versionService:updateLabels");

    return mapVersionToResponse(updated);
  } catch (error) {
    log.error({ promptName, versionId, organizationId: ctx.organizationId, err: serializeError(error) }, "versionService:updateLabels:error");
    throw error;
  }
}

// =============================================================================
// DELETE VERSION
// =============================================================================

/**
 * Delete a specific version (hard delete)
 * Cannot delete if it's the only version
 */
export async function deleteVersion(
  ctx: PromptServiceContext,
  promptName: string,
  versionId: string
): Promise<void> {
  try {
    // Get prompt
    const [prompt] = await ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.organizationId, ctx.organizationId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (!prompt) {
      throw new NotFoundError("Prompt", promptName);
    }

    // Get version count
    const [{ count }] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(promptVersions)
      .where(eq(promptVersions.promptId, prompt.id));

    if (count <= 1) {
      throw new BadRequestError("Cannot delete the only version of a prompt. Delete the prompt instead.");
    }

    // Get version
    const [version] = await ctx.db
      .select()
      .from(promptVersions)
      .where(and(eq(promptVersions.promptId, prompt.id), eq(promptVersions.versionId, versionId)))
      .limit(1);

    if (!version) {
      throw new NotFoundError("Prompt version", versionId);
    }

    // Check if this version has "latest" label - if so, move it to the next most recent
    const versionLabels = normalizeStringArray(version.labels);
    const hasLatest = versionLabels.includes(PROMPT_SPECIAL_LABELS.LATEST);

    await ctx.db.transaction(async (tx) => {
      // Delete the version
      await tx.delete(promptVersions).where(eq(promptVersions.id, version.id));

      // If it had "latest" label, assign to next most recent version
      if (hasLatest) {
        const [nextLatest] = await tx
          .select()
          .from(promptVersions)
          .where(eq(promptVersions.promptId, prompt.id))
          .orderBy(desc(promptVersions.createdAt))
          .limit(1);

        if (nextLatest) {
          const nextLabels = [...new Set([...normalizeStringArray(nextLatest.labels), PROMPT_SPECIAL_LABELS.LATEST])];
          await tx.update(promptVersions).set({ labels: nextLabels }).where(eq(promptVersions.id, nextLatest.id));
        }
      }

      // Update prompt's updatedAt
      await tx.update(prompts).set({ updatedAt: new Date() }).where(eq(prompts.id, prompt.id));
    });

    log.info({ promptName, versionId, organizationId: ctx.organizationId }, "versionService:deleteVersion");
  } catch (error) {
    log.error({ promptName, versionId, organizationId: ctx.organizationId, err: serializeError(error) }, "versionService:deleteVersion:error");
    throw error;
  }
}
