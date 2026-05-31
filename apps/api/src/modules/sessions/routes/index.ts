/**
 * Sessions Routes
 *
 * API for viewing user sessions and activity for the Users Viewer feature.
 *
 * @module modules/sessions/routes
 */

import { z } from "zod";
import { createLogger } from "@journey/logger";
import {
  type JourneyIdOrSlug,
  createJourneyIdOrSlug,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "@journey/schemas";
import { clearSessionEnginesForJourney, clearSessionEngine } from "../../../services/session-cache-service";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET } from "../../../lib/query-helpers";
import { validateQuery } from "../../../lib/zod-validator";
import { appConfig } from "../../../config";
import { createServicesFromContext } from "../../../services";

// Check if we're in development mode
const isDevelopment = appConfig.env.isDevelopment;

const log = createLogger("api:sessions");

function parseJourneyIdOrSlug(value: string): JourneyIdOrSlug {
  try {
    return createJourneyIdOrSlug(value);
  } catch (error) {
    throw new BadRequestError("Invalid journeyId", { journeyId: value }, error);
  }
}

const sessions = createProtectedRouter({
  defaultPermission: { resource: "session", action: "read" },
});

const SessionsListQuerySchema = z.object({
  status: z.enum(["active", "completed", "dropped", "paused"]).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).optional().default(0),
});

/**
 * GET /journeys/:journeyId/sessions - List all sessions for a journey
 *
 * Query params:
 * - status: "active" | "completed" | "dropped" | "paused" (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
sessions.get("/journeys/:journeyId/sessions", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const journeyIdOrSlug = parseJourneyIdOrSlug(c.req.param("journeyId"));

  // Verify user has access to this journey and get actual UUID
  const journey = await services.journey.getJourneyById(journeyIdOrSlug, organization.id);
  if (!journey) {
    throw new NotFoundError("Journey", journeyIdOrSlug);
  }

  const queryResult = validateQuery(c, SessionsListQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }
  const { status, limit, offset } = queryResult.data;

  // Use actual UUID for session lookup
  const sessionsList = await services.channel.getSessionsByJourneyId(journey.id, {
    status,
    limit,
    offset,
  });

  log.debug(
    { userId: user.id, organizationId: organization.id, journeyId: journey.id, count: sessionsList.length },
    "sessions:list:success"
  );

  return c.json({ sessions: sessionsList });
});

/**
 * GET /sessions/:sessionId - Get session detail with interactions
 */
sessions.get("/sessions/:sessionId", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const sessionId = c.req.param("sessionId");

  const session = await services.channel.getSessionWithInteractions(sessionId);

  if (!session) {
    throw new NotFoundError("Session", sessionId);
  }

  // Verify user has access to the journey this session belongs to
  // session.journeyId is always a UUID from the database
  const journey = await services.journey.getJourneyById(parseJourneyIdOrSlug(session.journeyId), organization.id);
  if (!journey) {
    throw new ForbiddenError("Access denied to session");
  }

  log.debug(
    {
      userId: user.id,
      organizationId: organization.id,
      sessionId,
      interactionCount: session.interactions.length,
    },
    "sessions:detail:success"
  );

  return c.json({ session });
});

/**
 * DELETE /sessions/:sessionId - Delete a single session
 *
 * Deletes a session and all its interactions (cascade delete).
 * Available to all users who have access to the journey.
 */
sessions.delete(
  "/sessions/:sessionId",
  protect({ permission: { resource: "session", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const sessionId = c.req.param("sessionId");

    // First get the session to verify access
    const session = await services.channel.getSessionWithInteractions(sessionId);

    if (!session) {
      throw new NotFoundError("Session", sessionId);
    }

    // Verify user has access to the journey this session belongs to
    // session.journeyId is always a UUID from the database
    const journey = await services.journey.getJourneyById(parseJourneyIdOrSlug(session.journeyId), organization.id);
    if (!journey) {
      throw new ForbiddenError("Access denied to session");
    }

    // Clear cached session engine if exists
    await clearSessionEngine(sessionId);

    // Delete from database (interactions + timers cascade-deleted)
    await services.channel.deleteSession(sessionId);

    log.info(
      { userId: user.id, organizationId: organization.id, sessionId, journeyId: session.journeyId },
      "sessions:delete:success"
    );

    return c.json({ success: true });
  }
);

/**
 * DELETE /journeys/:journeyId/sessions - Reset all sessions for a journey (dev only)
 *
 * This endpoint is only available in development mode.
 * It deletes all sessions and their interactions for testing purposes.
 */
sessions.delete(
  "/journeys/:journeyId/sessions",
  protect({ permission: { resource: "session", action: "delete" } }),
  async (c) => {
    // Only allow in development mode
    if (!isDevelopment) {
      throw new ForbiddenError("Not available in production");
    }

    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const journeyIdOrSlug = parseJourneyIdOrSlug(c.req.param("journeyId"));

    // Verify user has access to this journey and get actual UUID
    const journey = await services.journey.getJourneyById(journeyIdOrSlug, organization.id);
    if (!journey) {
      throw new NotFoundError("Journey", journeyIdOrSlug);
    }

    // First clear cached session engines (use actual UUID)
    const clearedEngines = await clearSessionEnginesForJourney(journey.id);

    // Then delete from database (sessions + interactions + timers via cascade)
    const deletedCount = await services.channel.resetJourneySessions(journey.id);

    log.warn(
      { userId: user.id, organizationId: organization.id, journeyId: journey.id, deletedCount, clearedEngines },
      "sessions:reset:success"
    );

    return c.json({
      success: true,
      deletedCount,
      clearedEngines,
    });
  }
);

export { sessions as sessionsRoutes };
