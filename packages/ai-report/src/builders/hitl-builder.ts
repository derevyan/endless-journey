/**
 * HITL Decision Builder
 *
 * Builds Human-in-the-Loop decision details from interaction events.
 * Tracks approval requests, responses, and edits made to LLM outputs.
 *
 * @module @journey/ai-report/builders/hitl-builder
 */

import type { HITLDecisionDetail, HITLDecisionType } from "../schemas";
import type { InteractionRecord, NodeInfo } from "./journey-log-builder";

/**
 * Build HITL decision details from interaction records.
 *
 * @param interactions - All interaction records
 * @param nodeMap - Node ID to info map
 * @returns Array of HITL decision details
 */
export function buildHITLDecisions(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): HITLDecisionDetail[] {
  const decisions: HITLDecisionDetail[] = [];

  // Track pending requests to match with responses
  const pendingRequests = new Map<string, { timestamp: string; nodeId: string; payload: unknown }>();

  for (const interaction of interactions) {
    const payload = interaction.payload as Record<string, unknown>;
    const nodeInfo = interaction.nodeId ? nodeMap.get(interaction.nodeId) : undefined;

    // Handle HITL request events
    if (
      interaction.eventType === "system.hitl" ||
      interaction.eventType === "hitl.requested" ||
      interaction.eventType === "approval.requested"
    ) {
      const requestId = (payload.requestId as string) || interaction.id;
      pendingRequests.set(requestId, {
        timestamp: interaction.timestamp,
        nodeId: interaction.nodeId || "",
        payload,
      });
    }

    // Handle HITL response events
    if (
      interaction.eventType === "hitl.decision" ||
      interaction.eventType === "hitl.response" ||
      interaction.eventType === "approval.response"
    ) {
      const requestId = (payload.requestId as string) || "";
      const request = pendingRequests.get(requestId);
      const requestPayload = request?.payload as Record<string, unknown> | undefined;

      // Calculate response time if we have the original request
      let responseTimeMs: number | undefined;
      if (request) {
        responseTimeMs =
          new Date(interaction.timestamp).getTime() - new Date(request.timestamp).getTime();
        pendingRequests.delete(requestId);
      }

      // Determine decision type
      const decision = inferDecision(payload);

      // Check if args were edited
      const wasEdited =
        (payload.wasEdited as boolean) ||
        (payload.edited as boolean) ||
        (payload.originalArgs !== undefined && payload.editedArgs !== undefined);

      decisions.push({
        timestamp: interaction.timestamp,
        nodeId: interaction.nodeId || request?.nodeId || "",
        nodeLabel: nodeInfo?.label,

        requestId,
        requestedAt: request?.timestamp,

        toolName: (payload.toolName as string) || (requestPayload?.toolName as string),
        actionDescription:
          (payload.actionDescription as string) ||
          (payload.description as string) ||
          (requestPayload?.description as string),

        decision,
        decidedBy: (payload.decidedBy as string) || (payload.userId as string),
        decisionReason: (payload.reason as string) || (payload.message as string),

        wasEdited,
        originalArgs: payload.originalArgs || requestPayload?.args,
        editedArgs: wasEdited ? payload.editedArgs || payload.args : undefined,

        responseTimeMs,
        metadata: payload.metadata as Record<string, unknown> | undefined,
      });
    }
  }

  // Handle any pending requests that never got a response (timeout/cancelled)
  for (const [requestId, request] of pendingRequests) {
    const requestPayload = request.payload as Record<string, unknown>;
    const nodeInfo = request.nodeId ? nodeMap.get(request.nodeId) : undefined;

    decisions.push({
      timestamp: request.timestamp,
      nodeId: request.nodeId,
      nodeLabel: nodeInfo?.label,

      requestId,
      requestedAt: request.timestamp,

      toolName: requestPayload.toolName as string | undefined,
      actionDescription:
        (requestPayload.actionDescription as string) || (requestPayload.description as string),

      decision: "timeout", // No response received
      wasEdited: false,
    });
  }

  return decisions;
}

/**
 * Infer HITL decision type from payload.
 */
function inferDecision(payload: Record<string, unknown>): HITLDecisionType {
  const decision = ((payload.decision as string) || "").toLowerCase();
  const action = ((payload.action as string) || "").toLowerCase();
  const status = ((payload.status as string) || "").toLowerCase();
  const approved = payload.approved as boolean | undefined;

  // Check explicit boolean
  if (approved === true) return "approved";
  if (approved === false) return "rejected";

  // Check string values
  const combined = `${decision} ${action} ${status}`;

  if (combined.includes("approved") || combined.includes("accept")) {
    return "approved";
  }
  if (combined.includes("rejected") || combined.includes("denied") || combined.includes("reject")) {
    return "rejected";
  }
  if (combined.includes("edited") || combined.includes("modified")) {
    return "edited";
  }
  if (combined.includes("timeout") || combined.includes("expired")) {
    return "timeout";
  }
  if (combined.includes("cancelled") || combined.includes("canceled")) {
    return "cancelled";
  }

  // Default to approved if we got a response
  return "approved";
}
