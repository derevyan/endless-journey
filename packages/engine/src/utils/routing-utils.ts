/**
 * Routing Utilities
 *
 * Shared routing logic used by message handler and event router.
 * Consolidates duplicated button matching and response type inference.
 */

import type { ButtonConfig, JourneyEdgeData, JourneyNodeData, MessageNodeData, ResponseType } from "@journey/schemas";
import { isTimerEdge } from "./edge-utils";

/**
 * Get effective response type for a message node
 *
 * If not explicitly set, inferred from buttons array:
 * - Has buttons → "buttons"
 * - No buttons → "auto"
 *
 * @param nodeData - Message node data
 * @returns The effective response type
 */
export function getEffectiveResponseType(nodeData: MessageNodeData): ResponseType {
  // Use explicit responseType if set
  if (nodeData.responseType) {
    return nodeData.responseType;
  }
  // Infer from buttons array (per schema docs)
  return nodeData.buttons && nodeData.buttons.length > 0 ? "buttons" : "auto";
}

/**
 * Get response type for any node (generic version)
 *
 * Used by event router for nodes that may not be message nodes.
 * Falls back to "auto" for nodes without responseType.
 *
 * @param node - Any journey node
 * @returns The effective response type
 */
export function getNodeResponseType(node: JourneyNodeData): string {
  const data = node.data as { responseType?: string; buttons?: string[] };
  if (data.responseType) return data.responseType;
  if (data.buttons && data.buttons.length > 0) return "buttons";
  return "auto";
}

/**
 * Find edges that match a button click
 *
 * Two-phase matching:
 * 1. First try managedBy match (button-specific edge created by UI)
 * 2. Fall back to targetNodeId match (direct routing)
 *
 * @param outgoingEdges - All outgoing edges from the node
 * @param buttonId - The clicked button's ID
 * @param targetNodeId - Optional direct target node ID from button config
 * @returns Matching edges for the button
 */
export function getMatchingButtonEdges(
  outgoingEdges: JourneyEdgeData[],
  buttonId: string,
  targetNodeId?: string
): JourneyEdgeData[] {
  // Phase 1: Try managed edge match (button-specific)
  const managedBy = `button-${buttonId}`;
  const managedMatches = outgoingEdges.filter((edge) => edge.managedBy === managedBy);
  if (managedMatches.length > 0) {
    return managedMatches;
  }

  // Phase 2: Fall back to target node match
  if (!targetNodeId) {
    return [];
  }

  return outgoingEdges.filter((edge) => !isTimerEdge(edge) && edge.target === targetNodeId);
}

/**
 * Find edges matching a button config object
 *
 * Convenience wrapper that extracts buttonId and targetNodeId from ButtonConfig.
 *
 * @param outgoingEdges - All outgoing edges from the node
 * @param button - Button configuration object
 * @returns Matching edges for the button
 */
export function getMatchingButtonEdgesFromConfig(
  outgoingEdges: JourneyEdgeData[],
  button: ButtonConfig
): JourneyEdgeData[] {
  return getMatchingButtonEdges(outgoingEdges, button.id, button.targetNodeId);
}

/**
 * Check if a button can be routed based on guard evaluation
 *
 * Validates that:
 * 1. A matching edge exists for the button
 * 2. At least one matching edge passes guards
 *
 * Used by EventRouter and MessageHandler to prevent routing when guards block all paths.
 *
 * @param buttonId - The clicked button's ID
 * @param targetNodeId - Optional direct target node ID from button config
 * @param outgoingEdges - All outgoing edges from the node
 * @param passableEdgeIds - Set of edge IDs that passed guard evaluation
 * @returns True if button can be routed, false if blocked by guards or no edge exists
 */
export function checkButtonGuards(
  buttonId: string,
  targetNodeId: string | undefined,
  outgoingEdges: JourneyEdgeData[],
  passableEdgeIds: Set<string>
): boolean {
  const matches = getMatchingButtonEdges(outgoingEdges, buttonId, targetNodeId);
  if (matches.length === 0) {
    // No matching edge exists - button cannot be routed
    return false;
  }
  // Check if any matching edge passed guards
  return matches.some((edge) => passableEdgeIds.has(edge.id));
}
