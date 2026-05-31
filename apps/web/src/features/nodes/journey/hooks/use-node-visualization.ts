/**
 * useNodeVisualization - Per-node visualization state hook
 *
 * This hook provides visualization state for a specific node by reading directly
 * from stores, eliminating the need for prop drilling through the component tree.
 *
 * Used by BaseNode to determine:
 * - Selection state (from uiStore)
 * - Edit mode (from uiStore)
 * - Journey path visualization during simulation (from simulatorStore)
 *
 * @module features/nodes/journey/hooks/use-node-visualization
 */

import { EventTypes, type InteractionEvent } from "@journey/schemas";
import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";
import { simulatorStore, selectIsActive } from "@/features/journey/simulator/store";
import { uiStore } from "@/stores/ui-store";

interface TransitionPayload {
  from: string;
  to: string;
  trigger?: string;
}

function isTransitionPayload(payload: unknown): payload is TransitionPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "from" in payload &&
    "to" in payload &&
    typeof (payload as TransitionPayload).from === "string" &&
    typeof (payload as TransitionPayload).to === "string"
  );
}

/**
 * Computes visited nodes map from event log
 * Returns a Map of nodeId -> stepNumber (1-indexed)
 */
function computeVisitedNodes(
  eventLog: InteractionEvent[],
  currentNodeId: string | null
): Map<string, number> {
  const visitedNodes = new Map<string, number>();
  const visitedNodeIds: string[] = [];

  // Extract transition events
  const transitions = eventLog.filter(
    (e) => e.type === EventTypes.ENGINE_TRANSITION && isTransitionPayload(e.payload)
  );

  // Build visited nodes from transitions
  if (transitions.length > 0) {
    const firstPayload = transitions[0].payload as TransitionPayload;
    if (!visitedNodes.has(firstPayload.from)) {
      visitedNodeIds.push(firstPayload.from);
      visitedNodes.set(firstPayload.from, visitedNodeIds.length);
    }

    for (const event of transitions) {
      const payload = event.payload as TransitionPayload;
      if (!visitedNodes.has(payload.to)) {
        visitedNodeIds.push(payload.to);
        visitedNodes.set(payload.to, visitedNodeIds.length);
      }
    }
  }

  // Handle first node before transitions
  if (visitedNodeIds.length === 0 && currentNodeId) {
    visitedNodes.set(currentNodeId, 1);
  }

  // Ensure current node is in visited list
  if (currentNodeId && !visitedNodes.has(currentNodeId)) {
    visitedNodes.set(currentNodeId, visitedNodes.size + 1);
  }

  return visitedNodes;
}

export interface NodeVisualizationState {
  /** Whether this node is currently selected */
  isSelected: boolean;
  /** Whether we're in edit mode */
  isEditMode: boolean;
  /** Whether this node has been visited during simulation */
  isJourneyVisited: boolean;
  /** Whether this node is the current node during simulation */
  isJourneyCurrent: boolean;
  /** Whether this node is a drop-off point */
  isJourneyDropped: boolean;
  /** Step number in the journey path (1-indexed) */
  journeyStep: number | undefined;
}

/**
 * Hook to get visualization state for a specific node.
 *
 * This hook reads directly from stores to determine:
 * - Selection state from uiStore
 * - Edit mode from uiStore
 * - Journey visualization from simulatorStore
 *
 * @param nodeId - The ID of the node to get visualization state for
 * @param nodeData - Optional node data for additional flags (journeyDroppedOff)
 */
export function useNodeVisualization(
  nodeId: string,
  nodeData?: { journeyDroppedOff?: boolean }
): NodeVisualizationState {
  // Read from uiStore
  const selectedNodeId = useStore(uiStore, (s) => s.selectedNodeId);
  const mode = useStore(uiStore, (s) => s.mode);

  // Read from simulatorStore - use granular selectors to minimize re-renders
  const isActive = useStore(simulatorStore, selectIsActive);
  const currentNodeId = useStore(simulatorStore, (s) => s.session?.currentNodeId ?? null);
  const eventLog = useStore(simulatorStore, (s) => s.eventLog);
  // Track event log length for dependency optimization (full array needed for computation)
  const eventLogLength = eventLog.length;

  // Compute visualization state
  return useMemo(() => {
    const isSelected = selectedNodeId === nodeId;
    const isEditMode = mode === "edit";

    // Not in simulator mode - return base state
    if (!isActive) {
      return {
        isSelected,
        isEditMode,
        isJourneyVisited: false,
        isJourneyCurrent: false,
        isJourneyDropped: Boolean(nodeData?.journeyDroppedOff),
        journeyStep: undefined,
      };
    }

    // Compute visited nodes from event log
    const visitedNodes = computeVisitedNodes(eventLog, currentNodeId);
    const isCurrent = currentNodeId === nodeId;
    const stepNumber = visitedNodes.get(nodeId);
    const isVisited = stepNumber !== undefined;

    return {
      isSelected,
      isEditMode,
      isJourneyVisited: isVisited && !isCurrent,
      isJourneyCurrent: isCurrent,
      isJourneyDropped: Boolean(nodeData?.journeyDroppedOff),
      journeyStep: isActive ? stepNumber : undefined,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- eventLogLength is sufficient for recompute control
  }, [
    selectedNodeId,
    nodeId,
    mode,
    isActive,
    currentNodeId,
    // Use eventLogLength as dependency instead of eventLog array to prevent
    // re-computation when array reference changes but length is same.
    // The eventLog is still accessed inside useMemo for computation.
    eventLogLength,
    nodeData?.journeyDroppedOff,
  ]);
}
