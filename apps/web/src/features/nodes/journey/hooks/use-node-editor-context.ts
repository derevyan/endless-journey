/**
 * Node Editor Context Hook
 *
 * Provides common store values needed by all node editors.
 * Eliminates duplicated useStore calls across editor components.
 */

import { useStore } from "@tanstack/react-store";

import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { journeyNodesStore } from "@/stores/journey-nodes-store";
import { versionStore } from "@/stores/version-store";

export interface NodeEditorContext {
  /** Current journey UUID */
  journeyUuid: string | null;
  /** All nodes in the journey */
  nodes: JourneyNode[];
  /** All edges in the journey */
  edges: JourneyEdge[];
}

/**
 * Hook that provides common context values needed by node editors.
 *
 * Centralizes store access patterns that were previously duplicated
 * across all node editor components.
 *
 * @example
 * ```tsx
 * function MyNodeEditor({ node }: NodeEditorProps) {
 *   const { journeyUuid, nodes, edges } = useNodeEditorContext();
 *   // Use these values for EditorCommonSections, ConditionBuilder, etc.
 * }
 * ```
 */
export function useNodeEditorContext(): NodeEditorContext {
  const journeyUuid = useStore(versionStore, (state) => state.journeyUuid);
  const nodes = useStore(journeyNodesStore, (state) => state.nodes);
  const edges = useStore(journeyNodesStore, (state) => state.edges);

  return {
    journeyUuid,
    nodes,
    edges,
  };
}

