/**
 * Journey Log Builder
 *
 * Builds chronological journey log from interactions.
 *
 * @module @journey/ai-report/builders/journey-log-builder
 */

import type { JourneyLogEntry } from "../schemas";
import { mapEventType } from "./shared";

/**
 * Interaction event from database.
 */
export interface InteractionRecord {
  id: string;
  timestamp: string;
  eventType: string;
  nodeId: string | null;
  payload: unknown;
}

/**
 * Node info for enrichment.
 */
export interface NodeInfo {
  id: string;
  type: string;
  label?: string;
}

/**
 * Generate human-readable description for an event.
 */
function generateDescription(eventType: string, payload: unknown, nodeInfo?: NodeInfo): string {
  const p = payload as Record<string, unknown>;
  const nodeName = nodeInfo?.label || nodeInfo?.id || "unknown node";

  switch (eventType) {
    case "user.message":
      return `User sent message: "${(p.text as string)?.slice(0, 50) || ""}"`;
    case "user.click":
      return `User clicked button "${p.buttonLabel || p.buttonId}"`;
    case "engine.message":
      return `Bot sent message from ${nodeName}`;
    case "engine.transition":
      return `Transition: ${p.from || "start"} → ${p.to} (${p.trigger || "auto"})`;
    case "engine.error":
      return `Error at ${nodeName}: ${p.message}`;
    case "timer.expired":
      return `Timer expired at ${nodeName}`;
    case "session.variables":
      return `Variables updated (${p.operationCount} changes)`;
    case "session.tags":
      return `Tags updated`;
    case "workflow.started":
      return `Agent workflow started at ${nodeName}`;
    case "workflow.completed":
      return `Agent workflow completed at ${nodeName}`;
    default:
      return `Event: ${eventType}`;
  }
}

/**
 * Build journey log entries from interaction records.
 */
export function buildJourneyLog(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): JourneyLogEntry[] {
  return interactions.map((interaction) => {
    const nodeInfo = interaction.nodeId ? nodeMap.get(interaction.nodeId) : undefined;
    const payload = interaction.payload as Record<string, unknown>;

    return {
      id: interaction.id,
      timestamp: interaction.timestamp,
      eventType: mapEventType(interaction.eventType),
      nodeId: interaction.nodeId || "",
      nodeType: nodeInfo?.type || "unknown",
      nodeLabel: nodeInfo?.label,
      payload: interaction.payload,
      description: generateDescription(interaction.eventType, payload, nodeInfo),
    };
  });
}
