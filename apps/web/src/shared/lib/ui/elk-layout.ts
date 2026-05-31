/**
 * ELK Layout Engine
 *
 * Provides ELK-based (Eclipse Layout Kernel) auto-layout functionality for React Flow canvases.
 * ELK offers superior layout capabilities compared to Dagre:
 * - Better hierarchy visualization with layered algorithm
 * - Orthogonal edge routing (no edge crossings)
 * - Proper handling of variable node sizes
 *
 * @module shared/lib/ui/elk-layout
 */

import ELK from "elkjs/lib/elk.bundled.js";
import { Position } from "@xyflow/react";
import type { LayoutDirection, LayoutOptions, LayoutableNode, LayoutableEdge } from "./layout";
import type { NodeDimensions } from "@/features/journey/builder/lib/node-dimensions";

// Create a single ELK instance for reuse
const elk = new ELK();

/**
 * Map our layout direction to ELK direction
 */
const DIRECTION_MAP: Record<LayoutDirection, string> = {
  TB: "DOWN",
  BT: "UP",
  LR: "RIGHT",
  RL: "LEFT",
};

/**
 * Default ELK options optimized for journey graphs.
 * These settings prioritize clear hierarchy and clean edge routing.
 */
const DEFAULT_ELK_OPTIONS: Record<string, string> = {
  // Use layered algorithm - best for hierarchical graphs like journeys
  "elk.algorithm": "layered",

  // Orthogonal edge routing - clean right-angle edges, no overlaps
  "elk.edgeRouting": "ORTHOGONAL",

  // Node placement - use BRANDES_KOEPF to enable fixedAlignment option
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",

  // Port constraints - keeps handles on the correct sides
  "elk.portConstraints": "FIXED_SIDE",

  // Merge edges going to same target (cleaner look)
  "elk.layered.mergeEdges": "true",

  // Spacing between edges
  "elk.spacing.edgeNode": "25",
  "elk.spacing.edgeEdge": "15",
};

/**
 * ELK graph node structure
 */
interface ElkNode {
  id: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
}

/**
 * ELK graph edge structure
 */
interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

/**
 * ELK graph structure
 */
interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkNode[];
  edges: ElkEdge[];
}

/**
 * ELK layout result with positioned nodes
 */
interface ElkLayoutResult {
  id: string;
  layoutOptions: Record<string, string>;
  children?: Array<ElkNode & { x: number; y: number }>;
  edges: ElkEdge[];
}

/**
 * Apply ELK auto-layout to nodes and edges.
 *
 * @param nodes - Array of nodes to layout
 * @param edges - Array of edges connecting nodes
 * @param nodeDimensions - Map of node IDs to their actual dimensions
 * @param options - Layout configuration options
 * @returns Promise resolving to layouted nodes and edges
 */
export async function getElkLayoutedElements<
  N extends LayoutableNode,
  E extends LayoutableEdge
>(
  nodes: N[],
  edges: E[],
  nodeDimensions: Map<string, NodeDimensions>,
  options: LayoutOptions = {}
): Promise<{ nodes: N[]; edges: E[] }> {
  // Handle empty graph
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const direction = options.direction ?? "TB";
  const rankSep = options.rankSep ?? 100;
  const nodeSep = options.nodeSep ?? 80;
  const alignment = options.alignment ?? "CENTER";
  const modelOrder = options.modelOrder ?? "NONE";
  const crossingMinimization = options.crossingMinimization ?? "LAYER_SWEEP";
  const cycleBreaking = options.cycleBreaking ?? "GREEDY";
  const isHorizontal = direction === "LR" || direction === "RL";

  // Build ELK graph structure
  const graph: ElkGraph = {
    id: "root",
    layoutOptions: {
      ...DEFAULT_ELK_OPTIONS,
      "elk.direction": DIRECTION_MAP[direction],
      "elk.layered.spacing.nodeNodeBetweenLayers": String(rankSep),
      "elk.spacing.nodeNode": String(nodeSep),
      // Node alignment within layers (BALANCED, LEFTUP, RIGHTUP)
      // Requires BRANDES_KOEPF node placement strategy
      "elk.layered.nodePlacement.bk.fixedAlignment": alignment,
      // Model order: whether to respect input node/edge order
      "elk.layered.considerModelOrder.strategy": modelOrder,
      // Crossing minimization: how aggressively to reorder nodes
      "elk.layered.crossingMinimization.strategy": crossingMinimization,
      // Cycle breaking: how to handle cycles when assigning layers
      "elk.layered.cycleBreaking.strategy": cycleBreaking,
    },
    children: nodes.map((node) => {
      const dims = nodeDimensions.get(node.id) ?? { width: 256, height: 170 };
      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  // Run ELK layout algorithm (async)
  const layoutedGraph = (await elk.layout(graph)) as ElkLayoutResult;

  // Map positions back to React Flow format
  const layoutedNodes = nodes.map((node) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);

    if (!elkNode || elkNode.x === undefined || elkNode.y === undefined) {
      // Fallback if layout fails for a node
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: node.position ?? { x: 0, y: 0 },
      };
    }

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // ELK uses top-left anchor, same as React Flow
      position: {
        x: elkNode.x,
        y: elkNode.y,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
