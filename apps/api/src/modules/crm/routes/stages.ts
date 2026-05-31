/**
 * CRM Stage Routes
 *
 * REST API for pipeline stage management including CRUD operations
 * and reordering.
 *
 * @module modules/crm/routes/stages
 */

import { z } from "zod";
import { createLogger } from "@journey/logger";
import {
  NotFoundError,
  BadRequestError,
  CreateStageInputSchema,
  UpdateStageInputSchema,
  ReorderStagesInputSchema,
} from "@journey/schemas";

import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson, validateQuery } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:crm:stages");

export const stagesRouter = createProtectedRouter({
  defaultPermission: { resource: "crmStage", action: "read" },
});

const ListStagesQuerySchema = z.object({
  pipelineId: z.string().optional(),
});

/**
 * GET /stages - List all pipeline stages
 * Query params: pipelineId (optional) - filter stages by pipeline
 */
stagesRouter.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, ListStagesQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  const { pipelineId } = queryResult.data;
  const stages = await services.crm.getPipelineStages(pipelineId);
  log.debug({ userId: user.id, organizationId: organization.id, pipelineId, count: stages.length }, "crm:stages:list");
  return c.json({ stages });
});

/**
 * POST /stages - Create a new pipeline stage
 */
stagesRouter.post(
  "/",
  protect({ permission: { resource: "crmStage", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateStageInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const stage = await services.crm.createPipelineStage(parseResult.data, user.id);

    log.info({ userId: user.id, organizationId: organization.id, pipelineId: parseResult.data.pipelineId, stageId: stage.id }, "crm:stages:create");
    return c.json({ stage }, 201);
  }
);

/**
 * PUT /stages/reorder - Reorder pipeline stages
 * NOTE: This must come BEFORE /:stageId to avoid matching "reorder" as a stageId
 */
stagesRouter.put(
  "/reorder",
  protect({ permission: { resource: "crmStage", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, ReorderStagesInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const { pipelineId, stageIds } = parseResult.data;
    await services.crm.reorderPipelineStages(pipelineId, stageIds, user.id);
    log.info({ userId: user.id, organizationId: organization.id, pipelineId, count: stageIds.length }, "crm:stages:reorder");
    return c.json({ success: true });
  }
);

/**
 * PUT /stages/:stageId - Update a pipeline stage
 */
stagesRouter.put(
  "/:stageId",
  protect({ permission: { resource: "crmStage", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const stageId = c.req.param("stageId");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateStageInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const stage = await services.crm.updatePipelineStage(stageId, parseResult.data, user.id);

    if (!stage) {
      throw new NotFoundError("Stage", stageId);
    }

    log.info({ userId: user.id, organizationId: organization.id, stageId }, "crm:stages:update");
    return c.json({ stage });
  }
);

/**
 * DELETE /stages/:stageId - Delete a pipeline stage
 */
stagesRouter.delete(
  "/:stageId",
  protect({ permission: { resource: "crmStage", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const stageId = c.req.param("stageId");
    const services = createServicesFromContext(c);

    try {
      const deleted = await services.crm.deletePipelineStage(stageId, user.id);

      if (!deleted) {
        throw new NotFoundError("Stage", stageId);
      }

      log.info({ userId: user.id, organizationId: organization.id, stageId }, "crm:stages:delete");
      return c.json({ success: true });
    } catch (error) {
      // Return 400 for system stage deletion attempts (re-throw as BadRequestError)
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage.includes("system stage")) {
        throw new BadRequestError(errorMessage);
      }
      throw error;
    }
  }
);
