/**
 * Journey Service
 *
 * CRUD operations for journey configurations, scoped to organizations.
 *
 * @module modules/journeys/services/journey-service
 */

import type { DbClient } from "@journey/db";
import { journeys, variables } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import {
  generateSlug,
  // Branded ID types for type-safe UUID vs slug handling
  isJourneyUuid,
  isSlug,
  BadRequestError,
  type JourneyIdOrSlug,
  type JourneyStatus,
  type DeactivationMode,
  type JourneyConfig,
  type JourneyConfigRecord,
  type JourneyDeactivationResult,
  type JourneyMindstateConfig,
} from "@journey/schemas";
import { and, eq, like, or } from "drizzle-orm";

import {
  getActiveSessionsForJourney,
  getPausedSessionsForJourney,
  bulkUpdateSessionStatus,
} from "../../channels/services/session-query-service";
import {
  pauseSessionTimers,
  resumeSessionTimers,
  cancelSessionTimers,
  deleteSessionTimers,
} from "../../../services/timers";
import type { JourneyServiceContext } from "./service-context";

const log = createLogger("journey-service");

// JourneyStatus is imported from @journey/schemas (single source of truth)

/**
 * Get all journeys for an organization
 */
export async function getOrganizationJourneys(
  ctx: JourneyServiceContext,
  organizationId: string
): Promise<JourneyConfigRecord[]> {
  try {
    const results = await ctx.db
      .select()
      .from(journeys)
      .where(eq(journeys.organizationId, organizationId));

    log.debug({ organizationId, count: results.length }, "journeyService:getOrganizationJourneys");
    return results;
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "journeyService:getOrganizationJourneys:error");
    throw error;
  }
}

/**
 * Get a specific journey by ID or slug (if it belongs to organization)
 * Supports both UUID and slug for flexible URL handling
 */
export async function getJourneyById(
  ctx: JourneyServiceContext,
  journeyIdOrSlug: JourneyIdOrSlug,
  organizationId: string
): Promise<JourneyConfigRecord | null> {
  // Use branded type guard for compile-time safety
  const isUUID = isJourneyUuid(journeyIdOrSlug);

  // JourneyIdOrSlug type already guarantees valid format (UUID or slug)
  // This check is kept for defense-in-depth with untyped callers
  if (!isUUID && !isSlug(journeyIdOrSlug)) {
    log.debug({ journeyIdOrSlug, organizationId }, "journeyService:getJourneyById:invalidFormat");
    return null;
  }

  try {
    // First, try to find by ID or slug
    const results = await ctx.db
      .select()
      .from(journeys)
      .where(isUUID ? eq(journeys.id, journeyIdOrSlug) : eq(journeys.slug, journeyIdOrSlug));

    if (results.length === 0) {
      log.debug({ journeyIdOrSlug, organizationId, found: false }, "journeyService:getJourneyById");
      return null;
    }

    const journey = results[0];

    // Check if journey belongs to the organization
    if (journey.organizationId !== organizationId) {
      log.debug(
        { journeyIdOrSlug, organizationId, journeyOrgId: journey.organizationId },
        "journeyService:getJourneyById:wrongOrganization"
      );
      return null;
    }

    log.debug({ journeyIdOrSlug, organizationId, found: true, isUUID }, "journeyService:getJourneyById");
    return journey;
  } catch (error) {
    log.error({ journeyIdOrSlug, organizationId, err: serializeError(error) }, "journeyService:getJourneyById:error");
    throw error;
  }
}

/**
 * Generate a unique slug for a journey within an organization.
 * Uses sequential numbering (test, test-2, test-3) instead of random suffixes.
 */
async function generateUniqueSlug(
  db: DbClient,
  baseSlug: string,
  organizationId: string
): Promise<string> {
  // Find all existing slugs that match the base or are numbered versions
  const existing = await db
    .select({ slug: journeys.slug })
    .from(journeys)
    .where(
      and(
        eq(journeys.organizationId, organizationId),
        or(eq(journeys.slug, baseSlug), like(journeys.slug, `${baseSlug}-%`))
      )
    );

  if (existing.length === 0) {
    return baseSlug; // Base slug is available
  }

  // Build set of existing slugs
  const existingSlugs = new Set(existing.map((e) => e.slug).filter(Boolean));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug; // Base slug is available (only numbered versions exist)
  }

  // Find next available number with bounds check
  const MAX_SLUG_ATTEMPTS = 1000;
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
    if (counter > MAX_SLUG_ATTEMPTS) {
      throw new BadRequestError("Too many journeys with similar names", { baseSlug });
    }
  }

  return `${baseSlug}-${counter}`;
}

/**
 * Create a new journey for an organization
 */
export async function createJourney(
  ctx: JourneyServiceContext,
  organizationId: string,
  userId: string,
  data: {
    name: string;
    description?: string;
    configuration: JourneyConfig;
    defaultPipelineId?: string | null;
  }
): Promise<JourneyConfigRecord> {
  try {
    // Generate a unique slug from the name (sequential: test, test-2, test-3)
    const baseSlug = generateSlug(data.name);
    const slug = await generateUniqueSlug(ctx.db, baseSlug, organizationId);

    // Create the journey config with inline defaultPipelineId
    const [newJourney] = await ctx.db
      .insert(journeys)
      .values({
        slug,
        name: data.name,
        description: data.description || null,
        status: "draft",
        configuration: data.configuration,
        organizationId,
        defaultPipelineId: data.defaultPipelineId || null,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.info({ journeyId: newJourney.id, slug, organizationId, userId, defaultPipelineId: data.defaultPipelineId }, "journeyService:createJourney");

    // Publish journey.created event
    await ctx.publisher.journey.created(
      { organizationId, performedBy: userId },
      { journeyId: newJourney.id, journeyName: data.name, slug }
    );

    if (!newJourney) {
      throw new BadRequestError("Failed to create journey");
    }

    return newJourney;
  } catch (error) {
    log.error({ organizationId, userId, err: serializeError(error) }, "journeyService:createJourney:error");
    throw error;
  }
}

/**
 * Update a journey (if it belongs to organization)
 * Accepts both UUID and slug for flexible URL handling
 */
export async function updateJourney(
  ctx: JourneyServiceContext,
  journeyId: JourneyIdOrSlug,
  organizationId: string,
  data: {
    name?: string;
    description?: string;
    status?: JourneyStatus;
    configuration?: JourneyConfig;
    defaultPipelineId?: string | null;
    mindstateConfig?: JourneyMindstateConfig | null;
    transferAllowlist?: string[] | null;
  },
  performedBy?: string
): Promise<JourneyConfigRecord | null> {
  try {
    // Check if journey belongs to organization
    const existing = await getJourneyById(ctx, journeyId, organizationId);
    if (!existing) {
      log.warn({ journeyId, organizationId }, "journeyService:updateJourney:notFound");
      return null;
    }

    // Update the journey using the verified ID from existing record
    const [updated] = await ctx.db
      .update(journeys)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.configuration !== undefined && { configuration: data.configuration }),
        ...(data.mindstateConfig !== undefined && { mindstateConfig: data.mindstateConfig }),
        ...(data.transferAllowlist !== undefined && { transferAllowlist: data.transferAllowlist }),
        ...(data.defaultPipelineId !== undefined && { defaultPipelineId: data.defaultPipelineId }),
        updatedAt: new Date(),
      })
      .where(eq(journeys.id, existing.id))
      .returning();

    log.info({ journeyId, organizationId, defaultPipelineId: data.defaultPipelineId }, "journeyService:updateJourney");

    // Publish events
    const eventPerformer = performedBy || "system";
    const eventCtx = { organizationId, performedBy: eventPerformer };

    // Note: Status change events (activated/deactivated) are published by their
    // specialized functions (reactivateJourney/deactivateJourney) which handle
    // session management. updateJourney only updates the DB status.

    // Publish general update event
    const changes: Record<string, unknown> = {};
    if (data.name !== undefined) changes.name = data.name;
    if (data.description !== undefined) changes.description = data.description;
    if (data.status !== undefined) changes.status = data.status;
    if (data.configuration !== undefined) changes.configuration = "updated";
    if (data.defaultPipelineId !== undefined) changes.defaultPipelineId = data.defaultPipelineId;
    if (data.mindstateConfig !== undefined) changes.mindstateConfig = data.mindstateConfig;
    if (data.transferAllowlist !== undefined) changes.transferAllowlist = data.transferAllowlist;

    if (!updated) {
      log.error({ journeyId, organizationId }, "journeyService:updateJourney:missingRecord");
      return null;
    }

    if (Object.keys(changes).length > 0) {
      await ctx.publisher.journey.updated(eventCtx, { journeyId: existing.id, journeyName: updated.name, changes });
    }

    return updated;
  } catch (error) {
    log.error({ journeyId, organizationId, err: serializeError(error) }, "journeyService:updateJourney:error");
    throw error;
  }
}

/**
 * Delete a journey (if it belongs to organization)
 * Supports both UUID and slug
 */
export async function deleteJourney(
  ctx: JourneyServiceContext,
  journeyIdOrSlug: JourneyIdOrSlug,
  organizationId: string,
  performedBy?: string
): Promise<boolean> {
  try {
    // Check if journey belongs to organization
    const existing = await getJourneyById(ctx, journeyIdOrSlug, organizationId);
    if (!existing) {
      log.warn({ journeyIdOrSlug, organizationId }, "journeyService:deleteJourney:notFound");
      return false;
    }

    // Delete journey-scoped variables (no FK cascade)
    await ctx.db
      .delete(variables)
      .where(and(eq(variables.scope, "journey"), eq(variables.ownerId, existing.id)));

    // Delete the journey using the actual UUID
    await ctx.db.delete(journeys).where(eq(journeys.id, existing.id));

    log.info({ journeyId: existing.id, slug: existing.slug, organizationId }, "journeyService:deleteJourney");

    // Publish journey.deleted event
    await ctx.publisher.journey.deleted(
      { organizationId, performedBy: performedBy || "system" },
      { journeyId: existing.id, journeyName: existing.name, slug: existing.slug || existing.id }
    );

    return true;
  } catch (error) {
    log.error({ journeyIdOrSlug, organizationId, err: serializeError(error) }, "journeyService:deleteJourney:error");
    throw error;
  }
}

// =============================================================================
// JOURNEY DEACTIVATION
// =============================================================================

/**
 * Deactivate a journey - handle active sessions based on mode
 *
 * @param journeyIdOrSlug - Journey ID (UUID) or slug
 * @param organizationId - Organization ID for ownership check
 * @param mode - How to handle active sessions:
 *   - "pause": Freeze timers, mark sessions as paused (can resume later)
 *   - "terminate": Cancel all sessions and timers immediately
 *   - "complete": Let sessions finish naturally (just block new sessions via webhook)
 * @param performedBy - User ID who performed the action
 */
export async function deactivateJourney(
  ctx: JourneyServiceContext,
  journeyIdOrSlug: JourneyIdOrSlug,
  organizationId: string,
  mode: DeactivationMode,
  performedBy?: string
): Promise<JourneyDeactivationResult | null> {
  try {
    // Verify journey exists and belongs to organization
    const journey = await getJourneyById(ctx, journeyIdOrSlug, organizationId);
    if (!journey) {
      log.warn({ journeyIdOrSlug, organizationId }, "journeyService:deactivateJourney:notFound");
      return null;
    }

    // Use the actual UUID for session operations
    const activeSessionIds = await getActiveSessionsForJourney(ctx.sessionQueryContext, journey.id);
    let sessionsAffected = 0;
    let timersAffected = 0;

    log.info(
      { journeyId: journey.id, mode, activeSessionCount: activeSessionIds.length },
      "journeyService:deactivateJourney:start"
    );

    // Track errors for partial success reporting
    const timerErrors: Array<{ sessionId: string; error: string }> = [];

    switch (mode) {
      case "pause":
        // Pause all active sessions and their timers
        for (const sessionId of activeSessionIds) {
          try {
            const timerCount = await pauseSessionTimers(sessionId);
            timersAffected += timerCount;
          } catch (error) {
            const serialized = serializeError(error);
            timerErrors.push({ sessionId, error: serialized?.message ?? "Unknown error" });
          }
        }
        sessionsAffected = await bulkUpdateSessionStatus(ctx.sessionQueryContext, activeSessionIds, "paused");
        break;

      case "terminate":
        // Delete all sessions and timers (hard stop)
        for (const sessionId of activeSessionIds) {
          try {
            const timerCount = await deleteSessionTimers(sessionId);
            timersAffected += timerCount;
          } catch (error) {
            const serialized = serializeError(error);
            timerErrors.push({ sessionId, error: serialized?.message ?? "Unknown error" });
          }
        }
        sessionsAffected = await bulkUpdateSessionStatus(ctx.sessionQueryContext, activeSessionIds, "dropped");
        break;

      case "complete":
        // Do nothing to existing sessions - they continue naturally
        // Webhook protection will block new sessions
        sessionsAffected = 0;
        timersAffected = 0;
        break;
    }

    // Log partial failures for monitoring
    if (timerErrors.length > 0) {
      log.warn(
        { journeyId: journey.id, mode, errors: timerErrors, successCount: activeSessionIds.length - timerErrors.length },
        "journeyService:deactivateJourney:partialTimerFailure"
      );
    }

    log.info(
      { journeyId: journey.id, mode, sessionsAffected, timersAffected },
      "journeyService:deactivateJourney:complete"
    );

    // Publish journey.deactivated event
    await ctx.publisher.journey.deactivated(
      { organizationId, performedBy: performedBy || "system" },
      { journeyId: journey.id, journeyName: journey.name, mode, sessionsAffected }
    );

    return { sessionsAffected, timersAffected };
  } catch (error) {
    log.error({ journeyIdOrSlug, organizationId, mode, err: serializeError(error) }, "journeyService:deactivateJourney:error");
    throw error;
  }
}

/**
 * Reactivate a journey - resume paused sessions
 *
 * Called when a journey status changes back to "active".
 * Resumes all paused sessions and their timers.
 *
 * @param journeyIdOrSlug - Journey ID (UUID) or slug
 * @param organizationId - Organization ID for ownership check
 * @param performedBy - User ID who performed the action
 */
export async function reactivateJourney(
  ctx: JourneyServiceContext,
  journeyIdOrSlug: JourneyIdOrSlug,
  organizationId: string,
  performedBy?: string
): Promise<JourneyDeactivationResult | null> {
  try {
    // Verify journey exists and belongs to organization
    const journey = await getJourneyById(ctx, journeyIdOrSlug, organizationId);
    if (!journey) {
      log.warn({ journeyIdOrSlug, organizationId }, "journeyService:reactivateJourney:notFound");
      return null;
    }

    // Use the actual UUID for session operations
    const pausedSessionIds = await getPausedSessionsForJourney(ctx.sessionQueryContext, journey.id);
    let timersAffected = 0;

    log.info(
      { journeyId: journey.id, pausedSessionCount: pausedSessionIds.length },
      "journeyService:reactivateJourney:start"
    );

    // Resume all paused sessions and their timers
    for (const sessionId of pausedSessionIds) {
      const timerCount = await resumeSessionTimers(sessionId);
      timersAffected += timerCount;
    }
    const sessionsAffected = await bulkUpdateSessionStatus(ctx.sessionQueryContext, pausedSessionIds, "active");

    log.info(
      { journeyId: journey.id, sessionsAffected, timersAffected },
      "journeyService:reactivateJourney:complete"
    );

    // Publish journey.activated event
    await ctx.publisher.journey.activated(
      { organizationId, performedBy: performedBy || "system" },
      { journeyId: journey.id, journeyName: journey.name }
    );

    return { sessionsAffected, timersAffected };
  } catch (error) {
    log.error({ journeyIdOrSlug, organizationId, err: serializeError(error) }, "journeyService:reactivateJourney:error");
    throw error;
  }
}
