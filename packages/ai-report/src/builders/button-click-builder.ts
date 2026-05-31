/**
 * Button Click Builder
 *
 * Builds button click tracking from interactions.
 * Critical for debugging "button clicked but no transition" issues.
 *
 * @module @journey/ai-report/builders/button-click-builder
 */

import type { ButtonClickDetail, UnprocessedEvent, ButtonClickOutcome } from "../schemas";
import type { InteractionRecord, NodeInfo } from "./journey-log-builder";
import { mapButtonOutcomeToUnprocessed } from "./shared";

/**
 * Build button click details from interaction records.
 */
export function buildButtonClicks(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): ButtonClickDetail[] {
  const buttonClicks: ButtonClickDetail[] = [];

  // Filter for click events
  const clickEvents = interactions.filter((i) => i.eventType === "user.click");

  for (const interaction of clickEvents) {
    const payload = interaction.payload as Record<string, unknown>;
    const nodeInfo = interaction.nodeId ? nodeMap.get(interaction.nodeId) : undefined;

    // Extract outcome fields from payload (populated by engine Phase 0 enhancement)
    const outcome = (payload.outcome as ButtonClickOutcome) || "transition_success";
    const activeButtonsAtClick = payload.activeButtonsAtClick as Array<{
      id: string;
      text: string;
      targetNodeId?: string;
      source: "node" | "questionnaire" | "plugin" | "agent";
    }> | undefined;
    const failureReason = payload.failureReason as string | undefined;
    const transitionedToNodeId = payload.transitionedToNodeId as string | undefined;

    // Determine if button was found based on outcome
    const buttonFound = outcome !== "button_not_found";

    buttonClicks.push({
      timestamp: interaction.timestamp,
      clickId: interaction.id,
      buttonId: (payload.buttonId as string) || "",
      buttonLabel: payload.buttonLabel as string | undefined,
      currentNodeId: interaction.nodeId || "",
      currentNodeType: nodeInfo?.type || "unknown",
      currentNodeLabel: nodeInfo?.label,
      buttonFound,
      activeButtonsAtClick,
      outcome,
      transitionedToNodeId,
      transitionedToNodeLabel: transitionedToNodeId
        ? nodeMap.get(transitionedToNodeId)?.label
        : undefined,
      failureReason,
    });
  }

  return buttonClicks;
}

/**
 * Build unprocessed events from button clicks with failed outcomes.
 */
export function buildUnprocessedEvents(
  buttonClicks: ButtonClickDetail[]
): UnprocessedEvent[] {
  const unprocessedEvents: UnprocessedEvent[] = [];

  for (const click of buttonClicks) {
    // Only include failed button clicks
    if (click.outcome === "transition_success" || click.outcome === "agent_reexecute") {
      continue;
    }

    unprocessedEvents.push({
      timestamp: click.timestamp,
      eventId: click.clickId,
      eventType: "user.click",
      currentNodeId: click.currentNodeId,
      sessionStatus: "active",
      expectedAction: `Transition from button '${click.buttonId}'`,
      actualOutcome: mapButtonOutcomeToUnprocessed(click.outcome as ButtonClickOutcome),
      reason: click.failureReason || `Button click with outcome: ${click.outcome}`,
      debugContext: {
        buttonId: click.buttonId,
        buttonLabel: click.buttonLabel,
        activeButtonsCount: click.activeButtonsAtClick?.length || 0,
        outcome: click.outcome,
      },
    });
  }

  return unprocessedEvents;
}
