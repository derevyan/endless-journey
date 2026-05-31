/**
 * Journey Structure Validator
 *
 * Re-exports validation utilities from @journey/schemas.
 * The validation logic has been moved to schemas to allow frontend import
 * without engine dependency.
 *
 * @module engine/validation/journey-validator
 */

// Re-export everything from @journey/schemas validation module
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
  // Re-exported types
  type ValidationSeverity,
  type ValidationErrorCode,
  type JourneyValidationIssue,
  type JourneyValidationResult,
} from "@journey/schemas";
