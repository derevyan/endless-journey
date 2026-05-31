/**
 * CRM Middleware
 *
 * Processes CRM pipeline/stage updates configured on journey nodes.
 * Runs after the node handler completes to update client CRM position.
 */

import { createLogger, serializeError } from "@journey/logger";
import { EventTypes, type CrmAction } from "@journey/schemas";
import type { Middleware, MiddlewareDefinition } from "../types";
import { MIDDLEWARE_PRIORITIES } from "../priorities";

const log = createLogger("crm-middleware");

/**
 * CRM middleware factory
 *
 * Creates a middleware that processes CRM position updates.
 * CRM operations are non-blocking - errors are logged but don't stop the pipeline.
 */
export function createCrmMiddleware(): Middleware {
  return async (node, context, _result, next) => {
    const { services, session } = context;

    // Null check: node.data may be undefined
    if (!node.data) {
      log.trace({ nodeId: node.id }, "crmMiddleware:skip:noNodeData");
      await next();
      return;
    }

    const crmAction = node.data.crmAction as CrmAction | undefined;

    if (!crmAction) {
      log.trace({ nodeId: node.id }, "crmMiddleware:skip:noCrmAction");
      await next();
      return;
    }

    const { pipelineId, stageId, notes } = crmAction;

    // Check if any CRM config is set
    const hasPipeline = pipelineId && pipelineId.trim() !== "";
    const hasStage = stageId && stageId.trim() !== "";

    // Need at least pipeline or stage to do anything
    if (!hasPipeline && !hasStage) {
      log.trace({ nodeId: node.id }, "crmMiddleware:skip:emptyConfig");
      await next();
      return;
    }

    // Get clientId from session.userId
    const clientId = session.userId;
    if (!clientId) {
      log.warn({ nodeId: node.id }, "crmMiddleware:noClientId");
      await next();
      return;
    }

    // Check if CRM service is available (guard clause BEFORE try-catch)
    if (!services.crm) {
      log.warn({ nodeId: node.id }, "crmMiddleware:serviceNotAvailable");
      services.eventLogger.logEvent({
        type: EventTypes.JOURNEY_CRM,
        nodeId: node.id,
        payload: {
          action: "inline_update",
          pipelineId,
          stageId,
          success: false,
          message: "CRM service not available",
        },
      });
      await next();
      return;
    }

    log.debug({ nodeId: node.id, pipelineId, stageId, clientId }, "crmMiddleware:process:start");

    try {

      // Use CRM service to update client position
      await services.crm.updateClientPosition(clientId, pipelineId, stageId, notes);

      // Derive action based on what was requested
      const action = hasStage ? (hasPipeline ? "update" : "stage") : "pipeline";
      const parts: string[] = [];
      if (hasPipeline) parts.push(`pipeline: ${pipelineId}`);
      if (hasStage) parts.push(`stage: ${stageId}`);

      // Log CRM event for simulator console
      services.eventLogger.logEvent({
        type: EventTypes.JOURNEY_CRM,
        nodeId: node.id,
        payload: {
          action: `inline_${action}`,
          pipelineId,
          stageId,
          success: true,
          message: parts.length > 0 ? `Updated CRM: ${parts.join(", ")}` : "CRM position updated",
        },
      });

      log.info({ nodeId: node.id, pipelineId, stageId }, "crmMiddleware:process:complete");
    } catch (error) {
      // CRM errors are non-blocking (same as CRM node behavior)
      log.error({ nodeId: node.id, err: serializeError(error) }, "crmMiddleware:process:error");

      services.eventLogger.logEvent({
        type: EventTypes.JOURNEY_CRM,
        nodeId: node.id,
        payload: {
          action: "inline_update",
          pipelineId,
          stageId,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    await next();
  };
}

/**
 * CRM middleware definition with default priority
 *
 * Priority 50: Side effects (runs after core processing)
 */
export const crmMiddlewareDefinition: MiddlewareDefinition = {
  name: "crm",
  middleware: createCrmMiddleware(),
  priority: MIDDLEWARE_PRIORITIES.CRM,
};
