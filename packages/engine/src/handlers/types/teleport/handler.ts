/**
 * Teleport Node Handler
 *
 * Handles teleport nodes - transfers user to another journey.
 * Marks session as completed with teleport data for the API layer to process.
 *
 * The actual session creation in the target journey is handled by the API layer
 * after detecting the __teleport marker in session context.
 */

import { EventTypes, type TeleportNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../../../types";
import { assertNodeData } from "../../../utils";
import { storeNodeOutput } from "../../../utils/node-outputs";
import { createTimestamp } from "../../../utils/output-helpers";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Handler for teleport nodes
 *
 * Responsibilities:
 * - Validate target journey is different from current
 * - Log teleport event
 * - Mark session as completed with teleport marker
 * - Return complete result (API layer handles actual teleport)
 */
export class TeleportNodeHandler extends BaseNodeHandler<TeleportNodeData> {
  readonly nodeType = "teleport" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { session, node, services, log, stateManager } = context;
    const data = assertNodeData<TeleportNodeData>(node, "teleport");

    // Validate target journey ID is present
    if (!data.targetJourneyId || typeof data.targetJourneyId !== "string" || data.targetJourneyId.trim() === "") {
      log.error({ nodeId: node.id }, "teleport:missingTargetJourneyId");
      services.eventLogger.logEvent({
        type: EventTypes.ENGINE_ERROR,
        nodeId: node.id,
        payload: { message: "Teleport target journey ID is not configured", error: "teleport_missing_target" },
      });
      stateManager.setStatus("error");
      return { action: "complete" };
    }

    // Validate target journey is different
    if (data.targetJourneyId === session.journeyId) {
      log.error({ nodeId: node.id }, "teleport:sameJourneyError");
      services.eventLogger.logEvent({
        type: EventTypes.ENGINE_ERROR,
        nodeId: node.id,
        payload: { message: "Cannot teleport to same journey", error: "teleport_same_journey" },
      });
      // Still complete the session but with error status
      stateManager.setStatus("error");
      return { action: "complete" };
    }

    // Log teleport event
    services.eventLogger.logEvent({
      type: EventTypes.JOURNEY_TELEPORT,
      nodeId: node.id,
      payload: {
        fromJourneyId: session.journeyId,
        toJourneyId: data.targetJourneyId,
        toNodeId: data.targetNodeId,
        preserveContext: data.preserveContext,
      },
    });

    log.info(
      {
        nodeId: node.id,
        targetJourneyId: data.targetJourneyId,
        targetNodeId: data.targetNodeId,
        preserveContext: data.preserveContext,
      },
      "teleport:executing"
    );

    // Store teleport metadata for observability and journey flow tracking
    storeNodeOutput(session, node, {
      teleportedTo: data.targetJourneyId,
      targetNode: data.targetNodeId || null,
      preserveContext: data.preserveContext ?? false,
      fromJourneyId: session.journeyId,
      ...createTimestamp("teleportedAt"),
    }, stateManager);

    // Mark session as completed (API layer will create new session)
    // setStatus("completed") also sets completedAt
    stateManager.setStatus("completed");

    // Store teleport info in session context for API layer to detect
    // The API layer will:
    // 1. Detect __teleport marker
    // 2. Sanitize context (remove userResponse, nodeOutputs, etc.)
    // 3. Create new session in target journey
    // 4. Start engine for new session
    stateManager.updateContext({
      __teleport: {
        targetJourneyId: data.targetJourneyId,
        targetNodeId: data.targetNodeId,
        preserveContext: data.preserveContext,
      },
    });

    return { action: "complete" };
  }
}

export const teleportHandler = new TeleportNodeHandler();
