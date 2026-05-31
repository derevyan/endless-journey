/**
 * Shared Hook Factory for Measuring Node Dimensions
 *
 * Provides access to actual rendered node dimensions from React Flow's internal state.
 * Used by both Journey Builder and Agent Workflow Builder for accurate auto-layout
 * calculations when nodes have variable sizes.
 *
 * @module shared/hooks/use-node-dimensions
 */

import { useCallback } from "react";
import { useReactFlow, useNodesInitialized, type Node, type Edge } from "@xyflow/react";
import type { NodeDimensions } from "@/shared/lib/ui/node-dimensions";

/**
 * Configuration for creating the useNodeDimensions hook.
 */
export interface UseNodeDimensionsConfig {
  /** Default dimensions per node type */
  defaultDimensions: Record<string, NodeDimensions>;
  /** Function to get dimensions for a node type */
  getNodeTypeDimensions: (nodeType: string | undefined) => NodeDimensions;
}

/**
 * Return type for useNodeDimensions hook.
 */
export interface UseNodeDimensionsResult {
  /** Whether all nodes have been measured by React Flow */
  nodesInitialized: boolean;
  /** Get dimensions for a single node by ID */
  getDimensions: (nodeId: string, nodeType?: string) => NodeDimensions;
  /** Get dimensions for all nodes in a list */
  getAllDimensions: (nodes: Array<{ id: string; type?: string }>) => Map<string, NodeDimensions>;
  /** Default dimensions per node type (for reference) */
  defaultDimensions: Record<string, NodeDimensions>;
}

/**
 * Create a useNodeDimensions hook for a specific node/edge type.
 *
 * Uses React Flow's internal measurement system which automatically measures
 * node sizes after they are rendered in the DOM. When measured dimensions
 * are not available (e.g., for newly added nodes), falls back to type-based
 * default dimensions.
 *
 * @example
 * ```typescript
 * // In feature-specific hook file:
 * export const useNodeDimensions = createUseNodeDimensions<JourneyNode, JourneyEdge>({
 *   defaultDimensions: JOURNEY_NODE_DIMENSIONS,
 *   getNodeTypeDimensions,
 * });
 *
 * // In component:
 * const { getAllDimensions, nodesInitialized } = useNodeDimensions();
 * ```
 */
export function createUseNodeDimensions<N extends Node, E extends Edge>(
  config: UseNodeDimensionsConfig
): () => UseNodeDimensionsResult {
  return function useNodeDimensions(): UseNodeDimensionsResult {
    const { getInternalNode } = useReactFlow<N, E>();

    // Returns true when all nodes have been measured by React Flow
    const nodesInitialized = useNodesInitialized();

    /**
     * Get dimensions for a single node.
     * Prefers measured dimensions, falls back to type-based defaults.
     */
    const getDimensions = useCallback(
      (nodeId: string, nodeType?: string): NodeDimensions => {
        const internalNode = getInternalNode(nodeId);

        // Use measured dimensions if available
        if (internalNode?.measured?.width && internalNode?.measured?.height) {
          return {
            width: internalNode.measured.width,
            height: internalNode.measured.height,
          };
        }

        // Fallback to type-based defaults
        return config.getNodeTypeDimensions(nodeType);
      },
      [getInternalNode]
    );

    /**
     * Get dimensions for all nodes in a list.
     * Returns a Map of node ID to dimensions.
     */
    const getAllDimensions = useCallback(
      (nodes: Array<{ id: string; type?: string }>): Map<string, NodeDimensions> => {
        const dimensions = new Map<string, NodeDimensions>();

        for (const node of nodes) {
          dimensions.set(node.id, getDimensions(node.id, node.type));
        }

        return dimensions;
      },
      [getDimensions]
    );

    return {
      nodesInitialized,
      getDimensions,
      getAllDimensions,
      defaultDimensions: config.defaultDimensions,
    };
  };
}
