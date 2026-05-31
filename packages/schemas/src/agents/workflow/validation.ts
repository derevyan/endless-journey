import type { WorkflowNode } from "./node";
import type { WorkflowEdge } from "./edge";
import { NODE_OUTPUT_HANDLES, BRANCHING_NODE_TYPES } from "./node-type";

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
  warnings: WorkflowValidationWarning[];
}

export interface WorkflowValidationError {
  path: string;
  message: string;
  code: string;
}

export interface WorkflowValidationWarning {
  path: string;
  message: string;
  code: string;
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate workflow graph structure.
 *
 * Checks:
 * 1. Exactly one start node
 * 2. At least one end node
 * 3. Unique node IDs
 * 4. Valid edge references
 * 5. No cycles (CRITICAL)
 * 6. No unreachable nodes (warning)
 * 7. Branching nodes have required handles
 */
export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];
  const warnings: WorkflowValidationWarning[] = [];

  // 1. Check for exactly one start node
  const startNodes = nodes.filter((n) => n.type === "start");
  if (startNodes.length === 0) {
    errors.push({
      path: "nodes",
      message: "Workflow must have exactly one start node",
      code: "MISSING_START_NODE",
    });
  }
  if (startNodes.length > 1) {
    errors.push({
      path: "nodes",
      message: `Workflow has ${startNodes.length} start nodes, expected exactly 1`,
      code: "MULTIPLE_START_NODES",
    });
  }

  // 2. Check for at least one end node
  const endNodes = nodes.filter((n) => n.type === "end");
  if (endNodes.length === 0) {
    errors.push({
      path: "nodes",
      message: "Workflow must have at least one end node",
      code: "MISSING_END_NODE",
    });
  }

  // 3. Check for unique node IDs
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({
        path: `nodes.${node.id}`,
        message: `Duplicate node ID: ${node.id}`,
        code: "DUPLICATE_NODE_ID",
      });
    }
    nodeIds.add(node.id);
  }

  // 4. Check edge references
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        path: `edges.${edge.id}`,
        message: `Edge references non-existent source node: ${edge.source}`,
        code: "INVALID_EDGE_SOURCE",
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        path: `edges.${edge.id}`,
        message: `Edge references non-existent target node: ${edge.target}`,
        code: "INVALID_EDGE_TARGET",
      });
    }
  }

  // 5. CRITICAL: Detect cycles
  const cycles = detectCycles(nodes, edges);
  for (const cycle of cycles) {
    errors.push({
      path: "edges",
      message: `Cycle detected: ${cycle}`,
      code: "CYCLE_DETECTED",
    });
  }

  // 6. Check for unreachable nodes (warning)
  const unreachable = findUnreachableNodes(nodes, edges, startNodes[0]?.id);
  for (const nodeId of unreachable) {
    warnings.push({
      path: `nodes.${nodeId}`,
      message: `Node ${nodeId} is not reachable from start`,
      code: "UNREACHABLE_NODE",
    });
  }

  // 7. Check branching nodes have required handles
  for (const node of nodes) {
    if (BRANCHING_NODE_TYPES.includes(node.type)) {
      const expectedHandles = NODE_OUTPUT_HANDLES[node.type];
      const actualHandles = edges.filter((e) => e.source === node.id).map((e) => e.sourceHandle || "default");

      for (const handle of expectedHandles) {
        if (!actualHandles.includes(handle)) {
          // Guard 'blocked' is optional (can terminate)
          if (node.type === "guard" && handle === "blocked") {
            warnings.push({
              path: `nodes.${node.id}`,
              message: `Guard node has no 'blocked' edge - will terminate workflow on block`,
              code: "MISSING_BLOCKED_EDGE",
            });
          } else {
            warnings.push({
              path: `nodes.${node.id}`,
              message: `${node.type} node should have '${handle}' edge`,
              code: "MISSING_BRANCH_EDGE",
            });
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// CYCLE DETECTION (CRITICAL)
// =============================================================================

/**
 * CRITICAL: Detect cycles in the workflow graph.
 *
 * Uses DFS with "in-stack" tracking to find back edges.
 * This is essential to prevent infinite loops in workflow execution.
 */
export function detectCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const cycles: string[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
    }
  }

  function dfs(nodeId: string, path: string[]): void {
    if (inStack.has(nodeId)) {
      // Found cycle - extract cycle path
      const cycleStart = path.indexOf(nodeId);
      const cyclePath = [...path.slice(cycleStart), nodeId];
      cycles.push(cyclePath.join(" → "));
      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    inStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path, nodeId]);
    }

    inStack.delete(nodeId);
  }

  // Start DFS from all nodes to catch disconnected components
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  return cycles;
}

// =============================================================================
// UNREACHABLE NODE DETECTION
// =============================================================================

/**
 * Find nodes not reachable from start.
 * Uses BFS to traverse the graph from the start node.
 */
export function findUnreachableNodes(nodes: WorkflowNode[], edges: WorkflowEdge[], startId?: string): string[] {
  if (!startId) return nodes.map((n) => n.id);

  const reachable = new Set<string>();
  const queue = [startId];

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;

    reachable.add(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    queue.push(...neighbors);
  }

  return nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id);
}
