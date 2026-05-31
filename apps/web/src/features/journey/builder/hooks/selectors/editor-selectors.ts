/**
 * Granular Editor State Selectors
 *
 * Focused hooks for efficient state subscriptions.
 * Components subscribe only to the state they need.
 *
 * Available selectors:
 * - useEditorMode() - edit mode and pending changes (2 subscriptions)
 * - useEditorSelection() - selected node/edge (4 subscriptions)
 * - useEditorJourneyData() - nodes, edges, journeyId (3 subscriptions)
 * - useEditorVersions() - versions and custom journeys (3 subscriptions)
 *
 * @example
 * // Only re-renders when mode OR selection changes
 * const { selectedNode } = useEditorSelection();
 * const { isEditMode } = useEditorMode();
 */

import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";

import { customJourneyStore } from "@/features/journey/builder/store/custom-journey-store";
import { journeyNodesStore } from "@/stores/journey-nodes-store";
import { uiSelectors, uiStore } from "@/stores/ui-store";
import { versionStore } from "@/stores/version-store";

/**
 * Mode & Edit State Selector
 *
 * Use when you need to check if edit mode is active or track pending changes.
 * 2 store subscriptions instead of 12.
 *
 * @returns { isEditMode, pendingChanges }
 */
export function useEditorMode() {
  const isEditMode = useStore(uiStore, uiSelectors.isEditMode);
  const pendingChanges = useStore(uiStore, (s) => s.pendingChanges);

  return { isEditMode, pendingChanges };
}

/**
 * Selection State Selector
 *
 * Use when you need to work with selected node/edge.
 * Includes derived selectedNode/selectedEdge objects.
 *
 * @returns { selectedNodeId, selectedEdgeId, selectedNode, selectedEdge }
 */
export function useEditorSelection() {
  const selectedNodeId = useStore(uiStore, (s) => s.selectedNodeId);
  const selectedEdgeId = useStore(uiStore, (s) => s.selectedEdgeId);
  const nodes = useStore(journeyNodesStore, (s) => s.nodes);
  const edges = useStore(journeyNodesStore, (s) => s.edges);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [selectedNodeId, nodes]
  );

  const selectedEdge = useMemo(
    () => (selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) ?? null : null),
    [selectedEdgeId, edges]
  );

  return { selectedNodeId, selectedEdgeId, selectedNode, selectedEdge };
}

/**
 * Journey Data Selector
 *
 * Use when you need access to nodes, edges, or journey ID.
 * Best for components that render/process journey content.
 *
 * @returns { nodes, edges, journeyId }
 */
export function useEditorJourneyData() {
  const nodes = useStore(journeyNodesStore, (s) => s.nodes);
  const edges = useStore(journeyNodesStore, (s) => s.edges);
  const journeyId = useStore(journeyNodesStore, (s) => s.journeyId);

  return { nodes, edges, journeyId };
}

/**
 * Version & Custom Journey Selector
 *
 * Use when you need version history or custom journey data.
 * Least commonly needed - only subscribe when actually using this data.
 *
 * @returns { journeyUuid, versions, customJourneys }
 */
export function useEditorVersions() {
  const journeyUuid = useStore(versionStore, (s) => s.journeyUuid);
  const versions = useStore(versionStore, (s) => s.versions);
  const customJourneys = useStore(customJourneyStore, (s) => s.customJourneys);

  return { journeyUuid, versions, customJourneys };
}
