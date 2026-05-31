/**
 * Generic Layout Utilities
 *
 * Provides dagre-based auto-layout functionality for React Flow canvases.
 * This module is framework-agnostic and works with any node/edge types.
 *
 * @module shared/lib/ui/layout
 */

import dagre from 'dagre';
import { Position } from '@xyflow/react';

// Default dimensions for journey nodes
const JOURNEY_NODE_WIDTH = 260;
const JOURNEY_NODE_HEIGHT = 170;

// Default dimensions for workflow nodes (used as fallback)
const WORKFLOW_NODE_WIDTH = 140;
const WORKFLOW_NODE_HEIGHT = 100;

// Per-node-type dimensions for accurate layout spacing
// These MUST match the CSS max-width values in workflow-theme.ts:
// - compact nodes: max-w-[140px] → 140px
// - standard nodes (agent): max-w-[260px] → 260px
const WORKFLOW_NODE_DIMENSIONS_PX: Record<string, { width: number; height: number }> = {
  // Compact nodes - max-w-[140px]
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
  // Standard nodes - max-w-[260px]
  agent: { width: 260, height: 100 },
};

/**
 * Get dimensions for a workflow node type
 */
function getWorkflowNodeDimensions(
  nodeType: string | undefined,
  defaultWidth: number,
  defaultHeight: number
): { width: number; height: number } {
  if (nodeType && WORKFLOW_NODE_DIMENSIONS_PX[nodeType]) {
    return WORKFLOW_NODE_DIMENSIONS_PX[nodeType];
  }
  return { width: defaultWidth, height: defaultHeight };
}

/**
 * Layout direction options for dagre auto-layout
 */
export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

/**
 * Node alignment within layers (ELK BK algorithm)
 * Controls how nodes are positioned within their layer.
 * Requires BRANDES_KOEPF node placement strategy.
 */
export type NodeAlignment = 'BALANCED' | 'LEFTUP' | 'RIGHTUP';

/**
 * Model order strategy for ELK layered algorithm.
 * Controls whether to respect input node/edge order vs optimize for crossings.
 */
export type ModelOrderStrategy = 'NONE' | 'NODES_AND_EDGES' | 'PREFER_NODES' | 'PREFER_EDGES';

/**
 * Crossing minimization strategy for ELK layered algorithm.
 * Controls how aggressively to reorder nodes to minimize edge crossings.
 */
export type CrossingMinimizationStrategy = 'LAYER_SWEEP' | 'INTERACTIVE';

/**
 * Cycle breaking strategy for ELK layered algorithm.
 * Controls how to break cycles when assigning nodes to layers.
 */
export type CycleBreakingStrategy = 'GREEDY' | 'INTERACTIVE' | 'MODEL_ORDER';

/**
 * Configuration options for auto-layout (dialog-facing)
 * These are the options exposed to the user in the AutoLayoutMenu
 */
export interface LayoutOptions {
  /** Layout direction: TB (top-bottom), BT (bottom-top), LR (left-right), RL (right-left) */
  direction?: LayoutDirection;
  /** Vertical spacing between ranks in pixels (default: 80) */
  rankSep?: number;
  /** Horizontal spacing between nodes in pixels (default: 70) */
  nodeSep?: number;
  /** Node alignment within layers: LEFT, CENTER (default), RIGHT */
  alignment?: NodeAlignment;
  /** Model order strategy: whether to respect input node/edge order (default: NONE) */
  modelOrder?: ModelOrderStrategy;
  /** Crossing minimization strategy: how aggressively to reorder (default: LAYER_SWEEP) */
  crossingMinimization?: CrossingMinimizationStrategy;
  /** Cycle breaking strategy: how to break cycles (default: GREEDY) */
  cycleBreaking?: CycleBreakingStrategy;
}

/**
 * Internal layout options including node dimensions
 * Used by layout functions but not exposed to dialog
 */
export interface InternalLayoutOptions extends LayoutOptions {
  /** Node width for layout calculation */
  nodeWidth?: number;
  /** Node height for layout calculation */
  nodeHeight?: number;
}

/** Default layout options (used by menu and journey) */
export const DEFAULT_LAYOUT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB',
  rankSep: 80,
  nodeSep: 70,
  alignment: 'BALANCED',
  modelOrder: 'NONE',
  crossingMinimization: 'LAYER_SWEEP',
  cycleBreaking: 'GREEDY',
};

/** Default layout options for workflow (compact nodes, horizontal flow) */
export const DEFAULT_WORKFLOW_LAYOUT_OPTIONS: Required<InternalLayoutOptions> = {
  direction: 'LR',
  rankSep: 60,
  nodeSep: 50,
  alignment: 'BALANCED',
  modelOrder: 'NONE',
  crossingMinimization: 'LAYER_SWEEP',
  cycleBreaking: 'GREEDY',
  nodeWidth: WORKFLOW_NODE_WIDTH,
  nodeHeight: WORKFLOW_NODE_HEIGHT,
};

/**
 * Generic interface for nodes that can be laid out.
 * Both JourneyNode and WorkflowCanvasNode satisfy this interface.
 */
export type LayoutableNode = {
  id: string;
  type?: string; // Used for per-node-type dimension lookup
  position: { x: number; y: number };
};

/**
 * Generic interface for edges that can be laid out.
 */
export type LayoutableEdge = {
  id: string;
  source: string;
  target: string;
};

/**
 * Apply dagre auto-layout to nodes and edges (generic version)
 */
export function getLayoutedElementsGeneric<
  N extends LayoutableNode,
  E extends LayoutableEdge
>(
  nodes: N[],
  edges: E[],
  options: InternalLayoutOptions = {}
): { nodes: N[]; edges: E[] } {
  const nodeWidth = options.nodeWidth ?? JOURNEY_NODE_WIDTH;
  const nodeHeight = options.nodeHeight ?? JOURNEY_NODE_HEIGHT;
  const direction = options.direction ?? 'TB';
  const rankSep = options.rankSep ?? 80;
  const nodeSep = options.nodeSep ?? 70;

  // Create a new graph instance for each layout call to avoid state pollution
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR' || direction === 'RL';
  dagreGraph.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep });

  // Store per-node dimensions for position calculation later
  const nodeDimensions = new Map<string, { width: number; height: number }>();

  nodes.forEach((node) => {
    // Use per-node-type dimensions for workflow nodes to ensure accurate spacing
    const dims = getWorkflowNodeDimensions(node.type, nodeWidth, nodeHeight);
    nodeDimensions.set(node.id, dims);
    dagreGraph.setNode(node.id, {
      width: dims.width,
      height: dims.height
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const dims = nodeDimensions.get(node.id) ?? { width: nodeWidth, height: nodeHeight };

    // Safety check: if layout fails for a node, provide default to avoid crash
    if (!nodeWithPosition) {
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: { x: 0, y: 0 }
      };
    }

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // Shift from dagre center anchor to React Flow top-left anchor
      // Use per-node dimensions for accurate positioning
      position: {
        x: nodeWithPosition.x - (dims.width / 2),
        y: nodeWithPosition.y - (dims.height / 2),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Add React Flow handle positions to nodes without changing their positions.
 * Use this when loading nodes that already have valid positions.
 * Generic version that works with any node type.
 */
export function addHandlePositionsGeneric<N extends LayoutableNode>(
  nodes: N[],
  direction: LayoutDirection = 'TB'
): N[] {
  const isHorizontal = direction === 'LR' || direction === 'RL';
  return nodes.map((node) => ({
    ...node,
    targetPosition: isHorizontal ? Position.Left : Position.Top,
    sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
  }));
}
