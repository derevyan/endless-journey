/**
 * Journey Version Service
 *
 * CRUD operations for journey version history, scoped to organizations.
 * Versions store snapshots of journey configurations for restore/audit purposes.
 *
 * @module modules/journeys/services/version-service
 */

import type { DbClient } from "@journey/db";
import { journeys, journeyVersions } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, ConflictError, NotFoundError, generateNextVersionId } from "@journey/schemas";
import { isRecord } from "../../../lib/type-guards";
import type {
  AtomicSaveInput,
  JourneyConfig,
  JourneyAtomicSaveResult,
  JourneyVersion,
  SaveVersionInput,
  VersionedJourneyData,
} from "@journey/schemas";
import { and, desc, eq } from "drizzle-orm";
import type { JourneyServiceContext } from "./service-context";

const log = createLogger("journey-version-service");

/**
 * Robust detection of PostgreSQL unique constraint violations.
 * Handles variations in error structure across drivers/wrappers.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  if (!isRecord(error)) return false;

  // Direct code check (standard PostgreSQL error code for unique violation)
  if (error.code === "23505") return true;

  // Check nested cause (some drivers wrap errors)
  if (isRecord(error.cause) && error.cause.code === "23505") return true;

  // Check message pattern as last resort
  if (typeof error.message === "string" && error.message.includes("unique constraint")) return true;

  return false;
}

/**
 * Verify a journey belongs to an organization
 * @returns true if journey exists in org, false otherwise
 */
async function verifyJourneyOwnership(
  db: DbClient,
  journeyId: string,
  organizationId: string
): Promise<boolean> {
  const [journey] = await db
    .select({ id: journeys.id })
    .from(journeys)
    .where(and(eq(journeys.id, journeyId), eq(journeys.organizationId, organizationId)));
  return journey !== undefined;
}

/**
 * Get all versions for a journey (scoped to organization)
 * Returns versions ordered by creation date (newest first)
 */
export async function listVersions(
  ctx: JourneyServiceContext,
  journeyId: string,
  organizationId: string
): Promise<JourneyVersion[]> {
  try {
    // First verify the journey belongs to the organization
    const hasAccess = await verifyJourneyOwnership(ctx.db, journeyId, organizationId);

    if (!hasAccess) {
      log.debug({ journeyId, organizationId }, "journeyVersionService:listVersions:journeyNotFound");
      return [];
    }

    const results = await ctx.db
      .select({
        id: journeyVersions.id,
        journeyId: journeyVersions.journeyId,
        versionId: journeyVersions.versionId,
        notes: journeyVersions.notes,
        createdBy: journeyVersions.createdBy,
        createdAt: journeyVersions.createdAt,
      })
      .from(journeyVersions)
      .where(eq(journeyVersions.journeyId, journeyId))
      .orderBy(desc(journeyVersions.createdAt));

    log.debug({ journeyId, count: results.length }, "journeyVersionService:listVersions");
    return results;
  } catch (error) {
    log.error({ journeyId, organizationId, err: serializeError(error) }, "journeyVersionService:listVersions:error");
    throw error;
  }
}

/**
 * Save a new version of a journey
 * Stores a snapshot of the current journey configuration
 */
export async function saveVersion(
  ctx: JourneyServiceContext,
  journeyId: string,
  organizationId: string,
  userId: string,
  data: SaveVersionInput
): Promise<JourneyVersion> {
  try {
    // First verify the journey belongs to the organization
    const hasAccess = await verifyJourneyOwnership(ctx.db, journeyId, organizationId);

    if (!hasAccess) {
      log.warn({ journeyId, organizationId }, "journeyVersionService:saveVersion:journeyNotFound");
      throw new NotFoundError("Journey", journeyId);
    }

    const [version] = await ctx.db
      .insert(journeyVersions)
      .values({
        journeyId,
        versionId: data.versionId,
        notes: data.notes || null,
        configuration: data.configuration,
        createdBy: userId,
      })
      .returning({
        id: journeyVersions.id,
        journeyId: journeyVersions.journeyId,
        versionId: journeyVersions.versionId,
        notes: journeyVersions.notes,
        createdBy: journeyVersions.createdBy,
        createdAt: journeyVersions.createdAt,
      });

    // Verify insert succeeded
    if (!version) {
      log.error({ journeyId, versionId: data.versionId }, "journeyVersionService:saveVersion:insertFailed");
      throw new BadRequestError("Failed to create version record");
    }

    log.info({ journeyId, versionId: data.versionId, userId }, "journeyVersionService:saveVersion:success");
    return version;
  } catch (error) {
    // Handle unique constraint violation (duplicate versionId for this journey)
    if (isUniqueConstraintViolation(error)) {
      log.warn({ journeyId, versionId: data.versionId }, "journeyVersionService:saveVersion:duplicateVersion");
      throw new ConflictError(`Version ${data.versionId} already exists for this journey`);
    }
    log.error({ journeyId, organizationId, err: serializeError(error) }, "journeyVersionService:saveVersion:error");
    throw error;
  }
}

/**
 * Get a specific version of a journey with full configuration
 */
export async function getVersion(
  ctx: JourneyServiceContext,
  journeyId: string,
  versionId: string,
  organizationId: string
): Promise<VersionedJourneyData | null> {
  try {
    // First verify the journey belongs to the organization
    const hasAccess = await verifyJourneyOwnership(ctx.db, journeyId, organizationId);

    if (!hasAccess) {
      log.debug({ journeyId, organizationId }, "journeyVersionService:getVersion:journeyNotFound");
      return null;
    }

    const results = await ctx.db
      .select({
        id: journeyVersions.id,
        journeyId: journeyVersions.journeyId,
        versionId: journeyVersions.versionId,
        notes: journeyVersions.notes,
        configuration: journeyVersions.configuration,
        createdBy: journeyVersions.createdBy,
        createdAt: journeyVersions.createdAt,
      })
      .from(journeyVersions)
      .where(and(eq(journeyVersions.journeyId, journeyId), eq(journeyVersions.versionId, versionId)));

    if (results.length === 0) {
      log.debug({ journeyId, versionId }, "journeyVersionService:getVersion:notFound");
      return null;
    }

    const result = results[0];
    log.debug({ journeyId, versionId }, "journeyVersionService:getVersion:found");

    return {
      version: {
        id: result.id,
        journeyId: result.journeyId,
        versionId: result.versionId,
        notes: result.notes,
        createdBy: result.createdBy,
        createdAt: result.createdAt!,
      },
      data: result.configuration as JourneyConfig,
    };
  } catch (error) {
    log.error({ journeyId, versionId, organizationId, err: serializeError(error) }, "journeyVersionService:getVersion:error");
    throw error;
  }
}

/**
 * Delete a specific version of a journey
 */
export async function deleteVersion(
  ctx: JourneyServiceContext,
  journeyId: string,
  versionId: string,
  organizationId: string
): Promise<boolean> {
  try {
    // First verify the journey belongs to the organization
    const hasAccess = await verifyJourneyOwnership(ctx.db, journeyId, organizationId);

    if (!hasAccess) {
      log.debug({ journeyId, organizationId }, "journeyVersionService:deleteVersion:journeyNotFound");
      return false;
    }

    const result = await ctx.db
      .delete(journeyVersions)
      .where(and(eq(journeyVersions.journeyId, journeyId), eq(journeyVersions.versionId, versionId)))
      .returning({ id: journeyVersions.id });

    const deleted = result.length > 0;
    if (deleted) {
      log.info({ journeyId, versionId }, "journeyVersionService:deleteVersion:success");
    } else {
      log.debug({ journeyId, versionId }, "journeyVersionService:deleteVersion:notFound");
    }

    return deleted;
  } catch (error) {
    log.error({ journeyId, versionId, organizationId, err: serializeError(error) }, "journeyVersionService:deleteVersion:error");
    throw error;
  }
}

/**
 * Get the next version ID for a journey by querying existing versions
 * @param journeyId - Journey to check versions for
 * @returns Next version ID in format v001, v002, etc.
 */
async function getNextVersionId(db: DbClient, journeyId: string): Promise<string> {
  const versions = await db
    .select({ versionId: journeyVersions.versionId })
    .from(journeyVersions)
    .where(eq(journeyVersions.journeyId, journeyId))
    .orderBy(desc(journeyVersions.createdAt))
    .limit(1);

  const latestVersionId = versions.length > 0 ? versions[0].versionId : null;
  return generateNextVersionId(latestVersionId);
}

/**
 * Atomic save - creates version AND updates journey configuration in a transaction
 *
 * This is the preferred save method as it:
 * 1. Generates version ID server-side (prevents collisions)
 * 2. Uses a transaction (ensures consistency)
 * 3. Updates both version and journey in one call (reduces network roundtrips)
 */
export async function saveVersionAtomic(
  ctx: JourneyServiceContext,
  journeyId: string,
  organizationId: string,
  userId: string,
  data: AtomicSaveInput
): Promise<JourneyAtomicSaveResult> {
  try {
    // First verify the journey belongs to the organization
    const hasAccess = await verifyJourneyOwnership(ctx.db, journeyId, organizationId);

    if (!hasAccess) {
      log.warn({ journeyId, organizationId }, "journeyVersionService:saveVersionAtomic:journeyNotFound");
      throw new NotFoundError("Journey", journeyId);
    }

    // Generate version ID server-side
    const versionId = await getNextVersionId(ctx.db, journeyId);

    // Use transaction to ensure both operations succeed or both fail
    const result = await ctx.db.transaction(async (tx) => {
      // 1. Create version record
      const [version] = await tx
        .insert(journeyVersions)
        .values({
          journeyId,
          versionId,
          notes: data.notes || null,
          configuration: data.configuration,
          createdBy: userId,
        })
        .returning({
          id: journeyVersions.id,
          journeyId: journeyVersions.journeyId,
          versionId: journeyVersions.versionId,
          notes: journeyVersions.notes,
          createdBy: journeyVersions.createdBy,
          createdAt: journeyVersions.createdAt,
        });

      if (!version) {
        throw new BadRequestError("Failed to create version record");
      }

      // 2. Update journey configuration
      await tx
        .update(journeys)
        .set({
          configuration: data.configuration,
          updatedAt: new Date(),
        })
        .where(eq(journeys.id, journeyId));

      return version;
    });

    log.info({ journeyId, versionId, userId }, "journeyVersionService:saveVersionAtomic:success");

    return {
      version: result,
      versionId,
    };
  } catch (error) {
    // Handle unique constraint violation (duplicate versionId - extremely rare due to server-side generation)
    if (isUniqueConstraintViolation(error)) {
      log.warn({ journeyId }, "journeyVersionService:saveVersionAtomic:duplicateVersion");
      throw new ConflictError("Version ID collision - please retry");
    }
    log.error({ journeyId, organizationId, err: serializeError(error) }, "journeyVersionService:saveVersionAtomic:error");
    throw error;
  }
}
