/**
 * Shared Node Dimension Utilities for Layout
 *
 * Provides generic utilities for node dimension handling used by
 * both Journey Builder and Agent Workflow Builder.
 *
 * @module shared/lib/ui/node-dimensions
 */

/**
 * Node dimension specification for layout calculations.
 */
export interface NodeDimensions {
  width: number;
  height: number;
}

/**
 * Get dimensions for a specific node type from a dimension map.
 * Falls back to 'default' entry if node type is not found.
 *
 * @param nodeType - The node type to look up
 * @param dimensionMap - Map of node types to dimensions (must include 'default')
 * @returns The dimensions for the node type or the default dimensions
 */
export function getNodeTypeDimensions(
  nodeType: string | undefined,
  dimensionMap: Record<string, NodeDimensions>
): NodeDimensions {
  if (nodeType && dimensionMap[nodeType]) {
    return dimensionMap[nodeType];
  }
  return dimensionMap.default;
}

/**
 * Build a dimension map for a list of nodes using type-based defaults.
 * This is used when React Flow measured dimensions are not available.
 *
 * @param nodes - Array of nodes with id and optional type
 * @param dimensionMap - Map of node types to dimensions (must include 'default')
 * @returns Map of node IDs to their dimensions
 */
export function buildDefaultDimensionMap(
  nodes: Array<{ id: string; type?: string }>,
  dimensionMap: Record<string, NodeDimensions>
): Map<string, NodeDimensions> {
  const map = new Map<string, NodeDimensions>();
  for (const node of nodes) {
    map.set(node.id, getNodeTypeDimensions(node.type, dimensionMap));
  }
  return map;
}
