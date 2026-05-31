/**
 * Graph Utilities for Journey Validation
 *
 * Re-exports graph utilities from @journey/schemas.
 * The graph analysis logic has been moved to schemas to allow frontend import
 * without engine dependency.
 *
 * @module engine/validation/graph-utils
 */

// Re-export everything from @journey/schemas validation module
export {
  buildGraph,
  dfs,
  findReachableNodes,
  findNodesReachingEnd,
  isAutoTransitionNode,
  detectJourneyCycles,
  hasDangerousCycle,
  findOrphanNodes,
  findDeadEndNodes,
  findDanglingEdges,
  findAllPaths,
  calculateMaxPathLength,
  type Graph,
  type CycleInfo,
  type PathInfo,
} from "@journey/schemas";
