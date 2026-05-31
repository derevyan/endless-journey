/**
 * Blade Runner - Smart Level Recommender
 *
 * Analyzes journey complexity and recommends the optimal test level.
 * Uses the existing journey-analyzer complexity scoring system.
 *
 * @module engine/testing/blade-runner/recommender
 */

import type { JourneyConfig } from "@journey/schemas";
import { TEST_LEVELS, QUICK_LEVEL, STANDARD_LEVEL, THOROUGH_LEVEL, FULL_LEVEL } from "./levels";
import type { TestLevel } from "./types";
import { hasTimer, isInteractiveNode } from "../journey-node-utils";

/**
 * Complexity levels for journeys
 */
export type ComplexityLevel = "low" | "medium" | "high" | "extreme";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Journey statistics for recommendation
 */
export interface JourneyStats {
  pathCount: number;
  interactiveNodes: number;
  timerNodes: number;
  conditionNodes: number;
  nodeCount: number;
  edgeCount: number;
  complexity: ComplexityLevel;
  complexityScore: number;
}

/**
 * Level recommendation with reasoning
 */
export interface LevelRecommendation {
  /** The recommended test level */
  level: TestLevel;
  /** Human-readable reasoning for the recommendation */
  reasoning: string[];
  /** Journey statistics used for the recommendation */
  stats: JourneyStats;
}

// =============================================================================
// RECOMMENDER
// =============================================================================

/**
 * Fast O(n) complexity estimation without expensive path enumeration.
 *
 * Estimates complexity based on graph structure:
 * - Node count and edge density (branching factor)
 * - Interactive elements (buttons, forms)
 * - Timers and conditions (create variations)
 *
 * This is much faster than actual path enumeration for large graphs.
 */
function estimateComplexity(journey: JourneyConfig): {
  complexity: ComplexityLevel;
  complexityScore: number;
  estimatedPaths: number;
} {
  const nodes = journey.nodes || [];
  const edges = journey.edges || [];

  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  // Calculate branching factor (avg outgoing edges per non-end node)
  const nonEndNodes = nodes.filter((n) => n.data.type !== "end").length;
  const branchingFactor = nonEndNodes > 0 ? edgeCount / nonEndNodes : 1;

  // Count special node types
  let conditionCount = 0;
  let timerCount = 0;
  let interactiveCount = 0;

  for (const node of nodes) {
    if (node.data.type === "condition") conditionCount++;
    if (hasTimer(node)) timerCount++;
    if (isInteractiveNode(node)) interactiveCount++;
  }

  // Estimate max depth (conservative: half of nodes for non-linear graphs)
  const estimatedDepth = Math.min(nodeCount, 30);

  // Estimate paths conservatively using branching factor
  // paths ≈ branchingFactor ^ (depth / 2) for realistic estimation
  const estimatedPaths = Math.min(
    Math.round(Math.pow(branchingFactor, estimatedDepth / 3)),
    100000
  );

  // Calculate complexity score (0-100)
  let score = 0;

  // Node count component (0-20 points)
  score += Math.min(nodeCount * 0.5, 20);

  // Branching factor component (0-25 points)
  score += Math.min(branchingFactor * 10, 25);

  // Condition count (0-20 points) - conditions create branches
  score += Math.min(conditionCount * 5, 20);

  // Timer count (0-15 points) - timers add variations
  score += Math.min(timerCount * 5, 15);

  // Interactive count (0-20 points) - interactive nodes add input variations
  score += Math.min(interactiveCount * 3, 20);

  // Clamp to 0-100
  score = Math.round(Math.min(Math.max(score, 0), 100));

  // Determine complexity level
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

  return { complexity, complexityScore: score, estimatedPaths };
}

/**
 * Recommend the optimal test level for a journey.
 *
 * Uses fast O(n) complexity estimation (not path enumeration) to map to test levels:
 * - Score 0-25 (low) → Quick
 * - Score 26-50 (medium) → Standard
 * - Score 51-75 (high) → Thorough
 * - Score 76-100 (extreme) → Full
 *
 * @param journey - Journey configuration to analyze
 * @returns Recommendation with level, reasoning, and stats
 */
export function recommendTestLevel(journey: JourneyConfig): LevelRecommendation {
  // Fast complexity estimation (O(n), no path enumeration)
  const { complexity, complexityScore, estimatedPaths } = estimateComplexity(journey);

  // Count node types
  const nodes = journey.nodes || [];
  const edges = journey.edges || [];

  let interactiveNodes = 0;
  let timerNodes = 0;
  let conditionNodes = 0;

  for (const node of nodes) {
    if (isInteractiveNode(node)) {
      interactiveNodes++;
    }
    if (hasTimer(node)) {
      timerNodes++;
    }
    if (node.data.type === "condition") {
      conditionNodes++;
    }
  }

  const stats: JourneyStats = {
    pathCount: estimatedPaths, // Estimated, not actual enumeration
    interactiveNodes,
    timerNodes,
    conditionNodes,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    complexity,
    complexityScore,
  };

  // Map complexity to level
  let level: TestLevel;
  const reasoning: string[] = [];

  if (complexityScore <= 25) {
    level = QUICK_LEVEL;
    reasoning.push(`Simple journey (${complexityScore}/100 complexity)`);
    if (nodes.length <= 10) {
      reasoning.push(`Small journey with ${nodes.length} nodes`);
    }
  } else if (complexityScore <= 50) {
    level = STANDARD_LEVEL;
    reasoning.push(`Moderate complexity (${complexityScore}/100)`);
    if (conditionNodes > 0) {
      reasoning.push(`${conditionNodes} condition${conditionNodes > 1 ? "s" : ""} add branching`);
    }
  } else if (complexityScore <= 75) {
    level = THOROUGH_LEVEL;
    reasoning.push(`High complexity (${complexityScore}/100)`);
    if (interactiveNodes > 3) {
      reasoning.push(`${interactiveNodes} interactive nodes need input variations`);
    }
    if (conditionNodes > 2) {
      reasoning.push(`${conditionNodes} conditions create branching paths`);
    }
  } else {
    level = FULL_LEVEL;
    reasoning.push(`Extreme complexity (${complexityScore}/100)`);
    reasoning.push("Full cartesian testing recommended");
    if (timerNodes >= 2) {
      reasoning.push(`${timerNodes} timers warrant race condition tests`);
    }
  }

  // Add timer-specific recommendations
  if (timerNodes >= 2 && level.key !== "full") {
    reasoning.push(`Note: ${timerNodes} timer nodes - consider --full for race tests`);
  }

  return {
    level,
    reasoning,
    stats,
  };
}

/**
 * Get the index of the recommended level (1-based for display)
 */
export function getRecommendedLevelIndex(recommendation: LevelRecommendation): number {
  const index = TEST_LEVELS.findIndex((l) => l.key === recommendation.level.key);
  return index === -1 ? 2 : index + 1; // Default to Standard (index 2) if not found
}

/**
 * Format the recommendation for display in the menu
 */
export function formatRecommendation(recommendation: LevelRecommendation): string {
  const { level, reasoning, stats } = recommendation;
  const lines: string[] = [];

  lines.push(`${level.icon} ${level.name} (recommended)`);
  lines.push("");

  // Stats summary
  lines.push(`  Journey: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
  lines.push(
    `  ${stats.interactiveNodes} interactive, ${stats.timerNodes} timers, ${stats.conditionNodes} conditions`
  );
  lines.push(`  Complexity: ${stats.complexity} (${stats.complexityScore}/100)`);
  lines.push("");

  // Reasoning
  for (const reason of reasoning) {
    lines.push(`  → ${reason}`);
  }

  return lines.join("\n");
}
