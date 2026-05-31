/**
 * Workflow Node Dimension Defaults for Layout
 *
 * Provides per-node-type default dimensions for auto-layout calculations.
 * These values match the CSS max-width constraints in workflow-theme.ts.
 *
 * Node Size Tiers:
 * - COMPACT: 140px width (most workflow nodes)
 * - STANDARD: 260px width (agent nodes)
 *
 * @module features/nodes/workflow/lib/node-dimensions
 */

import {
  type NodeDimensions,
  getNodeTypeDimensions as getNodeTypeDimensionsGeneric,
  buildDefaultDimensionMap as buildDefaultDimensionMapGeneric,
} from "@/shared/lib/ui/node-dimensions";

// Re-export the type for convenience
export type { NodeDimensions };

/**
 * Default dimensions per workflow node type.
 *
 * These match the CSS constraints from workflow-theme.ts:
 * - COMPACT (max-w-[140px]): start, end, guard, context, transform, etc.
 * - STANDARD (max-w-[260px]): agent
 */
export const WORKFLOW_NODE_DIMENSIONS: Record<string, NodeDimensions> = {
  // Compact nodes (140px width)
  start: { width: 140, height: 60 },
  end: { width: 140, height: 60 },
  guard: { width: 140, height: 60 },
  context: { width: 140, height: 60 },
  transform: { width: 140, height: 60 },
  set_state: { width: 140, height: 60 },
  if_else: { width: 140, height: 60 },
  user_approval: { width: 140, height: 60 },
  mcp: { width: 140, height: 60 },
  question_understanding: { width: 140, height: 60 },

  // Standard nodes (260px width)
  agent: { width: 260, height: 100 },

  // Default fallback for unknown node types
  default: { width: 140, height: 60 },
};

/**
 * Get dimensions for a specific workflow node type.
 * Falls back to default if node type is not found.
 */
export function getNodeTypeDimensions(nodeType: string | undefined): NodeDimensions {
  return getNodeTypeDimensionsGeneric(nodeType, WORKFLOW_NODE_DIMENSIONS);
}

/**
 * Build a dimension map for a list of workflow nodes using type-based defaults.
 * This is used when React Flow measured dimensions are not available.
 */
export function buildDefaultDimensionMap(
  nodes: Array<{ id: string; type?: string }>
): Map<string, NodeDimensions> {
  return buildDefaultDimensionMapGeneric(nodes, WORKFLOW_NODE_DIMENSIONS);
}
