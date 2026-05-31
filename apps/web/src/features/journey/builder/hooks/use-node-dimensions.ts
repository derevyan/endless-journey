/**
 * Hook for Measuring Journey Node Dimensions
 *
 * Provides access to actual rendered node dimensions from React Flow's internal state.
 * This is critical for accurate auto-layout calculations, especially when nodes have
 * variable heights due to:
 * - Follow-up plugins (+52px per step)
 * - Media content (+70px for preview)
 * - Multiple buttons
 * - Variable text content
 *
 * @module features/journey/builder/hooks/use-node-dimensions
 */

import { createUseNodeDimensions } from "@/shared/hooks/use-node-dimensions";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";

import { JOURNEY_NODE_DIMENSIONS, getNodeTypeDimensions } from "../lib/node-dimensions";

/**
 * Hook that provides access to measured journey node dimensions.
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
export const useNodeDimensions = createUseNodeDimensions<JourneyNode, JourneyEdge>({
  defaultDimensions: JOURNEY_NODE_DIMENSIONS,
  getNodeTypeDimensions,
});
