/**
 * Tag Accumulator Utility
 *
 * Computes accumulated tag state for a node by traversing backwards through
 * the journey graph and collecting tag operations from upstream nodes.
 *
 * Handles:
 * - Linear paths (single incoming edge)
 * - Branching paths (multiple incoming edges) - returns union of all paths
 * - Cycles (prevents infinite loops)
 */

import type { TagAction } from "@journey/schemas";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";

export interface AccumulatedTags {
  tags: string[];
  multiPath: boolean; // true if node has multiple incoming paths
}

/**
 * Computes accumulated tags for a node by traversing backwards through the graph
 * and collecting tag operations from all upstream nodes.
 *
 * @param nodeId - The target node ID
 * @param nodes - All nodes in the journey
 * @param edges - All edges in the journey
 * @returns Accumulated tag state with multiPath indicator
 */
export function computeAccumulatedTags(
  nodeId: string,
  nodes: JourneyNode[],
  edges: JourneyEdge[]
): AccumulatedTags {
  // Find the target node
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return { tags: [], multiPath: false };
  }

  // Find all incoming edges (edges that point to this node)
  const incomingEdges = edges.filter((e) => e.target === nodeId);
  const multiPath = incomingEdges.length > 1;

  // If no incoming edges, this is a start node - no accumulated tags
  if (incomingEdges.length === 0) {
    return { tags: [], multiPath: false };
  }

  // Traverse backwards from all incoming edges to collect tags
  const visitedNodes = new Set<string>();
  const allTags = new Set<string>();

  // For each incoming edge, traverse backwards
  for (const edge of incomingEdges) {
    const sourceNodeId = edge.source;
    traverseBackwards(sourceNodeId, nodes, edges, visitedNodes, allTags);
  }

  return {
    tags: Array.from(allTags).sort(),
    multiPath,
  };
}

/**
 * Recursively traverses backwards through the graph to collect tag operations.
 * Prevents cycles by tracking visited nodes.
 */
function traverseBackwards(
  nodeId: string,
  nodes: JourneyNode[],
  edges: JourneyEdge[],
  visitedNodes: Set<string>,
  tags: Set<string>
): void {
  // Prevent cycles
  if (visitedNodes.has(nodeId)) {
    return;
  }
  visitedNodes.add(nodeId);

  // Find the node
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    return;
  }

  // Process tag actions from this node
  const tagAction = node.data.tagAction;
  if (tagAction) {
    processTagAction(tagAction, tags);
  }

  // Find incoming edges and continue traversing backwards
  const incomingEdges = edges.filter((e) => e.target === nodeId);
  for (const edge of incomingEdges) {
    traverseBackwards(edge.source, nodes, edges, visitedNodes, tags);
  }
}

/**
 * Processes a tag action and updates the tag set.
 * Handles both ADD and REMOVE operations.
 */
function processTagAction(
  tagAction: TagAction,
  tags: Set<string>
): void {
  const ops = tagAction.tags;
  if (!ops) return;

  if (ops.add) {
    for (const tag of ops.add) {
      tags.add(tag);
    }
  }
  if (ops.remove) {
    for (const tag of ops.remove) {
      tags.delete(tag);
    }
  }
}
