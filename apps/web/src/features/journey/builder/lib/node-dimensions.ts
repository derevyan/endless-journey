/**
 * Journey Node Dimension Defaults for Layout
 *
 * Provides per-node-type default dimensions for auto-layout calculations.
 * These are used as fallbacks when React Flow hasn't measured the actual node sizes yet.
 *
 * IMPORTANT: These values are estimates based on typical node content.
 * The layout system prefers measured dimensions from React Flow's internal node.measured
 * when available, which accounts for variable content like follow-up plugins and media.
 *
 * @module features/journey/builder/lib/node-dimensions
 */

import {
  type NodeDimensions,
  getNodeTypeDimensions as getNodeTypeDimensionsGeneric,
  buildDefaultDimensionMap as buildDefaultDimensionMapGeneric,
} from "@/shared/lib/ui/node-dimensions";

// Re-export the type for convenience
export type { NodeDimensions };

/**
 * Default dimensions per journey node type.
 *
 * Width: All standard nodes use w-64 (256px), except Wait nodes (pill shape).
 * Height: Estimated based on typical content - actual heights vary with:
 *   - Number of buttons (message nodes)
 *   - Follow-up plugins (+52px per step)
 *   - Media content (+70px for preview)
 *   - Number of branches (condition nodes)
 */
export const JOURNEY_NODE_DIMENSIONS: Record<string, NodeDimensions> = {
  // Simple nodes - fixed content
  start: { width: 256, height: 100 },
  end: { width: 256, height: 100 },

  // Wait node - unique pill shape (rounded-full)
  wait: { width: 120, height: 48 },

  // Message node - most variable height
  // Base ~150px, can grow to 350px+ with buttons, media, follow-ups
  message: { width: 256, height: 200 },

  // Condition node - height grows with branches
  condition: { width: 256, height: 180 },

  // Agent node - includes workflow reference and status
  // Can grow with follow-up plugins
  agent: { width: 256, height: 180 },

  // Webhook node - includes URL preview and error handling
  webhook: { width: 256, height: 180 },

  // CRM node - includes pipeline and stage info
  crm: { width: 256, height: 160 },

  // Teleport node - includes target journey info
  teleport: { width: 256, height: 120 },

  // Questionnaire node - includes question previews
  // Can grow significantly with many questions
  questionnaire: { width: 256, height: 220 },

  // Default fallback for unknown node types
  default: { width: 256, height: 170 },
};

/**
 * Get dimensions for a specific journey node type.
 * Falls back to default if node type is not found.
 */
export function getNodeTypeDimensions(nodeType: string | undefined): NodeDimensions {
  return getNodeTypeDimensionsGeneric(nodeType, JOURNEY_NODE_DIMENSIONS);
}

/**
 * Build a dimension map for a list of journey nodes using type-based defaults.
 * This is used when React Flow measured dimensions are not available.
 */
export function buildDefaultDimensionMap(
  nodes: Array<{ id: string; type?: string }>
): Map<string, NodeDimensions> {
  return buildDefaultDimensionMapGeneric(nodes, JOURNEY_NODE_DIMENSIONS);
}
