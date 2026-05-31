/**
 * Hook for Measuring Workflow Node Dimensions
 *
 * Provides access to actual rendered node dimensions from React Flow's internal state.
 * This is used for accurate auto-layout calculations when nodes have variable sizes.
 *
 * Workflow nodes have two size tiers:
 * - COMPACT: 140px width (most nodes)
 * - STANDARD: 260px width (agent nodes)
 *
 * @module features/nodes/workflow/hooks/use-node-dimensions
 */

import { createUseNodeDimensions } from "@/shared/hooks/use-node-dimensions";

import type { WorkflowCanvasNode, WorkflowCanvasEdge } from "@/features/agent-workflows/stores/agent-workflow-store";

import { WORKFLOW_NODE_DIMENSIONS, getNodeTypeDimensions } from "../lib/node-dimensions";

/**
 * Hook that provides access to measured workflow node dimensions.
 *
 * Uses React Flow's internal measurement system which automatically measures
 * node sizes after they are rendered in the DOM. When measured dimensions
 * are not available (e.g., for newly added nodes), falls back to type-based
 * default dimensions.
 *
 * @example
 * ```tsx
 * const { getAllDimensions, nodesInitialized } = useNodeDimensions();
 *
 * const handleLayout = () => {
 *   if (nodesInitialized) {
 *     const dimensions = getAllDimensions(nodes);
 *     applyLayout(nodes, edges, dimensions);
 *   }
 * };
 * ```
 */
export const useNodeDimensions = createUseNodeDimensions<WorkflowCanvasNode, WorkflowCanvasEdge>({
  defaultDimensions: WORKFLOW_NODE_DIMENSIONS,
  getNodeTypeDimensions,
});
