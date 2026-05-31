/**
 * CRM Action Builder
 *
 * Builds CRM action details from interaction events.
 * Tracks pipeline changes, deal updates, and other CRM operations.
 *
 * @module @journey/ai-report/builders/crm-builder
 */

import type { CRMActionDetail, CRMActionType } from "../schemas";
import type { InteractionRecord, NodeInfo } from "./journey-log-builder";

/**
 * Build CRM action details from interaction records.
 *
 * @param interactions - All interaction records
 * @param nodeMap - Node ID to info map
 * @returns Array of CRM action details
 */
export function buildCRMActions(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): CRMActionDetail[] {
  const crmActions: CRMActionDetail[] = [];

  // Filter for CRM-related events
  const crmEvents = interactions.filter(
    (i) =>
      i.eventType === "journey.crm" ||
      i.eventType === "system.crm" ||
      i.eventType === "crm.action"
  );

  for (const interaction of crmEvents) {
    const payload = interaction.payload as Record<string, unknown>;
    const nodeInfo = interaction.nodeId ? nodeMap.get(interaction.nodeId) : undefined;

    // Determine action type from payload
    const actionType = inferActionType(payload);

    crmActions.push({
      timestamp: interaction.timestamp,
      nodeId: interaction.nodeId || "",
      nodeLabel: nodeInfo?.label,

      actionType,
      actionName: (payload.action as string) || (payload.actionName as string) || "unknown",

      pipelineId: payload.pipelineId as string | undefined,
      pipelineName: payload.pipelineName as string | undefined,
      stageId: payload.stageId as string | undefined,
      stageName: payload.stageName as string | undefined,

      dealId: payload.dealId as string | undefined,
      contactId: payload.contactId as string | undefined,

      success: (payload.success as boolean) ?? true,
      message: payload.message as string | undefined,
      errorMessage: payload.error as string | undefined,

      metadata: payload.metadata as Record<string, unknown> | undefined,
    });
  }

  return crmActions;
}

/**
 * Infer CRM action type from payload.
 */
function inferActionType(payload: Record<string, unknown>): CRMActionType {
  const action = ((payload.action as string) || "").toLowerCase();
  const actionName = ((payload.actionName as string) || "").toLowerCase();
  const combined = `${action} ${actionName}`;

  if (combined.includes("pipeline") || combined.includes("stage") || combined.includes("move")) {
    return "pipeline_move";
  }
  if (combined.includes("deal") && combined.includes("create")) {
    return "deal_create";
  }
  if (combined.includes("deal") && (combined.includes("update") || combined.includes("edit"))) {
    return "deal_update";
  }
  if (combined.includes("contact") && combined.includes("create")) {
    return "contact_create";
  }
  if (combined.includes("contact") && (combined.includes("update") || combined.includes("edit"))) {
    return "contact_update";
  }
  if (combined.includes("note")) {
    return "note_add";
  }
  if (combined.includes("task")) {
    return "task_create";
  }

  return "custom";
}
