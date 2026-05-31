/**
 * Edge Factory
 *
 * Purpose: Centralized edge creation logic with styles
 *
 * Consolidates edge creation logic that was previously scattered across:
 * - journey-nodes-store.ts (addEdge)
 * - theme.ts (EDGE_CONNECTION_STYLES)
 */

import { EDGE_CONNECTION_STYLES, MANAGED_EDGE_STYLE } from "@/features/nodes/journey/config/node-theme";
import type { EdgeStyle, EdgeType as EdgeTypeAlias, JourneyEdge } from "../react-flow-types";
import { EdgeTypeEnum } from "../react-flow-types";
import { generateEdgeId } from "./node-utils";

/**
 * Options for creating managed edges
 */
export interface ManagedEdgeOptions {
  /** Mark as auto-created (engine sees it, UI protects it) */
  managed?: boolean;
  /** Source identifier: "button-{buttonId}" or "followup-{stepIdx}-{buttonId}" */
  managedBy?: string;
  /** Override the generated ID (used for managed edges with predictable IDs) */
  customId?: string;
  /** Custom label for the edge */
  label?: string;
  /** Edge type (default, timer, exit) */
  edgeType?: EdgeTypeAlias;
  /** Custom style override */
  style?: EdgeStyle;
}

/**
 * Create a new edge with appropriate styling
 */
export function createEdge(
  source: string,
  target: string,
  existingEdges: JourneyEdge[],
  label?: string,
  edgeType: EdgeTypeAlias = EdgeTypeEnum.DEFAULT,
  sourceHandle?: string,
  options?: ManagedEdgeOptions
): JourneyEdge {
  const id = options?.customId ?? generateEdgeId(existingEdges);
  const finalEdgeType = options?.edgeType ?? edgeType;

  // Style priority: options.style > managed default > regular default
  const style = options?.style ?? (options?.managed ? MANAGED_EDGE_STYLE : EDGE_CONNECTION_STYLES[finalEdgeType]);

  return {
    id,
    source,
    target,
    sourceHandle,
    label: options?.label ?? label,
    edgeType: finalEdgeType,
    style,
    // Animation controlled by UI settings (edgeAnimations in ui-store)
    animated: false,
    // Managed edge properties
    ...(options?.managed && { managed: true }),
    ...(options?.managedBy && { managedBy: options.managedBy }),
  };
}
