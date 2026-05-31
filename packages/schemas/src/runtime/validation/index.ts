/**
 * Validation Module
 *
 * Pure validation utilities for journey configurations.
 * Can be used by both frontend and backend without runtime dependencies.
 *
 * @module schemas/validation
 */

// Node label utilities
export { sanitizeNodeLabel, RESERVED_NODE_OUTPUT_PREFIXES } from "./node-label";

// Graph utilities
// NOTE: detectCycles is renamed to detectJourneyCycles to avoid conflict with agents/workflow
export {
  buildGraph,
  dfs,
  findReachableNodes,
  findNodesReachingEnd,
  isAutoTransitionNode,
  detectCycles as detectJourneyCycles,
  hasDangerousCycle,
  findOrphanNodes,
  findDeadEndNodes,
  findDanglingEdges,
  findAllPaths,
  calculateMaxPathLength,
  type Graph,
  type CycleInfo,
  type PathInfo,
} from "./graph-utils";

// Journey validator
// NOTE: Validation types (ValidationSeverity, ValidationErrorCode, JourneyValidationIssue,
// JourneyValidationResult) are already exported from frontend-engine-types.ts, so we
// don't re-export them here to avoid conflicts.
export {
  // Main validation functions
  validateJourneyStructure,
  isValidJourney,
  getJourneyErrors,
  formatValidationResult,
  // Individual validators (for advanced use)
  validateStartNode,
  validateEndNode,
  validateUniqueNodeIds,
  validateUniqueEdgeIds,
  validateUniqueNodeLabels,
  validateNodeLabelReservedPrefixes,
  validateEdgeReferences,
  validateNodeReachability,
  validateConditionBranches,
  validateTimerEdges,
  validateQuestionnaireTimeoutEdges,
  validateAgentTimeoutEdges,
  validateNoCycles,
  validateNoDeadEnds,
  validateMessageContent,
  validateUniqueButtonLabels,
  validateWebhookErrorEdges,
  validateMessageButtonConnections,
  validateButtonTargets,
  validatePluginReferences,
} from "./journey-validator";
