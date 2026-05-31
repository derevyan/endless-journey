/**
 * Journey Structure Validator
 *
 * Validates journey configurations to catch errors before runtime:
 * - Graph connectivity (all nodes reachable from start)
 * - Edge validity (all edges reference existing nodes)
 * - Start/End presence (exactly one start, at least one end)
 * - Cycle detection (no infinite auto-transition loops)
 * - Branch coverage (condition nodes have edges for all branches)
 * - Timer edge matching (nodes with timers have timer edges)
 *
 * @module schemas/validation/journey-validator
 */

import type {
  JourneyConfig,
  JourneyNodeData,
  JourneyEdgeData,
} from "../../journey";
import type {
  JourneyValidationIssue,
  JourneyValidationResult,
  ValidationErrorCode,
  ValidationSeverity,
} from "../../frontend-engine-types";
import { isFollowUpPluginData } from "../../plugins/type-guards";
import {
  buildGraph,
  findOrphanNodes,
  findDeadEndNodes,
  findDanglingEdges,
  detectCycles,
  hasDangerousCycle,
  type Graph,
} from "./graph-utils";
import { sanitizeNodeLabel, RESERVED_NODE_OUTPUT_PREFIXES } from "./node-label";

// =============================================================================
// TYPES (re-exported from session for consumers)
// =============================================================================

/**
 * Re-export validation types from frontend-engine-types.
 * Types are defined there to maintain single source of truth.
 */
export type {
  ValidationSeverity,
  ValidationErrorCode,
  JourneyValidationIssue,
  JourneyValidationResult,
} from "../../frontend-engine-types";

// Local type aliases for internal use (maintains code compatibility)
type ValidationError = JourneyValidationIssue;
type ValidationResult = JourneyValidationResult;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate that journey has exactly one start node
 */
export function validateStartNode(journey: JourneyConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const startNodes = journey.nodes.filter((n) => n.data.type === "start");

  if (startNodes.length === 0) {
    errors.push({
      code: "NO_START_NODE",
      severity: "error",
      message: "Journey must have exactly one start node",
    });
  } else if (startNodes.length > 1) {
    for (let i = 1; i < startNodes.length; i++) {
      errors.push({
        code: "MULTIPLE_START_NODES",
        severity: "error",
        message: "Journey must have exactly one start node",
        nodeId: startNodes[i].id,
      });
    }
  }

  return errors;
}

/**
 * Validate that journey has at least one end node
 */
export function validateEndNode(journey: JourneyConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const endNodes = journey.nodes.filter((n) => n.data.type === "end");

  if (endNodes.length === 0) {
    errors.push({
      code: "NO_END_NODE",
      severity: "error",
      message: "Journey must have at least one end node",
    });
  }

  return errors;
}

/**
 * Validate that all nodes have unique IDs
 */
export function validateUniqueNodeIds(journey: JourneyConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, number>();

  for (const node of journey.nodes) {
    const count = seen.get(node.id) || 0;
    if (count > 0) {
      errors.push({
        code: "DUPLICATE_NODE_ID",
        severity: "error",
        message: `Duplicate node ID: ${node.id}`,
        nodeId: node.id,
      });
    }
    seen.set(node.id, count + 1);
  }

  return errors;
}

/**
 * Validate that all edges have unique IDs
 */
export function validateUniqueEdgeIds(journey: JourneyConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, number>();

  for (const edge of journey.edges) {
    const count = seen.get(edge.id) || 0;
    if (count > 0) {
      errors.push({
        code: "DUPLICATE_EDGE_ID",
        severity: "error",
        message: `Duplicate edge ID: ${edge.id}`,
        edgeId: edge.id,
      });
    }
    seen.set(edge.id, count + 1);
  }

  return errors;
}

/**
 * Validate that node labels are unique when sanitized
 *
 * Node outputs are keyed by sanitized labels (e.g., "Get Customer" -> "Get_Customer").
 * Duplicate sanitized labels cause data to be overwritten silently in nodeOutputs.
 */
export function validateUniqueNodeLabels(journey: JourneyConfig): ValidationError[] {
  const warnings: ValidationError[] = [];
  const sanitizedToNodes = new Map<string, string[]>();

  for (const node of journey.nodes) {
    const label = node.data.label;
    if (!label) continue; // Skip nodes without labels

    const sanitized = sanitizeNodeLabel(label);
    const existing = sanitizedToNodes.get(sanitized) || [];
    existing.push(node.id);
    sanitizedToNodes.set(sanitized, existing);
  }

  // Report all collisions
  for (const [sanitized, nodeIds] of sanitizedToNodes) {
    if (nodeIds.length > 1) {
      warnings.push({
        code: "DUPLICATE_NODE_LABEL",
        severity: "warning",
        message: `Multiple nodes have the same sanitized label "${sanitized}" - nodeOutputs will be overwritten`,
        details: { sanitizedLabel: sanitized, nodeIds },
      });
    }
  }

  return warnings;
}

/**
 * Validate that node labels don't use reserved prefixes
 *
 * Internal engine state uses reserved prefixes like "__state_" and "node_".
 * User node labels that sanitize to these prefixes would collide with internal storage.
 */
export function validateNodeLabelReservedPrefixes(journey: JourneyConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of journey.nodes) {
    const label = node.data.label;
    if (!label) continue; // Skip nodes without labels

    const sanitized = sanitizeNodeLabel(label);

    // Check if sanitized label starts with any reserved prefix
    for (const prefix of RESERVED_NODE_OUTPUT_PREFIXES) {
      if (sanitized.startsWith(prefix)) {
        errors.push({
          code: "RESERVED_NODE_LABEL_PREFIX",
          severity: "error",
          message: `Node label "${label}" uses reserved prefix "${prefix}" - this may conflict with internal state storage`,
          nodeId: node.id,
          details: { label, sanitizedLabel: sanitized, reservedPrefix: prefix },
        });
        break; // Only report first matching prefix
      }
    }
  }

  return errors;
}

/**
 * Validate that all edges reference existing nodes
 */
export function validateEdgeReferences(journey: JourneyConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  // Note: Plugins are now embedded in node.data.plugins[] - no separate pluginNodes to index
  const nodeIds = new Set(journey.nodes.map((n) => n.id));

  for (const edge of journey.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        code: "DANGLING_EDGE_SOURCE",
        severity: "error",
        message: `Edge references non-existent source node: ${edge.source}`,
        edgeId: edge.id,
        details: { source: edge.source },
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        code: "DANGLING_EDGE_TARGET",
        severity: "error",
        message: `Edge references non-existent target node: ${edge.target}`,
        edgeId: edge.id,
        details: { target: edge.target },
      });
    }
  }

  return errors;
}

/**
 * Validate that all nodes are reachable from start
 */
export function validateNodeReachability(graph: Graph): ValidationError[] {
  const errors: ValidationError[] = [];
  const orphans = findOrphanNodes(graph);

  for (const nodeId of orphans) {
    const node = graph.nodes.get(nodeId);
    // Start nodes without edges are a different error (handled in validateStartNode)
    if (node && node.data.type !== "start") {
      errors.push({
        code: "ORPHAN_NODE",
        severity: "error",
        message: `Node is not reachable from start: ${nodeId}`,
        nodeId,
      });
    }
  }

  return errors;
}

/**
 * Validate that condition nodes have edges for all branches
 */
export function validateConditionBranches(journey: JourneyConfig, graph: Graph): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "condition") continue;

    const conditionData = node.data;
    const branches = conditionData.branches || [];
    const outEdges = graph.outEdges.get(node.id) || [];

    // If edges have sourceHandle, check that each branch has a matching edge
    // If edges don't have sourceHandle, check that there are enough edges for branches
    const edgesWithSourceHandle = outEdges.filter((e) => e.sourceHandle);

    if (edgesWithSourceHandle.length > 0) {
      // Strict mode: edges use sourceHandle, verify each branch has a matching edge
      const branchEdges = new Map<string, boolean>();
      for (const edge of edgesWithSourceHandle) {
        branchEdges.set(edge.sourceHandle!, true);
      }

      for (const branch of branches) {
        if (!branchEdges.has(branch.id)) {
          errors.push({
            code: "MISSING_CONDITION_BRANCH_EDGE",
            severity: "error",
            message: `Condition node missing edge for branch: ${branch.label}`,
            nodeId: node.id,
            details: { branchId: branch.id, branchLabel: branch.label },
          });
        }
      }
    } else {
      // Lenient mode: edges don't use sourceHandle, verify there are enough edges
      if (branches.length > 0 && outEdges.length < branches.length) {
        errors.push({
          code: "MISSING_CONDITION_BRANCH_EDGE",
          severity: "error",
          message: `Condition node has ${branches.length} branches but only ${outEdges.length} outgoing edges`,
          nodeId: node.id,
          details: { branchCount: branches.length, edgeCount: outEdges.length },
        });
      }
    }

    // Check for default branch (warning)
    const hasDefault = branches.some((b) => b.isDefault);
    if (!hasDefault && branches.length > 0) {
      errors.push({
        code: "MISSING_DEFAULT_BRANCH",
        severity: "warning",
        message: "Condition node has no default branch - execution may fail if no conditions match",
        nodeId: node.id,
      });
    }
  }

  return errors;
}

/**
 * Validate that nodes with timers have timer edges
 */
export function validateTimerEdges(journey: JourneyConfig, graph: Graph): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "message") continue;

    const messageData = node.data;
    if (!messageData.timer) continue;

    // Node has a timer - check for timer edge
    // Accept edges with sourceHandle === "timer" OR edgeType === "timer"
    const outEdges = graph.outEdges.get(node.id) || [];
    const hasTimerEdge = outEdges.some((e) => e.sourceHandle === "timer" || e.edgeType === "timer");

    if (!hasTimerEdge) {
      errors.push({
        code: "MISSING_TIMER_EDGE",
        severity: "error",
        message: "Message node has timer but no timer edge",
        nodeId: node.id,
        details: { timerSeconds: messageData.timer.seconds },
      });
    }
  }

  return errors;
}

/**
 * Validate that questionnaire nodes with timeout have timeout edges or targetNodeId
 */
export function validateQuestionnaireTimeoutEdges(journey: JourneyConfig, graph: Graph): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "questionnaire") continue;

    const questionnaireData = node.data as { timeout?: { seconds: number; targetNodeId?: string } };
    if (!questionnaireData.timeout || questionnaireData.timeout.seconds <= 0) continue;

    // Node has timeout configured - check for edge or targetNodeId
    const hasTargetNodeId = !!questionnaireData.timeout.targetNodeId;

    if (!hasTargetNodeId) {
      // No targetNodeId, must have a timeout edge
      const outEdges = graph.outEdges.get(node.id) || [];
      const hasTimeoutEdge = outEdges.some((e) => e.sourceHandle === "timer" || e.edgeType === "timer");

      if (!hasTimeoutEdge) {
        errors.push({
          code: "MISSING_QUESTIONNAIRE_TIMEOUT_EDGE",
          severity: "warning",
          message: "Questionnaire with timeout needs a timeout path",
          nodeId: node.id,
          details: { timeoutSeconds: questionnaireData.timeout.seconds },
        });
      }
    }
  }

  return errors;
}

/**
 * Validate that agent nodes with timeout have timeout edges
 */
export function validateAgentTimeoutEdges(journey: JourneyConfig, graph: Graph): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "agent") continue;

    const agentData = node.data as { timeout?: { seconds: number } };
    if (!agentData.timeout || agentData.timeout.seconds <= 0) continue;

    // Agent has timeout configured - must have a timer edge
    const outEdges = graph.outEdges.get(node.id) || [];
    const hasTimeoutEdge = outEdges.some((e) => e.sourceHandle === "timer" || e.edgeType === "timer");

    if (!hasTimeoutEdge) {
      errors.push({
        code: "MISSING_AGENT_TIMEOUT_EDGE",
        severity: "warning",
        message: "Agent with timeout needs a timeout edge",
        nodeId: node.id,
        details: { timeoutSeconds: agentData.timeout.seconds },
      });
    }
  }

  return errors;
}

/**
 * Detect dangerous cycles (auto-transition loops)
 */
export function validateNoCycles(graph: Graph): ValidationError[] {
  const errors: ValidationError[] = [];
  const cycles = detectCycles(graph);

  for (const cycle of cycles) {
    if (cycle.isAutoTransitionCycle) {
      errors.push({
        code: "AUTO_TRANSITION_CYCLE",
        severity: "error",
        message: "Journey contains an infinite auto-transition loop",
        details: {
          cycleNodes: cycle.cycleNodes,
          isAutoTransitionCycle: true,
        },
      });
    }
  }

  return errors;
}

/**
 * Find dead-end nodes (nodes that can't reach any end)
 */
export function validateNoDeadEnds(graph: Graph): ValidationError[] {
  const warnings: ValidationError[] = [];
  const deadEnds = findDeadEndNodes(graph);

  for (const nodeId of deadEnds) {
    warnings.push({
      code: "DEAD_END_NODE",
      severity: "warning",
      message: "Node cannot reach any end node",
      nodeId,
    });
  }

  return warnings;
}

/**
 * Validate message nodes don't have empty content
 */
export function validateMessageContent(journey: JourneyConfig): ValidationError[] {
  const warnings: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "message") continue;

    const messageData = node.data;
    if (!messageData.content || messageData.content.trim() === "") {
      warnings.push({
        code: "EMPTY_MESSAGE_CONTENT",
        severity: "warning",
        message: "Message node has empty content",
        nodeId: node.id,
      });
    }
  }

  return warnings;
}

/**
 * Validate button IDs are unique within a node
 */
export function validateUniqueButtonLabels(journey: JourneyConfig): ValidationError[] {
  const warnings: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "message") continue;

    const messageData = node.data;
    if (!messageData.buttons || messageData.buttons.length === 0) continue;

    const seenIds = new Set<string>();
    const seenTexts = new Set<string>();
    const duplicateIds: string[] = [];
    const duplicateTexts: string[] = [];

    for (const button of messageData.buttons) {
      // Check for duplicate IDs (critical - breaks routing)
      if (seenIds.has(button.id)) {
        duplicateIds.push(button.id);
      }
      seenIds.add(button.id);

      // Check for duplicate texts (warning - confusing UX)
      if (seenTexts.has(button.text)) {
        duplicateTexts.push(button.text);
      }
      seenTexts.add(button.text);
    }

    if (duplicateIds.length > 0) {
      warnings.push({
        code: "DUPLICATE_BUTTON_IDS",
        severity: "error",
        message: `Message node has duplicate button IDs: ${duplicateIds.join(", ")}`,
        nodeId: node.id,
        details: { duplicateIds },
      });
    }

    if (duplicateTexts.length > 0) {
      warnings.push({
        code: "DUPLICATE_BUTTON_LABELS",
        severity: "warning",
        message: `Message node has duplicate button labels: ${duplicateTexts.join(", ")}`,
        nodeId: node.id,
        details: { duplicateTexts },
      });
    }
  }

  return warnings;
}

/**
 * Validate webhook nodes have error handling edge
 */
export function validateWebhookErrorEdges(journey: JourneyConfig, graph: Graph): ValidationError[] {
  const warnings: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "webhook") continue;

    const outEdges = graph.outEdges.get(node.id) || [];
    // Check for error edge (sourceHandle="error", edgeType="retry"/"exit", or labeled "error")
    const hasErrorEdge = outEdges.some(
      (e) =>
        e.sourceHandle === "error" ||
        e.edgeType === "retry" ||
        e.edgeType === "exit" ||
        e.label?.toLowerCase() === "error"
    );

    if (!hasErrorEdge && outEdges.length > 0) {
      warnings.push({
        code: "MISSING_WEBHOOK_ERROR_EDGE",
        severity: "warning",
        message: "Webhook node has no error handling edge",
        nodeId: node.id,
      });
    }
  }

  return warnings;
}

/**
 * Validate message nodes with buttons have proper edge coverage
 * - responseType "buttons": ALL buttons must be connected
 * - responseType "any": ALL buttons + default edge for text
 * - responseType "text": needs default edge
 * - responseType "auto": needs at least one edge
 */
export function validateMessageButtonConnections(journey: JourneyConfig, graph: Graph): ValidationError[] {
  const warnings: ValidationError[] = [];

  for (const node of journey.nodes) {
    if (node.data.type !== "message") continue;

    const messageData = node.data;
    const buttons = messageData.buttons || [];
    const responseType = messageData.responseType || "auto";
    const outEdges = graph.outEdges.get(node.id) || [];
    const nonTimerEdges = outEdges.filter((e) => e.edgeType !== "timer");

    // Check buttons for "buttons" and "any" response types
    if ((responseType === "buttons" || responseType === "any") && buttons.length > 0) {
      const disconnectedButtons = buttons.filter((btn) => !btn.targetNodeId);

      for (const btn of disconnectedButtons) {
        warnings.push({
          code: "DISCONNECTED_BUTTON",
          severity: "warning",
          message: `Button "${btn.text}" is not connected to any path`,
          nodeId: node.id,
          details: { buttonId: btn.id, buttonText: btn.text },
        });
      }
    }

    // Check for text response edge for "any" and "text" types
    if (responseType === "any" || responseType === "text") {
      // Need at least one non-button edge (edge without sourceHandle matching a button id)
      const buttonIds = new Set(buttons.map((b) => b.id));
      const textEdges = nonTimerEdges.filter((e) => !e.sourceHandle || !buttonIds.has(e.sourceHandle));

      if (textEdges.length === 0) {
        warnings.push({
          code: "MISSING_TEXT_RESPONSE_EDGE",
          severity: "warning",
          message:
            responseType === "any"
              ? "Node accepts text responses but has no path for text input"
              : "Text response node has no path for text input",
          nodeId: node.id,
        });
      }
    }
  }

  return warnings;
}

/**
 * Validate button targetNodeIds reference existing nodes
 * and match their corresponding edge targets
 *
 * Catches two issues:
 * 1. Button targetNodeId references non-existent node (ERROR)
 * 2. Button targetNodeId doesn't match edge target (WARNING)
 *
 * The second case can happen when:
 * - UI and edges become out of sync
 * - Manual JSON editing introduces inconsistencies
 */
export function validateButtonTargets(journey: JourneyConfig, graph: Graph): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(journey.nodes.map((n) => n.id));

  for (const node of journey.nodes) {
    // Only message nodes can have buttons in the schema
    if (node.data.type !== "message") continue;

    const nodeData = node.data;
    const buttons = (nodeData as { buttons?: Array<{ id: string; text: string; targetNodeId?: string }> }).buttons || [];
    const outEdges = graph.outEdges.get(node.id) || [];

    for (const button of buttons) {
      if (!button.targetNodeId) continue; // Skip buttons without target (handled by DISCONNECTED_BUTTON)

      // 1. Check if targetNodeId references existing node
      if (!nodeIds.has(button.targetNodeId)) {
        errors.push({
          code: "INVALID_BUTTON_TARGET",
          severity: "error",
          message: `Button "${button.text}" references non-existent node: ${button.targetNodeId}`,
          nodeId: node.id,
          details: { buttonId: button.id, targetNodeId: button.targetNodeId },
        });
        continue; // Skip edge mismatch check for invalid targets
      }

      // 2. Check if edge target matches button targetNodeId
      // Find edge by sourceHandle matching button id, or by managedBy property
      const matchingEdge = outEdges.find(
        (e) =>
          e.sourceHandle === button.id ||
          (e as { managedBy?: string }).managedBy === `button-${button.id}`
      );

      if (matchingEdge && matchingEdge.target !== button.targetNodeId) {
        errors.push({
          code: "BUTTON_TARGET_EDGE_MISMATCH",
          severity: "warning",
          message: `Button "${button.text}" targets "${button.targetNodeId}" but edge targets "${matchingEdge.target}"`,
          nodeId: node.id,
          edgeId: matchingEdge.id,
          details: {
            buttonId: button.id,
            buttonTarget: button.targetNodeId,
            edgeTarget: matchingEdge.target,
          },
        });
      }
    }
  }

  return errors;
}

/**
 * Validate plugin node references
 *
 * Plugins are now embedded in node.data.plugins[] (new format).
 * The old pluginNodes[] array format is no longer supported.
 *
 * @param _journey - Journey configuration (unused)
 * @returns Empty array - legacy validation removed
 */
export function validatePluginReferences(_journey: JourneyConfig): ValidationError[] {
  // Plugins are now embedded in node.data.plugins[]
  // This function is kept for API compatibility but does nothing
  return [];
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a journey configuration
 *
 * @param journey - Journey configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateJourneyStructure(journey: JourneyConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Build graph for analysis
  const graph = buildGraph(journey);

  // Collect node type statistics
  const nodeTypes: Record<string, number> = {};
  let hasTimers = false;
  let hasConditions = false;
  let hasWebhooks = false;

  for (const node of journey.nodes) {
    const type = node.data.type;
    nodeTypes[type] = (nodeTypes[type] || 0) + 1;

    if (type === "condition") hasConditions = true;
    if (type === "webhook") hasWebhooks = true;
    if (type === "message" && node.data.timer) hasTimers = true;
    if (type === "wait") hasTimers = true;
  }

  // Run all validations
  // Errors (must fix)
  errors.push(...validateStartNode(journey));
  errors.push(...validateEndNode(journey));
  errors.push(...validateUniqueNodeIds(journey));
  errors.push(...validateUniqueEdgeIds(journey));
  errors.push(...validateEdgeReferences(journey));
  errors.push(...validateNodeLabelReservedPrefixes(journey));
  errors.push(...validatePluginReferences(journey));

  // Only run graph-dependent validations if we have valid structure
  if (graph.startNodeId && errors.filter((e) => e.code === "DANGLING_EDGE_SOURCE" || e.code === "DANGLING_EDGE_TARGET").length === 0) {
    errors.push(...validateNodeReachability(graph));
    // validateConditionBranches returns both errors and warnings - split them
    const conditionResults = validateConditionBranches(journey, graph);
    for (const result of conditionResults) {
      if (result.severity === "error") {
        errors.push(result);
      } else {
        warnings.push(result);
      }
    }
    errors.push(...validateTimerEdges(journey, graph));
    errors.push(...validateNoCycles(graph));

    // validateButtonTargets returns both errors and warnings - split them
    const buttonResults = validateButtonTargets(journey, graph);
    for (const result of buttonResults) {
      if (result.severity === "error") {
        errors.push(result);
      } else {
        warnings.push(result);
      }
    }
  }

  // Warnings (should fix)
  if (graph.startNodeId) {
    warnings.push(...validateNoDeadEnds(graph));
  }
  warnings.push(...validateMessageContent(journey));
  warnings.push(...validateUniqueButtonLabels(journey));
  warnings.push(...validateUniqueNodeLabels(journey));
  warnings.push(...validateMessageButtonConnections(journey, graph));
  warnings.push(...validateWebhookErrorEdges(journey, graph));
  warnings.push(...validateQuestionnaireTimeoutEdges(journey, graph));
  warnings.push(...validateAgentTimeoutEdges(journey, graph));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalNodes: journey.nodes.length,
      totalEdges: journey.edges.length,
      nodeTypes,
      hasTimers,
      hasConditions,
      hasWebhooks,
    },
  };
}

/**
 * Quick validation check - returns true if valid, false otherwise
 */
export function isValidJourney(journey: JourneyConfig): boolean {
  return validateJourneyStructure(journey).valid;
}

/**
 * Get only errors (skip warnings) for quick checks
 */
export function getJourneyErrors(journey: JourneyConfig): ValidationError[] {
  return validateJourneyStructure(journey).errors;
}

/**
 * Format validation result as human-readable string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push("✅ Journey is valid");
  } else {
    lines.push("❌ Journey has validation errors");
  }

  lines.push("");
  lines.push(`Summary: ${result.summary.totalNodes} nodes, ${result.summary.totalEdges} edges`);
  lines.push(`Node types: ${JSON.stringify(result.summary.nodeTypes)}`);

  if (result.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const error of result.errors) {
      const location = error.nodeId ? ` (node: ${error.nodeId})` : error.edgeId ? ` (edge: ${error.edgeId})` : "";
      lines.push(`  ❌ [${error.code}]${location}: ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      const location = warning.nodeId ? ` (node: ${warning.nodeId})` : warning.edgeId ? ` (edge: ${warning.edgeId})` : "";
      lines.push(`  ⚠️ [${warning.code}]${location}: ${warning.message}`);
    }
  }

  return lines.join("\n");
}
