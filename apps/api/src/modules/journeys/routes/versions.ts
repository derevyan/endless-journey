/**
 * Journey Version Routes
 *
 * API for journey version history, scoped to organizations.
 * Versions store snapshots of journey configurations for restore/audit.
 *
 * @module modules/journeys/routes/versions
 */

import { createLogger } from "@journey/logger";
import { SaveVersionInputSchema, AtomicSaveInputSchema, NotFoundError } from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:journey-versions");

const journeyVersions = createProtectedRouter({
  defaultPermission: { resource: "journeyVersion", action: "read" },
});

/**
 * GET /journeys/:id/versions - List all versions for a journey
 */
journeyVersions.get("/:id/versions", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const journeyId = c.req.param("id");
  const services = createServicesFromContext(c);

  const versions = await services.journey.listVersions(journeyId, organization.id);
  log.debug({ userId: user.id, journeyId, count: versions.length }, "journeyVersions:list");
  return c.json({ versions });
});

/**
 * POST /journeys/:id/versions - Save a new version
 */
journeyVersions.post(
  "/:id/versions",
  protect({ permission: { resource: "journeyVersion", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const journeyId = c.req.param("id");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, SaveVersionInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const version = await services.journey.saveVersion(journeyId, organization.id, user.id, data);
    log.info({ userId: user.id, journeyId, versionId: version.versionId }, "journeyVersions:save");
    return c.json({ version }, 201);
  }
);

/**
 * POST /journeys/:id/save - Atomic save (version + journey update in transaction)
 *
 * Preferred save endpoint that:
 * - Generates version ID server-side (prevents collisions)
 * - Uses transaction for atomicity (both operations succeed or both fail)
 * - Reduces network roundtrips (one call instead of two)
 */
journeyVersions.post(
  "/:id/save",
  protect({ permission: { resource: "journeyVersion", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const journeyId = c.req.param("id");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, AtomicSaveInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const result = await services.journey.saveVersionAtomic(journeyId, organization.id, user.id, data);
    log.info({ userId: user.id, journeyId, versionId: result.versionId }, "journeyVersions:saveAtomic");
    return c.json(result, 201);
  }
);

/**
 * GET /journeys/:id/versions/:versionId - Get a specific version with configuration
 */
journeyVersions.get("/:id/versions/:versionId", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const journeyId = c.req.param("id");
  const versionId = c.req.param("versionId");
  const services = createServicesFromContext(c);

  const versionData = await services.journey.getVersion(journeyId, versionId, organization.id);

  if (!versionData) {
    throw new NotFoundError("Version", versionId);
  }

  log.debug({ userId: user.id, journeyId, versionId }, "journeyVersions:get");
  return c.json(versionData);
});

/**
 * DELETE /journeys/:id/versions/:versionId - Delete a specific version
 */
journeyVersions.delete(
  "/:id/versions/:versionId",
  protect({ permission: { resource: "journeyVersion", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const journeyId = c.req.param("id");
    const versionId = c.req.param("versionId");
    const services = createServicesFromContext(c);

    const deleted = await services.journey.deleteVersion(journeyId, versionId, organization.id);

    if (!deleted) {
      throw new NotFoundError("Version", versionId);
    }

    log.info({ userId: user.id, journeyId, versionId }, "journeyVersions:delete");
    return c.json({ success: true });
  }
);

export { journeyVersions };
