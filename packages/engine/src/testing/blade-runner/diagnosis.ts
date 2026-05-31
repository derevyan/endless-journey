/**
 * Blade Runner - Error Diagnosis
 *
 * Intelligent error classification system that distinguishes between:
 * - Journey design issues (user should fix)
 * - Engine bugs (we should fix)
 * - Test limitations (infrastructure issues)
 *
 * @module engine/testing/blade-runner/diagnosis
 */

import type { JourneyConfig, MessageNodeData } from "@journey/schemas";
import type { VariationResult } from "../types";
import type { DiagnosedIssue, IssueCategory, IssueSeverity, IssueGroup, NodeContext, TimingBreakdown } from "./types";

// =============================================================================
// ERROR PATTERNS
// =============================================================================

interface ErrorPattern {
  /** Regex or string patterns to match */
  patterns: (string | RegExp)[];
  /** Category to assign */
  category: IssueCategory;
  /** Severity level */
  severity: IssueSeverity;
  /** Title template (can use {node}, {edge}, {button} placeholders) */
  titleTemplate: string;
  /** What likely caused this */
  likelyCause: string;
  /** How to fix it */
  suggestedFix: string;
}

/**
 * Journey Design Issues - User's journey has a structural problem
 */
const JOURNEY_DESIGN_PATTERNS: ErrorPattern[] = [
  {
    patterns: ["no edge found", "edge not found", "missing edge"],
    category: "journey_design",
    severity: "critical",
    titleTemplate: "Missing Edge from {node}",
    likelyCause:
      "A button or action exists but there's no corresponding edge to handle the transition.",
    suggestedFix:
      "Add an edge from the source node with the correct sourceHandle to the target node.",
  },
  {
    patterns: ["unreachable node", "orphan node", "no incoming edges"],
    category: "journey_design",
    severity: "warning",
    titleTemplate: "Unreachable Node: {node}",
    likelyCause: "This node exists but cannot be reached from any other node in the journey.",
    suggestedFix: "Either add an edge leading to this node or remove it if not needed.",
  },
  {
    patterns: ["dead end", "no outgoing edges", "terminal node without end type"],
    category: "journey_design",
    severity: "warning",
    titleTemplate: "Dead End at {node}",
    likelyCause: "The path ends at a non-terminal node with no way to continue.",
    suggestedFix: "Add outgoing edges or change the node type to 'end' if this is intentional.",
  },
  {
    patterns: ["invalid condition", "condition evaluation failed", "expression error"],
    category: "journey_design",
    severity: "critical",
    titleTemplate: "Invalid Condition at {node}",
    likelyCause: "The condition expression has a syntax error or references undefined variables.",
    suggestedFix: "Check the condition syntax and ensure all referenced context variables exist.",
  },
  {
    patterns: ["button not found", "missing button", "unknown button id"],
    category: "journey_design",
    severity: "critical",
    titleTemplate: "Missing Button: {button}",
    likelyCause: "An edge references a button handle that doesn't exist on the source node.",
    suggestedFix: "Either add the button to the node or update the edge's sourceHandle.",
  },
  {
    patterns: ["duplicate node id", "node already exists"],
    category: "journey_design",
    severity: "critical",
    titleTemplate: "Duplicate Node ID: {node}",
    likelyCause: "Two nodes in the journey have the same ID.",
    suggestedFix: "Ensure all node IDs are unique.",
  },
  {
    patterns: ["circular reference", "infinite loop in journey"],
    category: "journey_design",
    severity: "warning",
    titleTemplate: "Circular Path Detected",
    likelyCause: "The journey contains a loop without proper exit conditions.",
    suggestedFix: "Add a condition edge to break out of the loop or redesign the flow.",
  },
  {
    patterns: ["no timeout edge resolved", "missing timer edge", "timeout edge"],
    category: "journey_design",
    severity: "warning",
    titleTemplate: "Missing Timeout Edge at {node}",
    likelyCause: "A timeout was triggered but the node has no timer edge configured.",
    suggestedFix: "Add a timer edge from the node or remove the timeout configuration.",
  },
];

/**
 * Engine Bugs - Something unexpected happened in the engine
 */
const ENGINE_BUG_PATTERNS: ErrorPattern[] = [
  {
    patterns: ["internal error", "unexpected error", "engine error"],
    category: "engine_bug",
    severity: "critical",
    titleTemplate: "Internal Engine Error",
    likelyCause: "An unexpected condition occurred in the engine that wasn't properly handled.",
    suggestedFix: "This is likely a bug in the engine. Please report with the error details.",
  },
  {
    patterns: ["handler not found", "no handler for node type", "unknown node type"],
    category: "engine_bug",
    severity: "critical",
    titleTemplate: "Missing Handler for {node}",
    likelyCause: "The engine doesn't have a handler registered for this node type.",
    suggestedFix: "This is an engine issue. The node type may be unsupported or misspelled.",
  },
  {
    patterns: [
      "cannot read property",
      "undefined is not an object",
      "null reference",
      "typeerror",
    ],
    category: "engine_bug",
    severity: "critical",
    titleTemplate: "Null Reference Error",
    likelyCause: "The engine tried to access a property on undefined or null.",
    suggestedFix: "This is a bug in the engine. Please report with the full stack trace.",
  },
  {
    patterns: ["state corruption", "invalid session state", "session integrity"],
    category: "engine_bug",
    severity: "critical",
    titleTemplate: "Session State Corruption",
    likelyCause: "The session state became inconsistent during execution.",
    suggestedFix: "This indicates a serious engine bug. Please report immediately.",
  },
  {
    patterns: ["exceeded maximum steps", "infinite loop detected", "step limit"],
    category: "engine_bug",
    severity: "warning",
    titleTemplate: "Execution Loop Detected",
    likelyCause: "The engine got stuck in an execution loop (possibly an engine bug).",
    suggestedFix: "Check if the journey has proper exit conditions. If so, this is an engine bug.",
  },
];

/**
 * Test Limitations - Issues with the test infrastructure itself
 */
const TEST_LIMITATION_PATTERNS: ErrorPattern[] = [
  {
    patterns: ["mock limitation", "mock adapter", "simulation not supported"],
    category: "test_limitation",
    severity: "info",
    titleTemplate: "Mock Adapter Limitation",
    likelyCause: "The test mock doesn't fully support this feature.",
    suggestedFix: "This variation may work in production but can't be tested in the mock.",
  },
  {
    patterns: ["webhook responded with 503", "service temporarily unavailable"],
    category: "test_limitation",
    severity: "warning",
    titleTemplate: "Webhook Throttled",
    likelyCause: "The API could not acquire a session lock in time during parallel runs.",
    suggestedFix: "Reduce --parallel or enable retry/backoff in the parity backend.",
  },
  {
    patterns: ["race condition in test", "timing issue", "test timing"],
    category: "test_limitation",
    severity: "info",
    titleTemplate: "Test Timing Issue",
    likelyCause: "A race condition in the test itself (not the engine).",
    suggestedFix: "Try running with --race-tests to explicitly test timing scenarios.",
  },
  {
    patterns: ["resource exhaustion", "too many concurrent", "memory limit"],
    category: "test_limitation",
    severity: "warning",
    titleTemplate: "Test Resource Limit",
    likelyCause: "Too many concurrent test variations exceeded available resources.",
    suggestedFix: "Reduce concurrency with --parallel flag or run fewer variations.",
  },
];

/**
 * Timeout patterns
 */
const TIMEOUT_PATTERNS: ErrorPattern[] = [
  {
    patterns: ["timed out", "timeout", "operation timed out"],
    category: "timeout",
    severity: "warning",
    titleTemplate: "Operation Timeout at {node}",
    likelyCause: "The operation took longer than the configured timeout.",
    suggestedFix: "Increase timeout with --timeout flag or investigate slow operations.",
  },
];

/**
 * Path divergence patterns - valid routing that differs from expected path
 */
const PATH_DIVERGENCE_PATTERNS: ErrorPattern[] = [
  {
    patterns: ["path diverged", "not in expected path"],
    category: "path_divergence",
    severity: "info",
    titleTemplate: "Path Diverged at {node}",
    likelyCause:
      "The journey took a different valid path than expected, likely due to condition node routing or session context variance.",
    suggestedFix:
      "This is usually not a bug. Review if the actual path is valid for the journey design. Consider if the alternate path detector should recognize this pattern.",
  },
];

/** All patterns combined in priority order */
const ALL_PATTERNS: ErrorPattern[] = [
  ...JOURNEY_DESIGN_PATTERNS,
  ...ENGINE_BUG_PATTERNS,
  ...TEST_LIMITATION_PATTERNS,
  ...TIMEOUT_PATTERNS,
  ...PATH_DIVERGENCE_PATTERNS,
];

// =============================================================================
// DIAGNOSIS ENGINE
// =============================================================================

/**
 * Extract context from error message
 */
function extractContext(
  error: string,
  result: VariationResult
): { node?: string; edge?: string; button?: string } {
  const context: { node?: string; edge?: string; button?: string } = {};

  // Try to extract node ID from error
  const nodeMatch = error.match(/node[:\s]+["']?([a-zA-Z0-9_-]+)["']?/i);
  if (nodeMatch) {
    context.node = nodeMatch[1];
  } else if (result.visitedNodes.length > 0) {
    // Use last visited node
    context.node = result.visitedNodes[result.visitedNodes.length - 1];
  }

  // Try to extract edge ID
  const edgeMatch = error.match(/edge[:\s]+["']?([a-zA-Z0-9_-]+)["']?/i);
  if (edgeMatch) {
    context.edge = edgeMatch[1];
  }

  // Try to extract button ID
  const buttonMatch = error.match(/button[:\s]+["']?([a-zA-Z0-9_-]+)["']?/i);
  if (buttonMatch) {
    context.button = buttonMatch[1];
  }

  return context;
}

/**
 * Extract node context from journey configuration
 */
function extractNodeContext(nodeId: string, journey: JourneyConfig): NodeContext | undefined {
  const node = journey.nodes.find((n) => n.id === nodeId);
  if (!node) return undefined;

  const nodeData = node.data;
  const nodeType = nodeData.type;

  // Find outgoing edges
  const outgoingEdges = journey.edges
    .filter((e) => e.source === nodeId)
    .map((e) => ({
      id: e.id,
      target: e.target,
      type: e.sourceHandle?.includes("default") ? "default" : (e.sourceHandle || "default"),
      label: e.label,
    }));

  // Extract response type and delay for message nodes
  let responseType: string | undefined;
  let delay: number | undefined;
  let label: string | undefined;

  if (nodeType === "message") {
    const msgData = nodeData as MessageNodeData;
    label = msgData.label;
    delay = typeof msgData.delay === "number" ? msgData.delay : undefined;
    // Determine response type
    if (msgData.responseType) {
      responseType = msgData.responseType;
    } else if (msgData.buttons && msgData.buttons.length > 0) {
      responseType = "buttons";
    } else {
      responseType = "auto";
    }
  } else if (nodeType === "questionnaire") {
    responseType = "form";
    label = (nodeData as { label?: string }).label;
  } else {
    label = (nodeData as { label?: string }).label;
  }

  return {
    nodeType,
    label,
    delay,
    responseType,
    outgoingEdges,
  };
}

/**
 * Extract timing breakdown from error and result
 */
function extractTimingBreakdown(error: string, result: VariationResult): TimingBreakdown {
  const breakdown: TimingBreakdown = {
    totalDurationMs: result.durationMs,
  };

  // Try to extract timeout value from error message
  const timeoutMatch = error.match(/(\d+)ms/i);
  if (timeoutMatch) {
    breakdown.configuredTimeoutMs = parseInt(timeoutMatch[1], 10);
  }

  // Try to determine timeout source from error/stack
  if (error.includes("forceEdgeTransition")) {
    breakdown.timeoutSource = "forceEdgeTransition";
  } else if (error.includes("waitForTransition")) {
    breakdown.timeoutSource = "waitForTransition";
  } else if (error.includes("withTimeout")) {
    breakdown.timeoutSource = "withTimeout wrapper";
  }

  return breakdown;
}

/**
 * Generate root cause analysis for timeout issues
 */
function analyzeTimeoutRootCause(
  nodeContext: NodeContext | undefined,
  timingBreakdown: TimingBreakdown
): string[] {
  const analysis: string[] = [];

  if (!nodeContext) {
    analysis.push("⚠ Unable to analyze - node not found in journey");
    return analysis;
  }

  // Check for delayed auto node issue
  if (nodeContext.delay && nodeContext.delay > 0 && nodeContext.responseType === "auto") {
    analysis.push(`⚠ Node has ${nodeContext.delay}s delay but runner expected immediate transition`);
    analysis.push("⚠ Handler was likely sleeping when force-transition was called");
    analysis.push("→ Likely engine bug: test runner races handler delays");
  }

  // Check for timeout source
  if (timingBreakdown.timeoutSource === "forceEdgeTransition") {
    analysis.push(`⚠ Timeout in forceEdgeTransition (${timingBreakdown.configuredTimeoutMs || "?"}ms limit)`);
    if (nodeContext.delay) {
      const delayMs = nodeContext.delay * 1000;
      if (timingBreakdown.configuredTimeoutMs && delayMs > timingBreakdown.configuredTimeoutMs) {
        analysis.push(`⚠ Node delay (${delayMs}ms) exceeds timeout (${timingBreakdown.configuredTimeoutMs}ms)`);
      }
    }
  }

  // Check for many outgoing edges (complex branching)
  if (nodeContext.outgoingEdges.length === 0) {
    analysis.push("⚠ Node has no outgoing edges - dead end?");
  } else if (nodeContext.outgoingEdges.length > 3) {
    analysis.push(`⚠ Node has ${nodeContext.outgoingEdges.length} outgoing edges - complex branching`);
  }

  if (analysis.length === 0) {
    analysis.push("→ Unknown root cause - manual investigation needed");
  }

  return analysis;
}

/**
 * Apply template with context
 */
function applyTemplate(
  template: string,
  context: { node?: string; edge?: string; button?: string }
): string {
  return template
    .replace("{node}", context.node || "unknown")
    .replace("{edge}", context.edge || "unknown")
    .replace("{button}", context.button || "unknown");
}

/**
 * Match error against patterns
 */
function matchPattern(error: string): ErrorPattern | undefined {
  const lowerError = error.toLowerCase();

  for (const pattern of ALL_PATTERNS) {
    for (const p of pattern.patterns) {
      if (typeof p === "string") {
        if (lowerError.includes(p.toLowerCase())) {
          return pattern;
        }
      } else if (p.test(error)) {
        return pattern;
      }
    }
  }

  return undefined;
}

/**
 * Diagnose a single failed variation
 */
export function diagnoseFailure(result: VariationResult, journey?: JourneyConfig): DiagnosedIssue {
  const error = result.error || "Unknown error";
  const pattern = matchPattern(error);
  const context = extractContext(error, result);
  const underivableConditions = result.variation.underivableConditions || [];
  const hasContextGaps = underivableConditions.length > 0;

  // Extract node context and timing breakdown when journey is available
  const nodeContext = context.node && journey
    ? extractNodeContext(context.node, journey)
    : undefined;
  const timingBreakdown = extractTimingBreakdown(error, result);

  // Generate root cause analysis for timeouts
  let rootCauseAnalysis: string[] | undefined;
  if (pattern?.category === "timeout" && nodeContext) {
    rootCauseAnalysis = analyzeTimeoutRootCause(nodeContext, timingBreakdown);
  }

  if (pattern) {
    if (hasContextGaps && pattern.category === "path_divergence") {
      return {
        category: "test_limitation",
        severity: "info",
        title: "Condition Context Not Derivable",
        description: error,
        likelyCause:
          "This path depends on condition context that cannot be derived from the current rules/expressions.",
        suggestedFix:
          "Provide explicit context overrides for this path or simplify the condition logic to be derivable.",
        affectedNode: context.node,
        affectedEdge: context.edge,
        failurePath: result.visitedNodes,
        affectedCount: 1,
        originalError: error,
        nodeContext,
        timingBreakdown,
        rootCauseAnalysis: underivableConditions.map(
          (condition) => `⚠ Unable to derive context for ${condition}`
        ),
      };
    }

    return {
      category: pattern.category,
      severity: pattern.severity,
      title: applyTemplate(pattern.titleTemplate, context),
      description: error,
      likelyCause: pattern.likelyCause,
      suggestedFix: pattern.suggestedFix,
      affectedNode: context.node,
      affectedEdge: context.edge,
      failurePath: result.visitedNodes,
      affectedCount: 1,
      originalError: error,
      nodeContext,
      timingBreakdown,
      rootCauseAnalysis,
    };
  }

  // Unknown error - try to make educated guess
  return {
    category: "unknown",
    severity: "warning",
    title: "Unclassified Error",
    description: error,
    likelyCause: "This error doesn't match known patterns.",
    suggestedFix:
      "Review the error message and stack trace. Consider reporting if it seems like an engine issue.",
    affectedNode: context.node,
    failurePath: result.visitedNodes,
    affectedCount: 1,
    originalError: error,
    nodeContext,
    timingBreakdown,
  };
}

/**
 * Generate a unique key for grouping similar issues
 */
function generateIssueKey(issue: DiagnosedIssue): string {
  // Group by: category + title + affected node
  const parts = [issue.category, issue.title, issue.affectedNode || "global"];
  return parts.join("::");
}

/**
 * Diagnose all failures and group by similarity
 */
export function diagnoseAllFailures(results: VariationResult[], journey?: JourneyConfig): IssueGroup[] {
  const failures = results.filter((result) => {
    if (result.status) {
      return result.status === "failed";
    }

    return !result.success;
  });
  const groups = new Map<string, IssueGroup>();

  for (const result of failures) {
    const issue = diagnoseFailure(result, journey);
    const key = generateIssueKey(issue);

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.variations.push(result);
      group.issue.affectedCount = group.variations.length;
    } else {
      groups.set(key, {
        key,
        issue,
        variations: [result],
      });
    }
  }

  // Sort by severity (critical first) then by affected count (most affected first)
  const severityOrder: Record<IssueSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return Array.from(groups.values()).sort((a, b) => {
    const severityDiff = severityOrder[a.issue.severity] - severityOrder[b.issue.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.issue.affectedCount - a.issue.affectedCount;
  });
}

/**
 * Get summary counts by category
 */
export function getIssueSummary(issues: IssueGroup[]): {
  journeyDesign: number;
  engineBugs: number;
  testLimitations: number;
  timeouts: number;
  pathDivergence: number;
  unknown: number;
} {
  const summary = {
    journeyDesign: 0,
    engineBugs: 0,
    testLimitations: 0,
    timeouts: 0,
    pathDivergence: 0,
    unknown: 0,
  };

  for (const group of issues) {
    switch (group.issue.category) {
      case "journey_design":
        summary.journeyDesign++;
        break;
      case "engine_bug":
        summary.engineBugs++;
        break;
      case "test_limitation":
        summary.testLimitations++;
        break;
      case "timeout":
        summary.timeouts++;
        break;
      case "path_divergence":
        summary.pathDivergence++;
        break;
      default:
        summary.unknown++;
    }
  }

  return summary;
}

/**
 * Get icon for issue category
 */
export function getCategoryIcon(category: IssueCategory): string {
  switch (category) {
    case "journey_design":
      return "🎨";
    case "engine_bug":
      return "🐛";
    case "test_limitation":
      return "🧪";
    case "timeout":
      return "⏰";
    case "path_divergence":
      return "🔀";
    default:
      return "❓";
  }
}

/**
 * Get color for severity
 */
export function getSeverityColor(severity: IssueSeverity): string {
  switch (severity) {
    case "critical":
      return "red";
    case "warning":
      return "yellow";
    case "info":
      return "blue";
  }
}
