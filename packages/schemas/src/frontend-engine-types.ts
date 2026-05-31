/**
 * Frontend Engine Types
 *
 * Types that the frontend needs from the engine package.
 * These are re-exported here to maintain proper package boundaries:
 * - Frontend should only import from @journey/schemas
 * - Engine internals stay in @journey/engine
 *
 * @module schemas/frontend-engine-types
 */

// =============================================================================
// MESSAGE TYPES (for simulator UI)
// =============================================================================

/**
 * Message payload sent to users.
 * Used by simulator to display messages in the chat UI.
 */
export interface JourneyMessage {
  type: "text" | "buttons" | "media";
  content: string;
  buttons?: Array<{ id: string; label: string }>;
  media?: { type: "image" | "video"; url: string };
}

// =============================================================================
// VALIDATION TYPES (for validation dialog)
// =============================================================================

/**
 * Validation error severity
 */
export type ValidationSeverity = "error" | "warning";

/**
 * Validation error codes
 */
export type ValidationErrorCode =
  // Structural errors (MUST fix)
  | "NO_START_NODE"
  | "MULTIPLE_START_NODES"
  | "NO_END_NODE"
  | "DANGLING_EDGE_SOURCE"
  | "DANGLING_EDGE_TARGET"
  | "ORPHAN_NODE"
  | "AUTO_TRANSITION_CYCLE"
  | "MISSING_CONDITION_BRANCH_EDGE"
  | "MISSING_TIMER_EDGE"
  | "INVALID_NODE_TYPE"
  | "DUPLICATE_NODE_ID"
  | "DUPLICATE_EDGE_ID"
  | "DUPLICATE_BUTTON_IDS"
  | "INVALID_FOLLOWUP_EXIT_TARGET"
  | "INVALID_FOLLOWUP_BUTTON_TARGET"
  | "SELF_REFERENCING_FOLLOWUP"
  | "DUPLICATE_NODE_LABEL"
  | "RESERVED_NODE_LABEL_PREFIX"
  | "INVALID_BUTTON_TARGET"
  // Plugin errors
  | "INVALID_PLUGIN_PARENT"
  | "INVALID_PLUGIN_EXIT_TARGET"
  | "INVALID_PLUGIN_BUTTON_TARGET"
  | "SELF_REFERENCING_PLUGIN"
  // Warnings (SHOULD fix)
  | "DEAD_END_NODE"
  | "BUTTON_TARGET_EDGE_MISMATCH"
  | "UNREACHABLE_END_NODE"
  | "MISSING_DEFAULT_BRANCH"
  | "DUPLICATE_BUTTON_LABELS"
  | "EMPTY_MESSAGE_CONTENT"
  | "MISSING_WEBHOOK_ERROR_EDGE"
  | "DISCONNECTED_BUTTON"
  | "MISSING_TEXT_RESPONSE_EDGE"
  | "MISSING_QUESTIONNAIRE_TIMEOUT_EDGE"
  | "MISSING_AGENT_TIMEOUT_EDGE";

/**
 * Single validation issue from journey structure validation.
 */
export interface JourneyValidationIssue {
  code: ValidationErrorCode;
  severity: ValidationSeverity;
  message: string;
  nodeId?: string;
  edgeId?: string;
  details?: Record<string, unknown>;
}

/**
 * Complete validation result from journey structure validation.
 */
export interface JourneyValidationResult {
  /** Whether the journey is valid (no errors) */
  valid: boolean;
  /** List of errors (must fix) */
  errors: JourneyValidationIssue[];
  /** List of warnings (should fix) */
  warnings: JourneyValidationIssue[];
  /** Summary statistics */
  summary: {
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<string, number>;
    hasTimers: boolean;
    hasConditions: boolean;
    hasWebhooks: boolean;
    maxPathLength?: number;
  };
}
