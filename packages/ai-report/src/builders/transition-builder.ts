/**
 * Transition Builder
 *
 * Builds transition details from interactions.
 *
 * @module @journey/ai-report/builders/transition-builder
 */

import type { TransitionDetail } from "../schemas";
import type { InteractionRecord, NodeInfo } from "./journey-log-builder";
import { mapTrigger } from "./shared";

/**
 * Build transition details from interaction records.
 */
export function buildTransitions(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): TransitionDetail[] {
  const transitions: TransitionDetail[] = [];
  let previousTimestamp: Date | null = null;

  // Filter for transition events
  const transitionEvents = interactions.filter((i) => i.eventType === "engine.transition");

  for (const interaction of transitionEvents) {
    const payload = interaction.payload as Record<string, unknown>;
    const fromNodeId = (payload.from as string) || "";
    const toNodeId = (payload.to as string) || "";
    const trigger = payload.trigger as string | undefined;

    const fromNode = fromNodeId ? nodeMap.get(fromNodeId) : undefined;
    const toNode = toNodeId ? nodeMap.get(toNodeId) : undefined;

    const currentTimestamp = new Date(interaction.timestamp);
    const durationAtPreviousNodeMs = previousTimestamp
      ? currentTimestamp.getTime() - previousTimestamp.getTime()
      : undefined;

    transitions.push({
      timestamp: interaction.timestamp,
      fromNodeId: fromNodeId,
      fromNodeType: fromNode?.type || "unknown",
      fromNodeLabel: fromNode?.label,
      toNodeId: toNodeId,
      toNodeType: toNode?.type || "unknown",
      toNodeLabel: toNode?.label,
      trigger: mapTrigger(trigger),
      buttonId: trigger === "button_click" ? (payload.buttonId as string) : undefined,
      buttonLabel: trigger === "button_click" ? (payload.buttonLabel as string) : undefined,
      errorMessage: trigger === "error" ? (payload.errorMessage as string) : undefined,
      durationAtPreviousNodeMs,
    });

    previousTimestamp = currentTimestamp;
  }

  return transitions;
}
