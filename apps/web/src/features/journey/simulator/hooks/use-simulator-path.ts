/**
 * useSimulatorPath - Computes the visited path during simulation
 *
 * This hook subscribes to the simulator store's eventLog and derives:
 * - visitedNodes: Map of nodeId -> stepNumber for all visited nodes
 * - visitedEdgeIds: Set of edge IDs connecting consecutive visited nodes
 */
import { EventTypes, parsePluginId, type InteractionEvent } from "@journey/schemas";
import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";
import type { JourneyEdge } from "@/features/nodes/journey/react-flow-types";
import { PluginButtonEdgeId, PluginExitEdgeId } from "@/features/nodes/journey/utils/plugin-edge-identity";
import { simulatorStore, selectIsActive } from "../store";
import { isTransitionPayload, type TransitionPayload } from "../lib";

export interface SimulatorPath {
  /** Map of nodeId -> step number (1-indexed) */
  visitedNodes: Map<string, number>;
  /** Set of edge IDs that connect consecutive visited nodes */
  visitedEdgeIds: Set<string>;
  /** Ordered list of visited node IDs */
  visitedNodeIds: string[];
  /** Unique key that changes when path changes - useful for React dependencies */
  pathKey: string;
}

/**
 * Computes the visited path from transition events and current node
 */
function computePathFromEvents(
  eventLog: InteractionEvent[],
  edges: JourneyEdge[],
  currentNodeId: string | null,
  pluginToParentMap: Map<string, string>
): SimulatorPath {
  const visitedNodes = new Map<string, number>();
  const visitedEdgeIds = new Set<string>();
  const visitedNodeIds: string[] = [];

  // Extract transition events and build the path
  const transitions = eventLog.filter(
    (e) => e.type === EventTypes.ENGINE_TRANSITION && isTransitionPayload(e.payload)
  );

  // Build visited nodes from transitions
  // First node is the "from" of the first transition
  if (transitions.length > 0) {
    const firstPayload = transitions[0].payload as TransitionPayload;
    if (!visitedNodes.has(firstPayload.from)) {
      visitedNodeIds.push(firstPayload.from);
      visitedNodes.set(firstPayload.from, visitedNodeIds.length);
    }

    // Add all "to" nodes from transitions
    for (const event of transitions) {
      const payload = event.payload as TransitionPayload;
      if (!visitedNodes.has(payload.to)) {
        visitedNodeIds.push(payload.to);
        visitedNodes.set(payload.to, visitedNodeIds.length);
      }
    }
  }

  // If no transitions yet but we have a current node, add it as step 1
  // This handles the first node before any transitions occur
  if (visitedNodeIds.length === 0 && currentNodeId) {
    visitedNodeIds.push(currentNodeId);
    visitedNodes.set(currentNodeId, 1);
  }

  // Also ensure current node is always in the visited list
  // (handles the case where we're at a node but no transition to it yet)
  if (currentNodeId && !visitedNodes.has(currentNodeId)) {
    visitedNodeIds.push(currentNodeId);
    visitedNodes.set(currentNodeId, visitedNodeIds.length);
  }

  // Helper: Get effective source for an edge (transforms plugin edges to parent node)
  const getEffectiveSource = (edge: JourneyEdge): string => {
    if (PluginButtonEdgeId.is(edge.id) || PluginExitEdgeId.is(edge.id)) {
      const parentId = pluginToParentMap.get(edge.source);
      if (parentId) return parentId;
    }
    return edge.source;
  };

  // Find edges for each transition
  // Use buttonId when available for precise matching (handles multiple edges between same nodes)
  for (const event of transitions) {
    const payload = event.payload as TransitionPayload;
    const fromNodeId = payload.from;
    const toNodeId = payload.to;
    const buttonId = payload.buttonId;

    let edge: JourneyEdge | undefined;

    if (buttonId) {
      // If buttonId is available, find the specific button edge
      // Button edges have ID format: managed-btn::nodeId::buttonId or plugin-btn::pluginId::stepIdx::buttonId
      edge = edges.find(
        (e) =>
          e.id.endsWith(buttonId) &&
          getEffectiveSource(e) === fromNodeId &&
          e.target === toNodeId
      );
    } else {
      // Fallback: find any edge connecting these nodes (may match wrong edge if multiple exist)
      edge = edges.find(
        (e) => getEffectiveSource(e) === fromNodeId && e.target === toNodeId
      );
    }

    if (edge) {
      visitedEdgeIds.add(edge.id);
    }
  }

  // Create a stable key for React dependency tracking
  const pathKey = visitedNodeIds.join(",") || "empty";

  return {
    visitedNodes,
    visitedEdgeIds,
    visitedNodeIds,
    pathKey,
  };
}

/**
 * Hook to get the current simulation path
 * Subscribes to the full simulator store state for reliable reactivity
 * @param edges - The edges to search for path connections
 * @returns The computed path with visited nodes and edges
 */
export function useSimulatorPath(edges: JourneyEdge[]): SimulatorPath {
  // Subscribe to the full store state for reliable reactivity
  // Individual selectors can miss updates when arrays are mutated
  const state = useStore(simulatorStore);
  const { eventLog, session, mode, playback } = state;
  const isActive = selectIsActive(state);
  const currentNodeId = session?.currentNodeId ?? null;

  // Get playback state - needed to slice events when in playback mode
  const isPlaybackMode = mode === "playback";
  const playbackIndex = playback?.playbackIndex ?? -1;

  return useMemo(() => {
    if (!isActive) {
      return {
        visitedNodes: new Map(),
        visitedEdgeIds: new Set(),
        visitedNodeIds: [],
        pathKey: "inactive",
      };
    }

    // When in playback mode, only process events up to the current playback position
    // This ensures edges are only highlighted for the path taken so far
    const eventsToProcess = isPlaybackMode && playbackIndex >= 0
      ? eventLog.slice(0, playbackIndex + 1)
      : eventLog;

    // Build plugin to parent map for edge source transformation
    // Plugin edges have source = pluginId (synthetic ID like "node-123-plugin-0")
    // We parse the parentNodeId from the synthetic ID format
    const pluginToParentMap = new Map<string, string>();
    for (const edge of edges) {
      // Parse synthetic plugin IDs to get parent node
      const parsed = parsePluginId(edge.source);
      if (parsed) {
        pluginToParentMap.set(edge.source, parsed.parentNodeId);
      }
    }

    return computePathFromEvents(eventsToProcess, edges, currentNodeId, pluginToParentMap);
  }, [eventLog, edges, isActive, currentNodeId, isPlaybackMode, playbackIndex]);
}
