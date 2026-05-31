/**
 * Users Routes
 *
 * API for viewing channel users and their sessions.
 * These are end-users who interact with journeys via messaging platforms.
 *
 * @module modules/users/routes
 */

import { z } from "zod";
import { createLogger } from "@journey/logger";
import { NotFoundError, ServiceUnavailableError } from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateQuery } from "../../../lib/zod-validator";
import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET } from "../../../lib/query-helpers";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:users");

const users = createProtectedRouter({
  defaultPermission: { resource: "client", action: "read" },
});

const ACTIVITY_MAX_RESULTS = 200;

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

const ListUsersQuerySchema = z.object({
  journeyId: z.string().optional(),
  tags: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).optional().default(0),
});

const UserActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(ACTIVITY_MAX_RESULTS).optional().default(ACTIVITY_MAX_RESULTS),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /users/tags - Get all unique tags across all channel users
 *
 * Returns a list of all unique tags used for filtering.
 */
users.get("/tags", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const tags = await services.tag.getAllUniqueTagsForOrganization();

  log.debug({ userId: user.id, organizationId: organization.id, tagCount: tags.length }, "users:tags:success");

  return c.json({ tags });
});

/**
 * GET /users - List all channel users
 *
 * Lists all users who have interacted with journeys in the current organisation.
 *
 * Query params:
 * - journeyId: Filter by specific journey (optional)
 * - tags: Comma-separated list of tags to filter by (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
users.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, ListUsersQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }
  const { journeyId, tags, limit, offset } = queryResult.data;

  const filterTags = tags
    ? tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const result = await services.user.listOrganizationUsers({
    organizationId: organization.id,
    journeyId,
    tags: filterTags,
    limit,
    offset,
  });

  log.debug(
    {
      userId: user.id,
      organizationId: organization.id,
      count: result.users.length,
      total: result.total,
      journeyId,
      filterTags,
    },
    "users:list:success"
  );

  return c.json({
    users: result.users,
    total: result.total,
  });
});

/**
 * GET /users/:userId/sessions - Get all sessions for a specific user
 *
 * Returns all sessions for a channel user that belong to journeys
 * in the current organisation.
 */
users.get("/:userId/sessions", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const clientId = c.req.param("userId");

  const sessions = await services.user.listUserSessions(organization.id, clientId);

  log.debug({ userId: user.id, organizationId: organization.id, clientId, count: sessions.length }, "users:sessions:success");

  return c.json({ sessions });
});

/**
 * GET /users/:userId/activity - Unified activity timeline for a user
 *
 * Combines session lifecycle markers with interaction events (messages, node transitions, etc.)
 * and computes time deltas within each session for debugging journeys.
 */
users.get("/:userId/activity", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const clientId = c.req.param("userId");

  const queryResult = validateQuery(c, UserActivityQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  const activities = await services.user.listUserActivity({
    organizationId: organization.id,
    clientId,
    limit: queryResult.data.limit,
    offset: queryResult.data.offset,
  });

  log.debug(
    { userId: user.id, organizationId: organization.id, clientId, total: activities.length },
    "users:activity:success"
  );

  return c.json({ activities });
});

/**
 * DELETE /users/:userId - Delete a channel user and all their data
 *
 * Deletes the user and all associated sessions, interactions, and timers
 * (cascade deleted via FK constraints).
 * Only allowed if the organisation has at least one journey
 * where this channel user has sessions.
 */
users.delete(
  "/:userId",
  protect({ permission: { resource: "client", action: "delete" } }),
  async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

    const clientId = c.req.param("userId");

  const hasSessions = await services.user.userHasSessionsInOrg(organization.id, clientId);
    if (!hasSessions) {
      throw new NotFoundError("User", clientId);
    }

  const deleted = await services.channel.deleteChannelUser(clientId);

    if (!deleted) {
      throw new ServiceUnavailableError("Failed to delete user");
    }

    log.info({ userId: user.id, organizationId: organization.id, clientId }, "users:delete:success");

    return c.json({
      success: true,
      message: "User and all associated data deleted",
    });
  }
);

export { users as usersRoutes };
