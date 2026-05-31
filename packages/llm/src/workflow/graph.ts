/**
 * Graph Builder - Build adjacency maps from workflow edges
 *
 * This module provides efficient graph traversal utilities for workflow execution.
 */

import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from "@journey/schemas";
import type { AdjacencyMap, GraphEdge } from "./types";

/**
 * Build an adjacency map from workflow edges.
 *
 * Supports:
 * - Multiple outgoing edges per node (for branching)
 * - Handle-based routing (sourceHandle)
 * - Efficient O(1) edge lookup
 */
export function buildAdjacencyMap(nodes: WorkflowNode[], edges: WorkflowEdge[]): AdjacencyMap {
  // Outgoing edges: nodeId -> [{ target, handle }]
  const outgoing = new Map<string, GraphEdge[]>();

  // Incoming edges: nodeId -> [{ source, handle }]
  const incoming = new Map<string, Array<{ source: string; handle: string }>>();

  // Initialize empty arrays for all nodes
  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  // Populate from edges
  for (const edge of edges) {
    const handle = edge.sourceHandle || "default";

    // Add to outgoing
    const out = outgoing.get(edge.source);
    if (out) {
      out.push({ target: edge.target, handle });
    }

    // Add to incoming
    const inc = incoming.get(edge.target);
    if (inc) {
      inc.push({ source: edge.source, handle });
    }
  }

  return {
    getOutgoing(nodeId: string): GraphEdge[] {
      return outgoing.get(nodeId) || [];
    },

    getOutgoingByHandle(nodeId: string, handle: string): GraphEdge | undefined {
      const edges = outgoing.get(nodeId) || [];
      return edges.find((e) => e.handle === handle);
    },

    getIncoming(nodeId: string): Array<{ source: string; handle: string }> {
      return incoming.get(nodeId) || [];
    },
  };
}

/**
 * Find a node by ID.
 */
export function findNode(nodes: WorkflowNode[], nodeId: string): WorkflowNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}

/**
 * Find node by type (e.g., 'start').
 */
export function findNodeByType(nodes: WorkflowNode[], type: WorkflowNodeType): WorkflowNode | undefined {
  return nodes.find((n) => n.type === type);
}
