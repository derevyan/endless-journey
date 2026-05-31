/**
 * Workflow Version Routes
 *
 * API for workflow version history, scoped to organizations.
 * Versions store snapshots of workflow configurations for restore/audit.
 *
 * @module modules/workflows/routes/versions
 */

import { createLogger } from "@journey/logger";
import { SaveWorkflowVersionInputSchema, AtomicWorkflowSaveInputSchema, NotFoundError } from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:workflow-versions");

const workflowVersions = createProtectedRouter({
  defaultPermission: { resource: "workflowVersion", action: "read" },
});

/**
 * GET /workflows/:key/versions - List all versions for a workflow
 */
workflowVersions.get("/:key/versions", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);
  const workflowKey = c.req.param("key");

  const versions = await services.workflow.listWorkflowVersions(workflowKey);
  log.debug({ userId: user.id, workflowKey, count: versions.length }, "workflowVersions:list");
  return c.json({ versions });
});

/**
 * POST /workflows/:key/versions - Save a new version
 */
workflowVersions.post(
  "/:key/versions",
  protect({ permission: { resource: "workflowVersion", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);
    const workflowKey = c.req.param("key");

    const parseResult = await validateJson(c, SaveWorkflowVersionInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const version = await services.workflow.saveWorkflowVersion(workflowKey, user.id, data);
    log.info({ userId: user.id, workflowKey, versionId: version.versionId }, "workflowVersions:save");
    return c.json({ version }, 201);
  }
);

/**
 * POST /workflows/:key/save - Atomic save (update workflow + create version)
 *
 * Preferred save method that:
 * - Generates version ID server-side (prevents collisions)
 * - Uses database transaction (ensures consistency)
 * - Updates workflow and version in single call (reduces roundtrips)
 */
workflowVersions.post(
  "/:key/save",
  protect({ permission: { resource: "workflowVersion", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);
    const workflowKey = c.req.param("key");

    const parseResult = await validateJson(c, AtomicWorkflowSaveInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const result = await services.workflow.saveVersionAtomic(workflowKey, user.id, parseResult.data);
    log.info({ userId: user.id, workflowKey, versionId: result.versionId }, "workflowVersions:saveAtomic");
    return c.json(result, 201);
  }
);

/**
 * GET /workflows/:key/versions/:versionId - Get a specific version with configuration
 */
workflowVersions.get("/:key/versions/:versionId", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);
  const workflowKey = c.req.param("key");
  const versionId = c.req.param("versionId");

  const versionData = await services.workflow.getWorkflowVersion(workflowKey, versionId);

  if (!versionData) {
    throw new NotFoundError("Version", versionId);
  }

  log.debug({ userId: user.id, workflowKey, versionId }, "workflowVersions:get");
  return c.json(versionData);
});

/**
 * DELETE /workflows/:key/versions/:versionId - Delete a specific version
 */
workflowVersions.delete(
  "/:key/versions/:versionId",
  protect({ permission: { resource: "workflowVersion", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);
    const workflowKey = c.req.param("key");
    const versionId = c.req.param("versionId");

    const deleted = await services.workflow.deleteWorkflowVersion(workflowKey, versionId);

    if (!deleted) {
      throw new NotFoundError("Version", versionId);
    }

    log.info({ userId: user.id, workflowKey, versionId }, "workflowVersions:delete");
    return c.json({ success: true });
  }
);

export { workflowVersions };
