/**
 * Journey Visualization Utilities
 *
 * Pure functions for journey visualization on the canvas.
 *
 * @module features/journey/builder/lib/journey-visualization-utils
 */

import { EDGE_CONNECTION_STYLES } from "@/features/nodes/journey/config/node-theme";
import type { JourneyEdge } from "@/features/nodes/journey/react-flow-types";
import { EdgeTypeEnum } from "@/features/nodes/journey/react-flow-types";

/**
 * Normalize edges to ensure proper edgeType and default styling.
 * Note: `type` and `animated` are controlled by journey-canvas.tsx based on UI store settings.
 */
export function normalizeEdges(edges: JourneyEdge[]): JourneyEdge[] {
  return edges.map((edge) => ({
    ...edge,
    edgeType: edge.edgeType || EdgeTypeEnum.DEFAULT,
    style: edge.style || EDGE_CONNECTION_STYLES[edge.edgeType || EdgeTypeEnum.DEFAULT],
  }));
}
