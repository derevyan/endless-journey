/**
 * Graph Utilities for Journey Validation
 *
 * Provides algorithms for graph analysis:
 * - DFS traversal
 * - Cycle detection
 * - Reachability analysis
 * - Connectivity checks
 *
 * @module schemas/validation/graph-utils
 */

import type { JourneyConfig, JourneyNodeData, JourneyEdgeData } from "../../journey";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Graph representation for efficient traversal
 */
export interface Graph {
  /** Map of node ID to node data */
  nodes: Map<string, JourneyNodeData>;
  /** Map of node ID to outgoing edges */
  outEdges: Map<string, JourneyEdgeData[]>;
  /** Map of node ID to incoming edges */
  inEdges: Map<string, JourneyEdgeData[]>;
  /** Start node ID */
  startNodeId: string | null;
  /** End node IDs */
  endNodeIds: string[];
}

/**
 * Result of cycle detection
 */
export interface CycleInfo {
  /** Whether a cycle exists */
  hasCycle: boolean;
  /** Nodes involved in the cycle (if detected) */
  cycleNodes: string[];
  /** Whether the cycle is auto-transition only (no user input breaks it) */
  isAutoTransitionCycle: boolean;
}

/**
 * Path information for reachability
 */
export interface PathInfo {
  /** Nodes on the path from source to target */
  path: string[];
  /** Whether all transitions are automatic */
  isAutoPath: boolean;
}

// =============================================================================
// GRAPH CONSTRUCTION
// =============================================================================

/**
 * Build a graph representation from journey config
 */
export function buildGraph(journey: JourneyConfig): Graph {
  const nodes = new Map<string, JourneyNodeData>();
  const outEdges = new Map<string, JourneyEdgeData[]>();
  const inEdges = new Map<string, JourneyEdgeData[]>();
  let startNodeId: string | null = null;
  const endNodeIds: string[] = [];

  // Index regular nodes
  for (const node of journey.nodes) {
    nodes.set(node.id, node);
    outEdges.set(node.id, []);
    inEdges.set(node.id, []);

    if (node.data.type === "start") {
      startNodeId = node.id;
    } else if (node.data.type === "end") {
      endNodeIds.push(node.id);
    }
  }

  // Note: Plugins are now embedded in node.data.plugins[] (new format)
  // The old pluginNodes[] array format is deprecated and no longer indexed

  // Index edges
  for (const edge of journey.edges) {
    const existing = outEdges.get(edge.source);
    if (existing) {
      existing.push(edge);
    }
    const incomingExisting = inEdges.get(edge.target);
    if (incomingExisting) {
      incomingExisting.push(edge);
    }
  }

  // NOTE: Follow-up sequence connections are now stored as managed edges in journey.edges
  // (managed-fu-btn::* and managed-fu-exit::*) and are indexed in the loop above.
  // No synthetic edge generation needed.

  return { nodes, outEdges, inEdges, startNodeId, endNodeIds };
}

// =============================================================================
// DFS TRAVERSAL
// =============================================================================

/**
 * Perform depth-first search from a starting node
 *
 * @param graph - The graph to traverse
 * @param startId - Node to start from
 * @param visitor - Callback for each visited node, return false to stop traversal
 * @returns Set of visited node IDs
 */
export function dfs(
  graph: Graph,
  startId: string,
  visitor?: (nodeId: string, node: JourneyNodeData) => boolean | void
): Set<string> {
  const visited = new Set<string>();
  const stack = [startId];

  while (stack.length > 0) {
    const nodeId = stack.pop()!;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    if (visitor) {
      const shouldContinue = visitor(nodeId, node);
      if (shouldContinue === false) break;
    }

    // Add unvisited neighbors
    const edges = graph.outEdges.get(nodeId) || [];
    for (const edge of edges) {
      if (!visited.has(edge.target)) {
        stack.push(edge.target);
      }
    }
  }

  return visited;
}

/**
 * Find all nodes reachable from start node
 */
export function findReachableNodes(graph: Graph): Set<string> {
  if (!graph.startNodeId) return new Set();
  return dfs(graph, graph.startNodeId);
}

/**
 * Find all nodes that can reach an end node (reverse reachability)
 */
export function findNodesReachingEnd(graph: Graph): Set<string> {
  const canReachEnd = new Set<string>();

  // Start from all end nodes and traverse backwards
  for (const endId of graph.endNodeIds) {
    const stack = [endId];
    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (canReachEnd.has(nodeId)) continue;
      canReachEnd.add(nodeId);

      // Follow incoming edges backwards
      const incomingEdges = graph.inEdges.get(nodeId) || [];
      for (const edge of incomingEdges) {
        if (!canReachEnd.has(edge.source)) {
          stack.push(edge.source);
        }
      }
    }
  }

  return canReachEnd;
}

// =============================================================================
// CYCLE DETECTION
// =============================================================================

/**
 * Check if a node has auto-transition (no user input required)
 */
export function isAutoTransitionNode(node: JourneyNodeData): boolean {
  const { data } = node;

  switch (data.type) {
    case "start":
      return true; // Start always auto-transitions
    case "end":
      return false; // End doesn't transition
    case "message":
      // Auto if responseType is "auto" or no buttons and no timer
      if (data.responseType === "auto") return true;
      if (!data.buttons || data.buttons.length === 0) {
        if (!data.timer) return true;
      }
      return false;
    case "wait":
      return true; // Wait auto-transitions after duration
    case "condition":
      return true; // Condition auto-evaluates
    case "webhook":
      return true; // Webhook auto-continues after response
    case "crm":
      return true; // CRM action auto-continues
    case "teleport":
      return true; // Teleport auto-continues to target
    default:
      return false;
  }
}

/**
 * Detect cycles in the graph, specifically looking for auto-transition cycles
 *
 * Uses Tarjan's algorithm variant to find strongly connected components
 */
export function detectCycles(graph: Graph): CycleInfo[] {
  const cycles: CycleInfo[] = [];

  if (!graph.startNodeId) return cycles;

  // DFS-based cycle detection with path tracking
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function visit(nodeId: string): void {
    if (inStack.has(nodeId)) {
      // Found a cycle - extract nodes in the cycle
      const cycleStart = path.indexOf(nodeId);
      const cycleNodes = path.slice(cycleStart);
      cycleNodes.push(nodeId);

      // Check if all nodes in cycle have auto-transitions
      let isAutoTransitionCycle = true;
      for (const id of cycleNodes) {
        const node = graph.nodes.get(id);
        if (node && !isAutoTransitionNode(node)) {
          isAutoTransitionCycle = false;
          break;
        }
      }

      cycles.push({
        hasCycle: true,
        cycleNodes,
        isAutoTransitionCycle,
      });
      return;
    }

    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const edges = graph.outEdges.get(nodeId) || [];
    for (const edge of edges) {
      // Skip timer edges for cycle detection (they're optional paths)
      if (edge.sourceHandle === "timer") continue;
      visit(edge.target);
    }

    path.pop();
    inStack.delete(nodeId);
  }

  visit(graph.startNodeId);

  return cycles;
}

/**
 * Simplified cycle check - returns true if any dangerous cycle exists
 */
export function hasDangerousCycle(graph: Graph): boolean {
  const cycles = detectCycles(graph);
  return cycles.some((c) => c.isAutoTransitionCycle);
}

// =============================================================================
// CONNECTIVITY ANALYSIS
// =============================================================================

/**
 * Find orphan nodes (not reachable from start)
 */
export function findOrphanNodes(graph: Graph): string[] {
  const reachable = findReachableNodes(graph);
  const orphans: string[] = [];

  for (const nodeId of graph.nodes.keys()) {
    if (!reachable.has(nodeId)) {
      orphans.push(nodeId);
    }
  }

  return orphans;
}

/**
 * Find dead-end nodes (nodes that can't reach any end node)
 */
export function findDeadEndNodes(graph: Graph): string[] {
  const canReachEnd = findNodesReachingEnd(graph);
  const reachable = findReachableNodes(graph);
  const deadEnds: string[] = [];

  for (const nodeId of reachable) {
    const node = graph.nodes.get(nodeId);
    // End nodes are not dead ends, they ARE the end
    if (node && node.data.type !== "end" && !canReachEnd.has(nodeId)) {
      deadEnds.push(nodeId);
    }
  }

  return deadEnds;
}

/**
 * Find dangling edges (reference non-existent nodes)
 */
export function findDanglingEdges(journey: JourneyConfig): JourneyEdgeData[] {
  const nodeIds = new Set(journey.nodes.map((n) => n.id));
  const dangling: JourneyEdgeData[] = [];

  for (const edge of journey.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      dangling.push(edge);
    }
  }

  return dangling;
}

// =============================================================================
// PATH ANALYSIS
// =============================================================================

/**
 * Find all paths from start to end (BFS, limited to avoid explosion)
 */
export function findAllPaths(
  graph: Graph,
  maxPaths = 100,
  maxPathLength = 50
): PathInfo[] {
  const paths: PathInfo[] = [];

  if (!graph.startNodeId || graph.endNodeIds.length === 0) return paths;

  interface QueueItem {
    nodeId: string;
    path: string[];
    isAutoPath: boolean;
  }

  const queue: QueueItem[] = [
    { nodeId: graph.startNodeId, path: [graph.startNodeId], isAutoPath: true },
  ];

  while (queue.length > 0 && paths.length < maxPaths) {
    const { nodeId, path, isAutoPath } = queue.shift()!;

    if (path.length > maxPathLength) continue;

    // Check if we reached an end
    if (graph.endNodeIds.includes(nodeId)) {
      paths.push({ path, isAutoPath });
      continue;
    }

    // Explore neighbors
    const edges = graph.outEdges.get(nodeId) || [];
    for (const edge of edges) {
      // Skip if already in path (avoid cycles in path enumeration)
      if (path.includes(edge.target)) continue;

      const targetNode = graph.nodes.get(edge.target);
      const newIsAutoPath = isAutoPath && (targetNode ? isAutoTransitionNode(targetNode) : false);

      queue.push({
        nodeId: edge.target,
        path: [...path, edge.target],
        isAutoPath: newIsAutoPath,
      });
    }
  }

  return paths;
}

/**
 * Calculate the maximum path length (longest path from start to any end)
 *
 * Uses BFS with iteration limit to handle cycles safely.
 * In graphs with cycles, returns the longest non-cyclic path found.
 */
export function calculateMaxPathLength(graph: Graph): number {
  if (!graph.startNodeId) return 0;

  const distances = new Map<string, number>();
  distances.set(graph.startNodeId, 0);

  // Track visit counts to detect cycles
  const visitCounts = new Map<string, number>();

  // Use iteration limit to prevent infinite loops on cyclic graphs
  // Max iterations = nodes × average branching factor × safety margin
  const maxIterations = graph.nodes.size * 10;
  let iterations = 0;

  const queue = [graph.startNodeId];
  let maxDistance = 0;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const nodeId = queue.shift()!;
    const currentDist = distances.get(nodeId) || 0;

    // Track how many times we visit each node
    const visitCount = (visitCounts.get(nodeId) || 0) + 1;
    visitCounts.set(nodeId, visitCount);

    // If we've visited this node too many times, skip (cycle detected)
    if (visitCount > graph.nodes.size) continue;

    const edges = graph.outEdges.get(nodeId) || [];
    for (const edge of edges) {
      const existingDist = distances.get(edge.target);
      const newDist = currentDist + 1;

      if (existingDist === undefined || newDist > existingDist) {
        distances.set(edge.target, newDist);
        queue.push(edge.target);
        maxDistance = Math.max(maxDistance, newDist);
      }
    }
  }

  return maxDistance;
}
