/**
 * Mindstate Definition Version Service
 *
 * CRUD operations for mindstate definition version history, scoped to organizations.
 * Versions store snapshots of definition configurations for restore/audit purposes.
 *
 * @module modules/mindstates/services/definition-version-service
 */

import { mindstateDefinitions, mindstateDefinitionVersions } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import {
  AnalysisModeSchema,
  BadRequestError,
  ConflictError,
  NotFoundError,
  generateNextVersionId,
  type AtomicSaveMindstateInput,
  type MindstateDefinitionVersion,
  type MindstateVersionConfig,
  type VersionedMindstateData,
} from "@journey/schemas";
import { and, desc, eq } from "drizzle-orm";

import { getErrorCode } from "../../../lib/db-errors";
import type { MindstateServiceContext } from "./service-context";

const log = createLogger("mindstate-version-service");

function normalizeAnalysisMode(value: unknown): MindstateVersionConfig["analysisMode"] {
  const result = AnalysisModeSchema.safeParse(value);
  return result.success ? result.data : "automatic";
}

function mapVersionRow(row: {
  id: string;
  definitionId: string;
  versionId: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date | null;
}): MindstateDefinitionVersion {
  return {
    id: row.id,
    definitionId: row.definitionId,
    versionId: row.versionId,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt ?? new Date(0),
  };
}

function mapVersionConfig(config: typeof mindstateDefinitionVersions.$inferSelect["configuration"]): MindstateVersionConfig {
  return {
    mainAgentConfig: config.mainAgentConfig,
    defaultAgents: config.defaultAgents,
    defaultParameters: config.defaultParameters,
    analysisMode: normalizeAnalysisMode(config.analysisMode),
    categories: config.categories ?? [],
  };
}

/**
 * Verify a mindstate definition belongs to an organization
 * @returns true if definition exists in org, false otherwise
 */
async function verifyDefinitionOwnership(
  ctx: MindstateServiceContext,
  definitionId: string
): Promise<boolean> {
  const [definition] = await ctx.db
    .select({ id: mindstateDefinitions.id })
    .from(mindstateDefinitions)
    .where(
      and(
        eq(mindstateDefinitions.id, definitionId),
        eq(mindstateDefinitions.organizationId, ctx.organizationId)
      )
    );
  return definition !== undefined;
}

/**
 * Get all versions for a mindstate definition (scoped to organization)
 * Returns versions ordered by creation date (newest first)
 */
export async function listVersions(
  ctx: MindstateServiceContext,
  definitionId: string
): Promise<MindstateDefinitionVersion[]> {
  try {
    // First verify the definition belongs to the organization
    const hasAccess = await verifyDefinitionOwnership(ctx, definitionId);

    if (!hasAccess) {
      log.debug({ definitionId, organizationId: ctx.organizationId }, "mindstateVersionService:listVersions:definitionNotFound");
      return [];
    }

    const results = await ctx.db
      .select({
        id: mindstateDefinitionVersions.id,
        definitionId: mindstateDefinitionVersions.definitionId,
        versionId: mindstateDefinitionVersions.versionId,
        notes: mindstateDefinitionVersions.notes,
        createdBy: mindstateDefinitionVersions.createdBy,
        createdAt: mindstateDefinitionVersions.createdAt,
      })
      .from(mindstateDefinitionVersions)
      .where(eq(mindstateDefinitionVersions.definitionId, definitionId))
      .orderBy(desc(mindstateDefinitionVersions.createdAt));

    log.debug({ definitionId, count: results.length }, "mindstateVersionService:listVersions");
    return results.map(mapVersionRow);
  } catch (error) {
    log.error({ definitionId, organizationId: ctx.organizationId, err: serializeError(error) }, "mindstateVersionService:listVersions:error");
    throw error;
  }
}

/**
 * Get a specific version of a mindstate definition with full configuration
 */
export async function getVersion(
  ctx: MindstateServiceContext,
  definitionId: string,
  versionId: string
): Promise<VersionedMindstateData | null> {
  try {
    // First verify the definition belongs to the organization
    const hasAccess = await verifyDefinitionOwnership(ctx, definitionId);

    if (!hasAccess) {
      log.debug({ definitionId, organizationId: ctx.organizationId }, "mindstateVersionService:getVersion:definitionNotFound");
      return null;
    }

    const results = await ctx.db
      .select({
        id: mindstateDefinitionVersions.id,
        definitionId: mindstateDefinitionVersions.definitionId,
        versionId: mindstateDefinitionVersions.versionId,
        notes: mindstateDefinitionVersions.notes,
        configuration: mindstateDefinitionVersions.configuration,
        createdBy: mindstateDefinitionVersions.createdBy,
        createdAt: mindstateDefinitionVersions.createdAt,
      })
      .from(mindstateDefinitionVersions)
      .where(
        and(
          eq(mindstateDefinitionVersions.definitionId, definitionId),
          eq(mindstateDefinitionVersions.versionId, versionId)
        )
      );

    if (results.length === 0) {
      log.debug({ definitionId, versionId }, "mindstateVersionService:getVersion:notFound");
      return null;
    }

    const result = results[0];
    log.debug({ definitionId, versionId }, "mindstateVersionService:getVersion:found");

    return {
      version: mapVersionRow({
        id: result.id,
        definitionId: result.definitionId,
        versionId: result.versionId,
        notes: result.notes,
        createdBy: result.createdBy,
        createdAt: result.createdAt,
      }),
      data: mapVersionConfig(result.configuration),
    };
  } catch (error) {
    log.error(
      { definitionId, versionId, organizationId: ctx.organizationId, err: serializeError(error) },
      "mindstateVersionService:getVersion:error"
    );
    throw error;
  }
}

/**
 * Delete a specific version of a mindstate definition
 */
export async function deleteVersion(
  ctx: MindstateServiceContext,
  definitionId: string,
  versionId: string
): Promise<boolean> {
  try {
    // First verify the definition belongs to the organization
    const hasAccess = await verifyDefinitionOwnership(ctx, definitionId);

    if (!hasAccess) {
      log.debug({ definitionId, organizationId: ctx.organizationId }, "mindstateVersionService:deleteVersion:definitionNotFound");
      return false;
    }

    const result = await ctx.db
      .delete(mindstateDefinitionVersions)
      .where(
        and(
          eq(mindstateDefinitionVersions.definitionId, definitionId),
          eq(mindstateDefinitionVersions.versionId, versionId)
        )
      )
      .returning({ id: mindstateDefinitionVersions.id });

    const deleted = result.length > 0;
    if (deleted) {
      log.info({ definitionId, versionId }, "mindstateVersionService:deleteVersion:success");
    } else {
      log.debug({ definitionId, versionId }, "mindstateVersionService:deleteVersion:notFound");
    }

    return deleted;
  } catch (error) {
    log.error(
      { definitionId, versionId, organizationId: ctx.organizationId, err: serializeError(error) },
      "mindstateVersionService:deleteVersion:error"
    );
    throw error;
  }
}

/**
 * Result of atomic save operation for mindstate definitions
 */
export interface MindstateAtomicSaveResult {
  /** The saved version metadata */
  version: MindstateDefinitionVersion;
  /** The generated version ID */
  versionId: string;
}

/**
 * Get the next version ID for a mindstate definition by querying existing versions
 * @param definitionId - Definition to check versions for
 * @returns Next version ID in format v001, v002, etc.
 */
async function getNextVersionId(ctx: MindstateServiceContext, definitionId: string): Promise<string> {
  const versions = await ctx.db
    .select({ versionId: mindstateDefinitionVersions.versionId })
    .from(mindstateDefinitionVersions)
    .where(eq(mindstateDefinitionVersions.definitionId, definitionId))
    .orderBy(desc(mindstateDefinitionVersions.createdAt))
    .limit(1);

  const latestVersionId = versions.length > 0 ? versions[0].versionId : null;
  return generateNextVersionId(latestVersionId);
}

/**
 * Atomic save - creates version AND updates definition configuration in a transaction
 *
 * This is the preferred save method as it:
 * 1. Generates version ID server-side (prevents collisions)
 * 2. Uses a transaction (ensures consistency)
 * 3. Updates both version and definition in one call (reduces network roundtrips)
 */
export async function saveVersionAtomic(
  ctx: MindstateServiceContext,
  definitionId: string,
  userId: string,
  data: AtomicSaveMindstateInput
): Promise<MindstateAtomicSaveResult> {
  try {
    // First verify the definition belongs to the organization
    const hasAccess = await verifyDefinitionOwnership(ctx, definitionId);

    if (!hasAccess) {
      log.warn({ definitionId, organizationId: ctx.organizationId }, "mindstateVersionService:saveVersionAtomic:definitionNotFound");
      throw new NotFoundError("Mindstate Definition", definitionId);
    }

    // Generate version ID server-side
    const versionId = await getNextVersionId(ctx, definitionId);

    // Use transaction to ensure both operations succeed or both fail
    const result = await ctx.db.transaction(async (tx) => {
      // 1. Create version record
      const [version] = await tx
        .insert(mindstateDefinitionVersions)
        .values({
          definitionId,
          versionId,
          notes: data.notes || null,
          configuration: data.configuration,
          createdBy: userId,
        })
        .returning({
          id: mindstateDefinitionVersions.id,
          definitionId: mindstateDefinitionVersions.definitionId,
          versionId: mindstateDefinitionVersions.versionId,
          notes: mindstateDefinitionVersions.notes,
          createdBy: mindstateDefinitionVersions.createdBy,
          createdAt: mindstateDefinitionVersions.createdAt,
        });

      if (!version) {
        throw new BadRequestError("Failed to create version record");
      }

      // 2. Update definition configuration
      await tx
        .update(mindstateDefinitions)
        .set({
          mainAgentConfig: data.configuration.mainAgentConfig,
          defaultAgents: data.configuration.defaultAgents,
          defaultParameters: data.configuration.defaultParameters,
          analysisMode: data.configuration.analysisMode,
          categories: data.configuration.categories,
          updatedAt: new Date(),
        })
        .where(eq(mindstateDefinitions.id, definitionId));

      return version;
    });

    log.info({ definitionId, versionId, userId }, "mindstateVersionService:saveVersionAtomic:success");

    return {
      version: mapVersionRow(result),
      versionId,
    };
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      log.warn({ definitionId }, "mindstateVersionService:saveVersionAtomic:duplicateVersion");
      throw new ConflictError("Version ID collision - please retry");
    }
    log.error(
      { definitionId, organizationId: ctx.organizationId, err: serializeError(error) },
      "mindstateVersionService:saveVersionAtomic:error"
    );
    throw error;
  }
}
