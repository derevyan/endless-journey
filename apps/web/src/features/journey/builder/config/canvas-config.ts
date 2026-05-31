/**
 * Canvas Configuration
 *
 * Canvas-specific visual settings for the Journey Builder.
 * This file contains only canvas-level configuration (background, grid, zoom, highlights).
 *
 * For node and edge styling, see apps/web/src/nodes/config/node-theme.ts
 */

/**
 * Canvas Visual Configuration
 * Background grid, selection highlights, and journey visualization colors
 */
export const CANVAS_COLORS = {
  selectedEdge: "#3b82f6", // blue-500 - primary selection color
  selectedEdgeWidth: 3,
  journeyHighlight: "#22c55e", // green-500 - journey path highlight
  journeyHighlightWidth: 3,
  scenarioHighlight: "#8b5cf6", // violet-500 - scenario path highlight
  scenarioHighlightWidth: 3,
  simulatorVisitedEdge: "#0ea5e9", // sky-500 - simulator visited path
  simulatorVisitedEdgeWidth: 3,
} as const;

/**
 * React Flow Configuration
 * Canvas behavior and interaction settings
 */
export const REACT_FLOW_CONFIG = {
  backgroundGap: 24, // Grid dot spacing for cleaner look
  minZoom: 0.1, // Minimum zoom level
  edgeInteractionWidth: 30, // Click target width for edges
} as const;
