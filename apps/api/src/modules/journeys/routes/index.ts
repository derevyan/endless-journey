/**
 * Journey Routes
 *
 * CRUD API for journey configurations, scoped to organizations.
 *
 * @module modules/journeys/routes
 */

import { createLogger } from "@journey/logger";
import { CreateJourneyInputSchema, UpdateJourneyInputSchema, NotFoundError, type JourneyIdOrSlug } from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { clearSessionEnginesForJourney } from "../../../services/session-cache-service";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:journeys");

const journeys = createProtectedRouter({
  defaultPermission: { resource: "journey", action: "read" },
});

/**
 * GET /journeys - List all journeys for current organization
 */
journeys.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const orgJourneys = await services.journey.getOrganizationJourneys(organization.id);
  log.debug({ userId: user.id, organizationId: organization.id, count: orgJourneys.length }, "journeys:list");
  return c.json({ journeys: orgJourneys });
});

/**
 * GET /journeys/:id - Get a specific journey
 */
journeys.get("/:id", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const journeyId = c.req.param("id") as JourneyIdOrSlug;
  const services = createServicesFromContext(c);

  const journey = await services.journey.getJourneyById(journeyId, organization.id);

  if (!journey) {
    throw new NotFoundError("Journey", journeyId);
  }

  log.debug({ userId: user.id, organizationId: organization.id, journeyId }, "journeys:get");
  return c.json({ journey });
});

/**
 * GET /journeys/:id/active-sessions-count - Get count of active sessions
 * Used by UI to display warning before deactivation
 */
journeys.get("/:id/active-sessions-count", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const journeyId = c.req.param("id") as JourneyIdOrSlug;
  const services = createServicesFromContext(c);

  // Verify journey exists and belongs to organization
  const journey = await services.journey.getJourneyById(journeyId, organization.id);
  if (!journey) {
    throw new NotFoundError("Journey", journeyId);
  }

  // Use actual UUID for session count lookup
  const count = await services.channel.getActiveSessionCountForJourney(journey.id);
  log.debug({ userId: user.id, journeyId, count }, "journeys:activeSessionsCount");
  return c.json({ count });
});

/**
 * POST /journeys - Create a new journey
 */
journeys.post(
  "/",
  protect({ permission: { resource: "journey", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateJourneyInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const journey = await services.journey.createJourney(organization.id, user.id, {
      name: data.name,
      description: data.description,
      configuration: data.configuration,
      defaultPipelineId: data.defaultPipelineId,
    });

    log.info({ userId: user.id, organizationId: organization.id, journeyId: journey.id }, "journeys:create");
    return c.json({ journey }, 201);
  }
);

/**
 * PUT /journeys/:id - Update a journey
 *
 * When status changes:
 * - FROM "active" to other: accepts optional `deactivationMode` (pause|terminate|complete)
 * - TO "active" from other: automatically resumes paused sessions
 */
journeys.put(
  "/:id",
  protect({ permission: { resource: "journey", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const journeyId = c.req.param("id") as JourneyIdOrSlug;
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateJourneyInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    // Get current journey to detect status changes
    const currentJourney = await services.journey.getJourneyById(journeyId, organization.id);
    if (!currentJourney) {
      throw new NotFoundError("Journey", journeyId);
    }

    const oldStatus = currentJourney.status;
    const newStatus = data.status;

    // Handle deactivation (active -> non-active)
    if (oldStatus === "active" && newStatus && newStatus !== "active") {
      // Validate deactivation mode (already validated by schema, but use default if not provided)
      const mode = data.deactivationMode || "pause";

      const deactivationResult = await services.journey.deactivateJourney(journeyId, organization.id, mode);
      log.info(
        {
          userId: user.id,
          journeyId,
          mode,
          sessionsAffected: deactivationResult?.sessionsAffected,
          timersAffected: deactivationResult?.timersAffected,
        },
        "journeys:deactivate"
      );
    }

    // Handle reactivation (non-active -> active)
    if (oldStatus !== "active" && newStatus === "active") {
      const reactivationResult = await services.journey.reactivateJourney(journeyId, organization.id);
      log.info(
        {
          userId: user.id,
          journeyId,
          sessionsAffected: reactivationResult?.sessionsAffected,
          timersAffected: reactivationResult?.timersAffected,
        },
        "journeys:reactivate"
      );
    }

    // Perform the actual update
    const journey = await services.journey.updateJourney(journeyId, organization.id, {
      name: data.name,
      description: data.description,
      status: data.status,
      configuration: data.configuration,
      defaultPipelineId: data.defaultPipelineId,
      mindstateConfig: data.mindstateConfig,
      transferAllowlist: data.transferAllowlist,
    });

    // Clear cached session engines so they reload fresh config on next interaction
    // Use actual UUID for session engine cache (not slug)
    await clearSessionEnginesForJourney(journey?.id || currentJourney.id);

    if (!journey) {
      throw new NotFoundError("Journey", journeyId);
    }

    log.info({ userId: user.id, organizationId: organization.id, journeyId }, "journeys:update");
    return c.json({ journey });
  }
);

/**
 * DELETE /journeys/:id - Delete a journey
 */
journeys.delete(
  "/:id",
  protect({ permission: { resource: "journey", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const journeyId = c.req.param("id") as JourneyIdOrSlug;
    const services = createServicesFromContext(c);

    const deleted = await services.journey.deleteJourney(journeyId, organization.id);

    if (!deleted) {
      throw new NotFoundError("Journey", journeyId);
    }

    log.info({ userId: user.id, organizationId: organization.id, journeyId }, "journeys:delete");
    return c.json({ success: true });
  }
);

export { journeys };
