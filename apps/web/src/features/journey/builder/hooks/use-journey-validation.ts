/**
 * Journey Validation Hook
 *
 * Provides validation functionality for the journey builder.
 * Uses the schemas validation module to check journey structure.
 */

import { useCallback } from "react";
import { validateJourneyStructure } from "@journey/schemas";
import type { JourneyValidationResult, JourneyValidationIssue } from "@journey/schemas";
import { journeyNodesActions } from "@/stores/journey-nodes-store";

/** Minimal node type for displaying validation messages */
export type NodeForDisplay = { id: string; data?: { label?: string } };

/**
 * User-friendly error messages for validation codes
 */
const ERROR_MESSAGES: Record<string, string> = {
  NO_START_NODE: "Journey needs a Start node",
  MULTIPLE_START_NODES: "Journey can only have one Start node",
  NO_END_NODE: "Journey needs at least one End node",
  DANGLING_EDGE_SOURCE: "Edge references a non-existent source node",
  DANGLING_EDGE_TARGET: "Edge references a non-existent target node",
  ORPHAN_NODE: "Node is not connected to the journey flow",
  AUTO_TRANSITION_CYCLE: "Infinite loop detected - auto-transition nodes create a cycle",
  MISSING_CONDITION_BRANCH_EDGE: "Condition node is missing connection for a branch",
  MISSING_TIMER_EDGE: "Node with timer needs a timeout path",
  INVALID_NODE_TYPE: "Node has an invalid type",
  DUPLICATE_NODE_ID: "Multiple nodes have the same ID",
  DUPLICATE_EDGE_ID: "Multiple edges have the same ID",
  DEAD_END_NODE: "Node cannot reach any End node",
  UNREACHABLE_END_NODE: "End node is not reachable from Start",
  MISSING_DEFAULT_BRANCH: "Condition has no default branch",
  DUPLICATE_BUTTON_LABELS: "Message has duplicate button labels",
  EMPTY_MESSAGE_CONTENT: "Message node has no content",
  MISSING_WEBHOOK_ERROR_EDGE: "Webhook has no error handling path",
  DISCONNECTED_BUTTON: "Button is not connected to any path",
  MISSING_TEXT_RESPONSE_EDGE: "Node accepts text but has no text response path",
  MISSING_QUESTIONNAIRE_TIMEOUT_EDGE: "Questionnaire with timeout needs a timeout path",
};

/**
 * Get user-friendly message for a validation error
 */
export function getErrorMessage(error: JourneyValidationIssue, nodes: NodeForDisplay[]): string {
  const baseMessage = ERROR_MESSAGES[error.code] || error.message;

  // Add node label if available
  if (error.nodeId) {
    const node = nodes.find((n) => n.id === error.nodeId);
    const label = node?.data?.label || error.nodeId;
    return `${baseMessage}: "${label}"`;
  }

  return baseMessage;
}

/**
 * Hook for journey validation
 */
export function useJourneyValidation() {
  /**
   * Validate the current journey state
   */
  const validate = useCallback((): JourneyValidationResult => {
    const currentData = journeyNodesActions.getCurrentData();
    if (!currentData) {
      // Return empty result if no data
      return {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          totalNodes: 0,
          totalEdges: 0,
          nodeTypes: {},
          hasTimers: false,
          hasConditions: false,
          hasWebhooks: false,
        },
      };
    }
    // Convert React Flow types to schema types for validation
    // The main difference is edge.label (ReactNode vs string)
    const schemaConfig = {
      nodes: currentData.nodes,
      edges: currentData.edges.map((edge) => ({
        ...edge,
        label: typeof edge.label === "string" ? edge.label : undefined,
      })),
    };
    // Use type assertion since the structure is compatible for validation purposes
    return validateJourneyStructure(schemaConfig as Parameters<typeof validateJourneyStructure>[0]);
  }, []);

  /**
   * Validate a specific journey config
   */
  const validateConfig = useCallback((config: Parameters<typeof validateJourneyStructure>[0]): JourneyValidationResult => {
    return validateJourneyStructure(config);
  }, []);

  /**
   * Quick check if journey is valid (no errors)
   */
  const isValid = useCallback((): boolean => {
    const result = validate();
    return result.valid;
  }, [validate]);

  /**
   * Get only errors (not warnings)
   */
  const getErrors = useCallback((): JourneyValidationIssue[] => {
    const result = validate();
    return result.errors;
  }, [validate]);

  /**
   * Get only warnings
   */
  const getWarnings = useCallback((): JourneyValidationIssue[] => {
    const result = validate();
    return result.warnings;
  }, [validate]);

  return {
    validate,
    validateConfig,
    isValid,
    getErrors,
    getWarnings,
    getErrorMessage,
  };
}
