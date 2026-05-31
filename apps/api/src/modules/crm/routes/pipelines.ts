/**
 * CRM Pipeline Routes
 *
 * REST API for pipeline management including CRUD operations,
 * reordering, and setting default pipeline.
 *
 * @module modules/crm/routes/pipelines
 */

import { createLogger } from "@journey/logger";
import {
  NotFoundError,
  CreatePipelineInputSchema,
  UpdatePipelineInputSchema,
  ReorderPipelinesInputSchema,
} from "@journey/schemas";

import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:crm:pipelines");

export const pipelinesRouter = createProtectedRouter({
  defaultPermission: { resource: "crmPipeline", action: "read" },
});

/**
 * GET /pipelines - List all pipelines for the organization
 */
pipelinesRouter.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const pipelines = await services.crm.getPipelines();
  log.debug({ userId: user.id, organizationId: organization.id, count: pipelines.length }, "crm:pipelines:list");
  return c.json({ pipelines });
});

/**
 * POST /pipelines - Create a new pipeline
 */
pipelinesRouter.post(
  "/",
  protect({ permission: { resource: "crmPipeline", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreatePipelineInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const pipeline = await services.crm.createPipeline(parseResult.data, user.id);
    log.info({ userId: user.id, organizationId: organization.id, pipelineId: pipeline.id }, "crm:pipelines:create");
    return c.json({ pipeline }, 201);
  }
);

/**
 * PUT /pipelines/reorder - Reorder pipelines
 * NOTE: This must come BEFORE /:pipelineId to avoid matching "reorder" as a pipelineId
 */
pipelinesRouter.put(
  "/reorder",
  protect({ permission: { resource: "crmPipeline", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, ReorderPipelinesInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    await services.crm.reorderPipelines(parseResult.data.pipelineIds);
    log.info({ userId: user.id, organizationId: organization.id, count: parseResult.data.pipelineIds.length }, "crm:pipelines:reorder");
    return c.json({ success: true });
  }
);

/**
 * GET /pipelines/:pipelineId - Get a single pipeline
 */
pipelinesRouter.get("/:pipelineId", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const pipelineId = c.req.param("pipelineId");
  const services = createServicesFromContext(c);

  const pipeline = await services.crm.getPipeline(pipelineId);

  if (!pipeline) {
    throw new NotFoundError("Pipeline", pipelineId);
  }

  log.debug({ userId: user.id, organizationId: organization.id, pipelineId }, "crm:pipelines:get");
  return c.json({ pipeline });
});

/**
 * PUT /pipelines/:pipelineId - Update a pipeline
 */
pipelinesRouter.put(
  "/:pipelineId",
  protect({ permission: { resource: "crmPipeline", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const pipelineId = c.req.param("pipelineId");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdatePipelineInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const pipeline = await services.crm.updatePipeline(pipelineId, parseResult.data, user.id);

    log.info({ userId: user.id, organizationId: organization.id, pipelineId }, "crm:pipelines:update");
    return c.json({ pipeline });
  }
);

/**
 * PUT /pipelines/:pipelineId/default - Set a pipeline as the default
 */
pipelinesRouter.put(
  "/:pipelineId/default",
  protect({ permission: { resource: "crmPipeline", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const pipelineId = c.req.param("pipelineId");
    const services = createServicesFromContext(c);

    await services.crm.setDefaultPipeline(pipelineId, user.id);
    log.info({ userId: user.id, organizationId: organization.id, pipelineId }, "crm:pipelines:setDefault");
    return c.json({ success: true });
  }
);

/**
 * DELETE /pipelines/:pipelineId - Delete a pipeline
 */
pipelinesRouter.delete(
  "/:pipelineId",
  protect({ permission: { resource: "crmPipeline", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const pipelineId = c.req.param("pipelineId");
    const services = createServicesFromContext(c);

    await services.crm.deletePipeline(pipelineId, user.id);
    log.info({ userId: user.id, organizationId: organization.id, pipelineId }, "crm:pipelines:delete");
    return c.json({ success: true });
  }
);
