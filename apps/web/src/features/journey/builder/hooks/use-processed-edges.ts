/**
 * useProcessedEdges Hook
 *
 * Transforms raw journey edges for React Flow rendering with:
 * - Plugin edge source mapping (plugin → parent node)
 * - Sibling index calculation for label offsets
 * - Dynamic style application (plugin button/exit styles)
 * - Edge type derivation for styling
 * - Selection and simulator path highlighting
 */
import { useMemo } from "react";

import { CANVAS_COLORS, REACT_FLOW_CONFIG } from "@/features/journey/builder/config/canvas-config";
import { PLUGIN_EDGE_STYLES } from "@/features/nodes/journey/config/node-theme";
import type { JourneyEdge } from "@/features/nodes/journey/react-flow-types";
import { PluginButtonEdgeId, PluginConnectionEdgeId, PluginExitEdgeId } from "@/features/nodes/journey/utils/plugin-edge-identity";
import type { PluginNode } from "@journey/schemas";
import type { EdgeConnectionStyle } from "@/stores/ui-store";

export interface ProcessedEdgesConfig {
  /** Plugin nodes for source mapping */
  pluginNodes: PluginNode[];
  /** Whether canvas is in edit mode */
  isEditMode: boolean;
  /** Edge connection style setting */
  edgeConnectionStyle: EdgeConnectionStyle;
  /** Whether edge animations are enabled */
  edgeAnimationsEnabled: boolean;
  /** Whether simulator is actively running */
  isSimulatorActive: boolean;
  /** Simulator path data for highlighting */
  simulatorPath: {
    pathKey: string;
    visitedEdgeIds: Set<string>;
  };
  /** Callback to delete an edge */
  onDeleteEdge?: (edgeId: string) => void;
  /** Callback to select an edge */
  onSelectEdge?: (edgeId: string) => void;
}

/**
 * Transforms edges for React Flow rendering with proper styling and interactions.
 */
export function useProcessedEdges(edges: JourneyEdge[], config: ProcessedEdgesConfig): JourneyEdge[] {
  const {
    pluginNodes,
    isEditMode,
    edgeConnectionStyle,
    edgeAnimationsEnabled,
    isSimulatorActive,
    simulatorPath,
    onDeleteEdge,
    onSelectEdge,
  } = config;

  return useMemo(() => {
    // Map edge connection style to React Flow edge type
    const edgeType = edgeConnectionStyle === "default" ? "default" : edgeConnectionStyle;

    // Build a map from plugin ID to parent node ID for edge source transformation
    // Plugin edges need their source changed from plugin ID to parent node ID
    // because handles are now rendered inside parent nodes as addons
    const pluginToParentMap = new Map<string, string>();
    for (const plugin of pluginNodes) {
      pluginToParentMap.set(plugin.id, plugin.parentNodeId);
    }

    // Calculate siblingIndex for edges from same source (for label offset)
    // Only count edges that have labels to avoid unnecessary offsets
    const sourceEdgeCount = new Map<string, number>();

    return edges
      .map((edge) => {
        // Transform plugin button/exit edges to use parent node ID as source
        // This is necessary because handles are rendered inside parent nodes now
        let effectiveSource = edge.source;
        if (PluginButtonEdgeId.is(edge.id) || PluginExitEdgeId.is(edge.id)) {
          const parentId = pluginToParentMap.get(edge.source);
          if (parentId) {
            effectiveSource = parentId;
          }
        }

        // Skip plugin connection edges entirely - they're no longer needed
        // since plugins are rendered as addons inside parent nodes
        if (PluginConnectionEdgeId.is(edge.id)) {
          return null; // Will be filtered out below
        }

        // Track sibling index for edges from same source (only for labeled edges)
        // NOTE: Use effectiveSource (not edge.source) so plugin edges from same parent get proper offsets
        const hasLabel = !!edge.data?.label || !!edge.label;
        const siblingIndex = hasLabel ? sourceEdgeCount.get(effectiveSource) ?? 0 : 0;
        if (hasLabel) {
          sourceEdgeCount.set(effectiveSource, siblingIndex + 1);
        }

        // Apply plugin follow-up styles dynamically (config is source of truth)
        // This ensures style changes in node-theme.ts reflect immediately
        const dynamicStyle = PluginButtonEdgeId.is(edge.id)
          ? PLUGIN_EDGE_STYLES.button
          : PluginExitEdgeId.is(edge.id)
            ? PLUGIN_EDGE_STYLES.exit
            : edge.style;

        // Derive edgeType: explicit value OR derive from plugin edge ID pattern
        // Plugin edges don't have edgeType set, so we derive it from their ID pattern
        const derivedEdgeType =
          edge.edgeType ?? (PluginExitEdgeId.is(edge.id) ? "exit" : undefined) ?? (PluginButtonEdgeId.is(edge.id) ? "timer" : undefined);

        const baseEdge: JourneyEdge = {
          ...edge,
          // Use transformed source for plugin edges (points to parent node)
          source: effectiveSource,
          type: edgeType,
          style: dynamicStyle,
          // Apply animation setting from UI store to ALL edges
          animated: edgeAnimationsEnabled,
          selectable: isEditMode,
          reconnectable: isEditMode,
          focusable: isEditMode,
          // Add interaction width to make edges easier to click
          ...(isEditMode && { interactionWidth: REACT_FLOW_CONFIG.edgeInteractionWidth }),
          // Add delete and select handlers to edge data
          data: {
            ...edge.data,
            siblingIndex, // Add sibling index for label offset
            edgeType: derivedEdgeType, // Add edge type for label accent styling (derived for plugin edges)
            onDelete: isEditMode ? onDeleteEdge : undefined,
            onSelect: isEditMode ? onSelectEdge : undefined,
          },
        };

        // Add selected edge styling in edit mode
        if (edge.selected && isEditMode) {
          return {
            ...baseEdge,
            style: {
              ...dynamicStyle,
              stroke: CANVAS_COLORS.selectedEdge,
              strokeWidth: CANVAS_COLORS.selectedEdgeWidth,
            },
          };
        }

        // Highlight edges in the simulator visited path
        if (isSimulatorActive && simulatorPath.visitedEdgeIds.has(edge.id)) {
          return {
            ...baseEdge,
            style: {
              ...dynamicStyle,
              stroke: CANVAS_COLORS.simulatorVisitedEdge,
              strokeWidth: CANVAS_COLORS.simulatorVisitedEdgeWidth,
              strokeDasharray: undefined, // Remove dash for solid highlight
            },
          };
        }

        return baseEdge;
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null); // Remove null entries (plugin connection edges)
  }, [
    edges,
    pluginNodes,
    isEditMode,
    onDeleteEdge,
    onSelectEdge,
    edgeConnectionStyle,
    edgeAnimationsEnabled,
    isSimulatorActive,
    simulatorPath.visitedEdgeIds,
  ]);
}
