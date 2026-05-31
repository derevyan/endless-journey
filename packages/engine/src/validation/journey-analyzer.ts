/**
 * Journey Analyzer
 *
 * Orchestrates journey analysis by combining:
 * - Structural validation (from journey-validator.ts)
 * - Graph metrics (path count, depth, bottlenecks)
 * - Complexity scoring
 *
 * Use this for fast O(n+e) analysis before expensive variation testing.
 *
 * @module engine/validation/journey-analyzer
 */

import type {
  JourneyConfig,
  JourneyNodeData,
  JourneyValidationResult,
  JourneyValidationIssue,
} from "@journey/schemas";
import { validateJourneyStructure } from "./journey-validator";
import {
  buildGraph,
  findAllPaths,
  calculateMaxPathLength,
  type Graph,
  type PathInfo,
} from "./graph-utils";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Journey complexity level
 */
export type ComplexityLevel = "low" | "medium" | "high" | "extreme";

/**
 * Metrics computed during analysis
 */
export interface JourneyMetrics {
  /** Number of unique paths from START to END (-1 if >maxPaths) */
  pathCount: number;
  /** Maximum path length (nodes from START to END) */
  maxDepth: number;
  /** Nodes that ALL paths pass through (excluding START/END) */
  bottleneckNodes: string[];
  /** Average number of outgoing edges per node */
  branchingFactor: number;
  /** Overall complexity assessment */
  complexity: ComplexityLevel;
  /** Complexity score (0-100) */
  complexityScore: number;
}

/**
 * Full analysis result
 */
export interface AnalysisResult extends JourneyValidationResult {
  /** Computed metrics */
  metrics: JourneyMetrics;
  /** Analysis duration in milliseconds */
  analysisTimeMs: number;
}

/**
 * Analysis options
 */
export interface AnalyzerOptions {
  /** Maximum paths to enumerate (default: 10000) */
  maxPaths?: number;
  /** Maximum path length to explore (default: 100) */
  maxPathLength?: number;
  /** Include bottleneck detection (default: true) */
  includeBottlenecks?: boolean;
}

// =============================================================================
// ANALYZER
// =============================================================================

/**
 * Analyze a journey configuration
 *
 * Performs structural validation and computes graph metrics.
 * Much faster than variation testing: O(n+e) vs O(variations).
 *
 * @param journey - Journey configuration to analyze
 * @param options - Analysis options
 * @returns Analysis result with validation and metrics
 */
export function analyzeJourney(
  journey: JourneyConfig,
  options: AnalyzerOptions = {}
): AnalysisResult {
  const startTime = Date.now();

  const {
    maxPaths = 10000,
    maxPathLength = 100,
    includeBottlenecks = true,
  } = options;

  // Step 1: Run existing structural validation
  const validation = validateJourneyStructure(journey);

  // Step 2: Build graph and compute metrics
  const graph = buildGraph(journey);

  // Find paths (cap at maxPaths + 1 to detect overflow)
  const paths = findAllPaths(graph, maxPaths + 1, maxPathLength);
  const pathCount = paths.length > maxPaths ? -1 : paths.length;

  // Calculate max depth
  const maxDepth = calculateMaxPathLength(graph);

  // Find bottleneck nodes
  const bottleneckNodes = includeBottlenecks
    ? findBottleneckNodes(graph, paths.slice(0, Math.min(paths.length, 100)))
    : [];

  // Calculate branching factor
  const branchingFactor = calculateBranchingFactor(graph);

  // Calculate complexity
  const { complexity, score } = calculateComplexity(
    validation,
    pathCount,
    maxDepth,
    branchingFactor
  );

  return {
    ...validation,
    metrics: {
      pathCount,
      maxDepth,
      bottleneckNodes,
      branchingFactor,
      complexity,
      complexityScore: score,
    },
    analysisTimeMs: Date.now() - startTime,
  };
}

// =============================================================================
// METRIC CALCULATIONS
// =============================================================================

/**
 * Find bottleneck nodes - nodes that ALL paths pass through
 *
 * These are interesting because they're single points of failure/control.
 * Excluding START and END nodes (they're always bottlenecks by definition).
 */
function findBottleneckNodes(graph: Graph, paths: PathInfo[]): string[] {
  if (paths.length === 0) return [];

  // Count how many paths each node appears in
  const nodeCounts = new Map<string, number>();
  for (const pathInfo of paths) {
    const uniqueNodes = new Set(pathInfo.path);
    for (const nodeId of uniqueNodes) {
      nodeCounts.set(nodeId, (nodeCounts.get(nodeId) || 0) + 1);
    }
  }

  // Find nodes that appear in ALL paths
  const pathCount = paths.length;
  const bottlenecks: string[] = [];

  for (const [nodeId, count] of nodeCounts) {
    if (count === pathCount) {
      const node = graph.nodes.get(nodeId);
      // Exclude START and END nodes
      if (node && node.data.type !== "start" && node.data.type !== "end") {
        bottlenecks.push(nodeId);
      }
    }
  }

  return bottlenecks;
}

/**
 * Calculate average branching factor
 *
 * Higher branching factor = more possible paths = more complexity
 */
function calculateBranchingFactor(graph: Graph): number {
  let totalOutEdges = 0;
  let nodeCount = 0;

  for (const [nodeId, node] of graph.nodes) {
    // Don't count END nodes (they have no outgoing edges by design)
    if (node.data.type === "end") continue;

    const outEdges = graph.outEdges.get(nodeId) || [];
    totalOutEdges += outEdges.length;
    nodeCount++;
  }

  if (nodeCount === 0) return 0;
  return Math.round((totalOutEdges / nodeCount) * 100) / 100;
}

/**
 * Calculate overall complexity
 *
 * Based on:
 * - Path count (more paths = more complexity)
 * - Max depth (deeper = more complex)
 * - Branching factor (more branches = more complex)
 * - Error count (more errors = more problems to fix)
 */
function calculateComplexity(
  validation: JourneyValidationResult,
  pathCount: number,
  maxDepth: number,
  branchingFactor: number
): { complexity: ComplexityLevel; score: number } {
  let score = 0;

  // Path count component (0-40 points)
  if (pathCount === -1) {
    score += 40; // Overflow = extreme
  } else if (pathCount > 1000) {
    score += 35;
  } else if (pathCount > 100) {
    score += 25;
  } else if (pathCount > 10) {
    score += 15;
  } else {
    score += pathCount * 1.5;
  }

  // Depth component (0-25 points)
  score += Math.min(maxDepth * 1.25, 25);

  // Branching factor component (0-20 points)
  score += Math.min(branchingFactor * 5, 20);

  // Error/warning penalty (0-15 points)
  score += Math.min(validation.errors.length * 5, 10);
  score += Math.min(validation.warnings.length * 1, 5);

  // Clamp to 0-100
  score = Math.round(Math.min(Math.max(score, 0), 100));

  // Determine level
  let complexity: ComplexityLevel;
  if (score <= 25) {
    complexity = "low";
  } else if (score <= 50) {
    complexity = "medium";
  } else if (score <= 75) {
    complexity = "high";
  } else {
    complexity = "extreme";
  }

  return { complexity, score };
}

// =============================================================================
// REPORT FORMATTING
// =============================================================================

/**
 * Format analysis result as human-readable report
 */
export function formatAnalysisReport(result: AnalysisResult, journeyName?: string): string {
  const lines: string[] = [];

  // Header
  lines.push("Journey Analysis Report");
  lines.push("══════════════════════════════════════════════════");
  lines.push("");

  // Journey info
  if (journeyName) {
    lines.push(`Journey: ${journeyName}`);
  }
  lines.push(`Nodes: ${result.summary.totalNodes} | Edges: ${result.summary.totalEdges}`);
  lines.push("");

  // Structure section
  lines.push("Structure");
  lines.push("────────────────────────────────────────");

  // Check results
  const startEndValid = !result.errors.some((e) =>
    ["NO_START_NODE", "MULTIPLE_START_NODES", "NO_END_NODE"].includes(e.code)
  );
  const connectivityValid = !result.errors.some((e) => e.code === "ORPHAN_NODE");
  const cyclesValid = !result.errors.some((e) => e.code === "AUTO_TRANSITION_CYCLE");

  const endCount = result.summary.nodeTypes["end"] || 0;
  lines.push(
    `${startEndValid ? "✓" : "✗"} Start/End: ${
      startEndValid ? `Valid (1 start, ${endCount} end node${endCount !== 1 ? "s" : ""})` : "Invalid"
    }`
  );
  lines.push(
    `${connectivityValid ? "✓" : "✗"} Connectivity: ${
      connectivityValid ? "All nodes reachable" : "Unreachable nodes found"
    }`
  );
  lines.push(
    `${cyclesValid ? "✓" : "✗"} Cycles: ${
      cyclesValid ? "No infinite loops detected" : "Infinite loops detected"
    }`
  );

  // Errors section
  if (result.errors.length > 0) {
    lines.push("");
    lines.push(`Errors (${result.errors.length})`);
    lines.push("────────────────────────────────────────");
    for (const error of result.errors) {
      const location = error.nodeId ? ` [${error.nodeId}]` : "";
      lines.push(`✗ ${error.code}${location}: ${error.message}`);
    }
  }

  // Warnings section
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(`Warnings (${result.warnings.length})`);
    lines.push("────────────────────────────────────────");
    for (const warning of result.warnings.slice(0, 10)) {
      const location = warning.nodeId ? ` [${warning.nodeId}]` : "";
      lines.push(`⚠ ${warning.code}${location}: ${warning.message}`);
    }
    if (result.warnings.length > 10) {
      lines.push(`  ... and ${result.warnings.length - 10} more warnings`);
    }
  }

  // Metrics section
  lines.push("");
  lines.push("Metrics");
  lines.push("────────────────────────────────────────");

  const pathCountStr =
    result.metrics.pathCount === -1
      ? ">10,000 (path explosion!)"
      : result.metrics.pathCount.toLocaleString();
  lines.push(`Paths to END:     ${pathCountStr}`);
  lines.push(`Max depth:        ${result.metrics.maxDepth} nodes`);
  lines.push(`Branching factor: ${result.metrics.branchingFactor}`);

  if (result.metrics.bottleneckNodes.length > 0) {
    const bottleneckStr = result.metrics.bottleneckNodes.slice(0, 3).join(", ");
    const suffix = result.metrics.bottleneckNodes.length > 3
      ? ` +${result.metrics.bottleneckNodes.length - 3} more`
      : "";
    lines.push(`Bottlenecks:      ${bottleneckStr}${suffix}`);
  }

  const complexityEmoji = {
    low: "🟢",
    medium: "🟡",
    high: "🟠",
    extreme: "🔴",
  };
  lines.push(
    `Complexity:       ${complexityEmoji[result.metrics.complexity]} ${
      result.metrics.complexity.charAt(0).toUpperCase() + result.metrics.complexity.slice(1)
    } (${result.metrics.complexityScore}/100)`
  );

  // Footer
  lines.push("");
  lines.push(`Time: ${result.analysisTimeMs}ms`);

  return lines.join("\n");
}

/**
 * Format analysis result as JSON
 */
export function formatAnalysisJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}
