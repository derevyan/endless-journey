/**
 * CRM Node Handler
 *
 * Handles CRM nodes - manages client stages in CRM pipelines.
 * Simplified logic: set pipelineId and/or stageId, engine handles the rest.
 */

import { serializeError } from "@journey/logger";
import { EventTypes, type CrmNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../../../types";
import { EdgeSelector } from "../../../services/edge-selector";
import { assertNodeData, storeNodeOutput } from "../../../utils";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Handler for CRM nodes
 *
 * Simple logic:
 * - If pipelineId set → ensure client is in that pipeline
 * - If stageId set → move to that stage
 * - CRM service figures out if create or move is needed based on current state
 */
export class CrmNodeHandler extends BaseNodeHandler<CrmNodeData> {
  readonly nodeType = "crm" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { session, node, outgoingEdges, services, log, stateManager } = context;
    const crmData = assertNodeData<CrmNodeData>(node, "crm");

    // Filter edges by guards (Smart Edges feature)
    // Use full context (async) for guards referencing vars.*, nodes.*, etc.
    const selector = await EdgeSelector.from(context).withFullContext();
    const { passableEdges } = selector.select(outgoingEdges);

    // Get clientId from session.userId
    // In this system, userId IS the clientId (UUID)
    const clientId = session.userId;
    const { pipelineId, stageId, notes } = crmData;

    log.debug({ nodeId: node.id, pipelineId, stageId, clientId }, "crm:execute:start");

    // Validate clientId is present
    if (!clientId) {
      log.error({ nodeId: node.id, sessionId: session.sessionId }, "crm:execute:noClientId");
      storeNodeOutput(session, node, {
        success: false,
        error: "No client ID available in session",
      }, stateManager);
      services.eventLogger.logEvent({
        type: EventTypes.ENGINE_ERROR,
        nodeId: node.id,
        payload: { message: "No client ID available", error: "No client ID available" },
      });
      if (passableEdges.length > 0) {
        return { action: "transition", targetNodeId: passableEdges[0].target, trigger: "crm_no_client" };
      }
      return { action: "wait" };
    }

    try {
      let result: { success: boolean; message: string } = { success: true, message: "" };

      // Check if CRM service is available
      if (!services.crm) {
        log.warn({ nodeId: node.id }, "crm:execute:serviceNotAvailable");
        result = { success: false, message: "CRM service not available" };
      } else {
        // Simple logic: update client's CRM position
        // Service handles whether to create or move based on current state
        await services.crm.updateClientPosition(clientId, pipelineId, stageId, notes);

        const parts: string[] = [];
        if (pipelineId) parts.push(`pipeline: ${pipelineId}`);
        if (stageId) parts.push(`stage: ${stageId}`);
        result = {
          success: true,
          message: parts.length > 0 ? `Updated CRM: ${parts.join(", ")}` : "CRM position updated"
        };
      }

      // Store result as node output
      storeNodeOutput(session, node, result, stateManager);

      // Derive action based on what was requested
      // update = both pipeline and stage, pipeline = only pipeline, stage = only stage
      const action = stageId ? (pipelineId ? "update" : "stage") : "pipeline";

      // Log CRM event for session interaction history
      services.eventLogger.logEvent({
        type: EventTypes.JOURNEY_CRM,
        nodeId: node.id,
        payload: {
          action,
          pipelineId,
          stageId,
          success: result.success,
          message: result.message,
        },
      });

      // Note: CRM events (crm.stage_changed, crm.pipeline_entered, crm.pipeline_exited)
      // are also published from the CRM service layer for real-time SSE streaming.

      log.info(
        { nodeId: node.id, clientId, pipelineId, stageId, success: result.success },
        "crm:execute:success"
      );

      // Always transition to next node
      if (passableEdges.length > 0) {
        return {
          action: "transition",
          targetNodeId: passableEdges[0].target,
          trigger: "crm_updated",
        };
      }

      return { action: "wait" };
    } catch (error) {
      log.error({ nodeId: node.id, err: serializeError(error) }, "crm:execute:error");

      // Store error as node output
      storeNodeOutput(session, node, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, stateManager);

      // Log error event
      const errorMessage = error instanceof Error ? error.message : String(error);
      services.eventLogger.logEvent({
        type: EventTypes.ENGINE_ERROR,
        nodeId: node.id,
        payload: {
          message: errorMessage,
          pipelineId,
          stageId,
          error: errorMessage,
        },
      });

      // CRM errors are non-blocking - continue to next node
      if (passableEdges.length > 0) {
        return {
          action: "transition",
          targetNodeId: passableEdges[0].target,
          trigger: "crm_error",
        };
      }

      return { action: "wait" };
    }
  }
}

export const crmHandler = new CrmNodeHandler();
