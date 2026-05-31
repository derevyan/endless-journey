/**
 * Issue Detector
 *
 * Detects issues in journey execution for AI analysis.
 *
 * @module @journey/ai-report/analyzers/issue-detector
 */

import type {
  DetectedIssue,
  JourneyLogEntry,
  ButtonClickDetail,
  ErrorDetail,
  TransitionDetail,
} from "../schemas";
import { DETECTION_THRESHOLDS } from "../constants";

/**
 * Detect issues in journey execution.
 */
export function detectIssues(
  journeyLog: JourneyLogEntry[],
  buttonClicks: ButtonClickDetail[],
  errors: ErrorDetail[],
  transitions: TransitionDetail[]
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // 1. Detect execution errors
  for (const error of errors) {
    issues.push({
      severity: "error",
      category: "execution_error",
      nodeId: error.nodeId,
      timestamp: error.timestamp,
      message: error.message,
      suggestion:
        "Review the error details and fix the underlying issue in the node configuration.",
    });
  }

  // 2. Detect button click failures
  for (const click of buttonClicks) {
    if (click.outcome === "transition_success" || click.outcome === "agent_reexecute") {
      continue;
    }

    let suggestion: string;
    switch (click.outcome) {
      case "button_not_found":
        suggestion = `Button '${click.buttonId}' is not registered. Check if the button was properly sent in the previous message.`;
        break;
      case "edge_not_found":
        suggestion = `Add an edge from node '${click.currentNodeId}' with sourceHandle '${click.buttonId}' to connect the button to a target node.`;
        break;
      case "guard_blocked":
        suggestion =
          "Review the guard condition on the edge. The current user context doesn't pass the guard.";
        break;
      default:
        suggestion = "Review the button configuration and edge setup in the journey editor.";
    }

    issues.push({
      severity: "error",
      category: "button_click_ignored",
      nodeId: click.currentNodeId,
      timestamp: click.timestamp,
      message: `Button '${click.buttonLabel || click.buttonId}' was clicked but no transition occurred (${click.outcome})`,
      suggestion,
      context: {
        buttonId: click.buttonId,
        outcome: click.outcome,
        failureReason: click.failureReason,
        activeButtonCount: click.activeButtonsAtClick?.length || 0,
      },
      relatedButtonClick: click.clickId,
    });
  }

  // 3. Detect repeated nodes (potential loop)
  // Build lookup maps in O(n) to avoid O(n²) searches later
  const nodeVisitCount = new Map<string, number>();
  const firstTransitionToNode = new Map<string, TransitionDetail>();

  for (const transition of transitions) {
    const { toNodeId } = transition;
    const count = nodeVisitCount.get(toNodeId) || 0;
    nodeVisitCount.set(toNodeId, count + 1);

    // Store first transition to each node for context
    if (!firstTransitionToNode.has(toNodeId)) {
      firstTransitionToNode.set(toNodeId, transition);
    }
  }

  for (const [nodeId, count] of nodeVisitCount) {
    if (count >= DETECTION_THRESHOLDS.REPEATED_NODE_VISIT_COUNT) {
      const transition = firstTransitionToNode.get(nodeId);
      issues.push({
        severity: "info",
        category: "repeated_node",
        nodeId,
        timestamp: transition?.timestamp,
        message: `Node '${transition?.toNodeLabel || nodeId}' was visited ${count} times. This might indicate an unexpected loop.`,
        suggestion: "Review the journey flow to ensure this repetition is intentional.",
        context: { visitCount: count },
      });
    }
  }

  // 4. Detect slow transitions (if we have timing data)
  for (const transition of transitions) {
    if (
      transition.durationAtPreviousNodeMs &&
      transition.durationAtPreviousNodeMs > DETECTION_THRESHOLDS.SLOW_NODE_DURATION_MS
    ) {
      issues.push({
        severity: "warning",
        category: "slow_node",
        nodeId: transition.fromNodeId,
        timestamp: transition.timestamp,
        message: `User spent ${Math.round(transition.durationAtPreviousNodeMs / 1000)}s at node '${transition.fromNodeLabel || transition.fromNodeId}'`,
        suggestion:
          "Consider if this delay is expected. Long wait times might indicate user confusion.",
        context: { durationMs: transition.durationAtPreviousNodeMs },
      });
    }
  }

  // 5. Detect guard blocks
  const guardBlockedEvents = journeyLog.filter((e) => e.eventType === "guard_blocked");
  for (const event of guardBlockedEvents) {
    issues.push({
      severity: "warning",
      category: "guard_blocked",
      nodeId: event.nodeId,
      timestamp: event.timestamp,
      message: `Guard blocked transition at node '${event.nodeLabel || event.nodeId}'`,
      suggestion: "Review the guard condition. User context may not meet the requirements.",
      context: event.payload as Record<string, unknown>,
    });
  }

  return issues;
}
