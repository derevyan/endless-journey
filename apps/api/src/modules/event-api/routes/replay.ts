/**
 * Event Replay API
 *
 * Provides endpoints for fetching historical events for:
 * - Debugging and troubleshooting
 * - Audit trails
 * - State reconstruction
 *
 * @module modules/events/routes/replay
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { ServiceUnavailableError } from "@journey/schemas";

import { createProtectedRouter } from "../../../lib/protected-router";
import { validateQuery } from "../../../lib/zod-validator";
import { buildPaginationMeta } from "../../../lib/query-helpers";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:events-replay");

export const eventsReplayRouter = createProtectedRouter({
  defaultPermission: { resource: "session", action: "read" },
});

// Query params schema
const replayQuerySchema = z.object({
  // Sequence-based replay
  sinceSequence: z.coerce.number().int().nonnegative().optional(),

  // Time-based filtering
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Type filtering (supports wildcards: "crm.*", "journey.session.*")
  types: z
    .string()
    .optional()
    .transform((val) => val?.split(",").map((t) => t.trim())),

  // Context filtering
  clientId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  journeyId: z.string().uuid().optional(),

  // Pagination
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),

  // Ordering
  order: z.enum(["asc", "desc"]).default("asc"),
});

/**
 * GET /api/events/replay
 *
 * Fetch historical events with filtering and pagination.
 *
 * @query sinceSequence - Return events after this sequence number
 * @query startDate - Filter by start timestamp (ISO 8601)
 * @query endDate - Filter by end timestamp (ISO 8601)
 * @query types - Comma-separated event types (supports wildcards: "crm.*")
 * @query clientId - Filter by client ID
 * @query sessionId - Filter by session ID
 * @query journeyId - Filter by journey ID
 * @query limit - Max events to return (default: 100, max: 1000)
 * @query offset - Offset for pagination (default: 0)
 * @query order - Sort order: "asc" (oldest first) or "desc" (newest first)
 */
eventsReplayRouter.get("/replay", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, replayQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  const query = queryResult.data;
  const organizationId = organization.id;

  const requestLog = log.child({ userId: user.id, organizationId });
  requestLog.info(
    {
      sinceSequence: query.sinceSequence,
      types: query.types,
      limit: query.limit,
    },
    "eventsReplay:query"
  );

  try {
    const { events, total } = await services.event.replayEvents({
      organizationId,
      sinceSequence: query.sinceSequence,
      startDate: query.startDate,
      endDate: query.endDate,
      types: query.types,
      clientId: query.clientId,
      sessionId: query.sessionId,
      journeyId: query.journeyId,
      limit: query.limit,
      offset: query.offset,
      order: query.order,
    });

    requestLog.debug(
      {
        resultCount: events.length,
        total,
      },
      "eventsReplay:success"
    );

    return c.json({
      events,
      pagination: buildPaginationMeta(total, query.limit, query.offset, events.length),
    });
  } catch (error) {
    requestLog.error({ err: serializeError(error) }, "eventsReplay:error");
    throw new ServiceUnavailableError("Failed to fetch events");
  }
});

/**
 * GET /api/events/replay/latest
 *
 * Get the latest sequence number for the organization.
 * Useful for clients to know where to start replay from.
 */
eventsReplayRouter.get("/replay/latest", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const organizationId = organization.id;
  const requestLog = log.child({ userId: user.id, organizationId });

  try {
    const latestSequence = await services.event.getLatestReplaySequence(organizationId);

    requestLog.debug({ latestSequence }, "eventsReplay:latest:success");

    return c.json({
      organizationId,
      latestSequence,
    });
  } catch (error) {
    requestLog.error({ err: serializeError(error) }, "eventsReplay:latest:error");
    throw new ServiceUnavailableError("Failed to get latest sequence");
  }
});
