/**
 * Performance Builder
 *
 * Builds performance analysis from transitions and workflow executions.
 * Identifies bottlenecks, slow nodes, and performance patterns.
 *
 * @module @journey/ai-report/builders/performance-builder
 */

import { z } from "zod";
import type { TransitionDetail, WorkflowExecutionDetail, PerformanceAnalysis, SlowNode } from "../schemas";
import { DETECTION_THRESHOLDS } from "../constants";

/**
 * Bottleneck detail with impact assessment.
 */
export const BottleneckDetailSchema = z.object({
  nodeId: z.string(),
  nodeLabel: z.string().optional(),
  reason: z.string(),
  impact: z.enum(["high", "medium", "low"]),
  avgDurationMs: z.number(),
  occurrenceCount: z.number(),
  suggestion: z.string().optional(),
});

export type BottleneckDetail = z.infer<typeof BottleneckDetailSchema>;

/**
 * Extended performance analysis with detailed bottleneck info.
 */
export interface ExtendedPerformanceAnalysis extends PerformanceAnalysis {
  totalDurationMs: number;
  avgNodeDurationMs: number;
  bottleneckDetails: BottleneckDetail[];
}

/**
 * Build performance analysis from transitions and workflow executions.
 *
 * @param transitions - All transition details
 * @param workflowExecutions - Workflow execution details
 * @returns Performance analysis with bottleneck identification
 */
export function buildPerformanceAnalysis(
  transitions: TransitionDetail[],
  workflowExecutions: WorkflowExecutionDetail[]
): ExtendedPerformanceAnalysis {
  // Calculate total duration from transitions
  const totalDurationMs = transitions.reduce(
    (sum, t) => sum + (t.durationAtPreviousNodeMs || 0),
    0
  );

  // Calculate per-node metrics
  const nodeMetrics = new Map<
    string,
    {
      nodeId: string;
      nodeLabel?: string;
      totalDurationMs: number;
      executionCount: number;
      maxDurationMs: number;
    }
  >();

  for (const transition of transitions) {
    const { fromNodeId, fromNodeLabel, durationAtPreviousNodeMs } = transition;
    if (!durationAtPreviousNodeMs || !fromNodeId) continue;

    const existing = nodeMetrics.get(fromNodeId);
    if (existing) {
      existing.totalDurationMs += durationAtPreviousNodeMs;
      existing.executionCount += 1;
      existing.maxDurationMs = Math.max(existing.maxDurationMs, durationAtPreviousNodeMs);
    } else {
      nodeMetrics.set(fromNodeId, {
        nodeId: fromNodeId,
        nodeLabel: fromNodeLabel,
        totalDurationMs: durationAtPreviousNodeMs,
        executionCount: 1,
        maxDurationMs: durationAtPreviousNodeMs,
      });
    }
  }

  // Add workflow execution durations
  for (const workflow of workflowExecutions) {
    const workflowDuration = workflow.totalDurationMs ?? 0;
    if (workflowDuration === 0) continue;

    const existing = nodeMetrics.get(workflow.nodeId);
    if (existing) {
      existing.totalDurationMs += workflowDuration;
      existing.executionCount += 1;
      existing.maxDurationMs = Math.max(existing.maxDurationMs, workflowDuration);
    } else {
      nodeMetrics.set(workflow.nodeId, {
        nodeId: workflow.nodeId,
        nodeLabel: undefined,
        totalDurationMs: workflowDuration,
        executionCount: 1,
        maxDurationMs: workflowDuration,
      });
    }
  }

  // Calculate average node duration
  const nodeCount = nodeMetrics.size;
  const avgNodeDurationMs = nodeCount > 0 ? totalDurationMs / nodeCount : 0;

  // Identify slow nodes (above threshold)
  const slowNodes: SlowNode[] = [];
  const bottleneckDetails: BottleneckDetail[] = [];

  for (const metrics of nodeMetrics.values()) {
    const avgDurationMs = metrics.totalDurationMs / metrics.executionCount;

    if (avgDurationMs > DETECTION_THRESHOLDS.SLOW_NODE_DURATION_MS) {
      slowNodes.push({
        nodeId: metrics.nodeId,
        nodeLabel: metrics.nodeLabel,
        avgDurationMs,
        executionCount: metrics.executionCount,
      });

      // Determine impact level
      const impact = determineImpact(avgDurationMs, metrics.totalDurationMs, totalDurationMs);

      bottleneckDetails.push({
        nodeId: metrics.nodeId,
        nodeLabel: metrics.nodeLabel,
        reason: `Node took ${formatDuration(avgDurationMs)} on average (${metrics.executionCount} executions)`,
        impact,
        avgDurationMs,
        occurrenceCount: metrics.executionCount,
        suggestion: generateSuggestion(avgDurationMs, metrics.executionCount, impact),
      });
    }
  }

  // Sort by average duration (slowest first)
  slowNodes.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
  bottleneckDetails.sort((a, b) => b.avgDurationMs - a.avgDurationMs);

  // Generate bottleneck descriptions for the simpler bottlenecks array
  const bottlenecks = bottleneckDetails.map(
    (b) =>
      `[${b.impact.toUpperCase()}] ${b.nodeLabel || b.nodeId}: ${b.reason}${b.suggestion ? ` - ${b.suggestion}` : ""}`
  );

  return {
    totalDurationMs,
    avgNodeDurationMs,
    slowestNodes: slowNodes.slice(0, 10), // Top 10 slowest
    bottlenecks,
    bottleneckDetails,
  };
}

/**
 * Determine impact level based on duration metrics.
 */
function determineImpact(
  avgDurationMs: number,
  totalNodeDurationMs: number,
  totalSessionDurationMs: number
): "high" | "medium" | "low" {
  const percentOfTotal = totalSessionDurationMs > 0 ? (totalNodeDurationMs / totalSessionDurationMs) * 100 : 0;

  // High impact: >60s average OR >30% of total session time
  if (avgDurationMs > 60000 || percentOfTotal > 30) {
    return "high";
  }

  // Medium impact: >30s average OR >15% of total session time
  if (avgDurationMs > 30000 || percentOfTotal > 15) {
    return "medium";
  }

  return "low";
}

/**
 * Generate improvement suggestion based on bottleneck characteristics.
 */
function generateSuggestion(
  avgDurationMs: number,
  occurrenceCount: number,
  impact: "high" | "medium" | "low"
): string {
  if (avgDurationMs > 60000) {
    return "Consider breaking this node into smaller steps or adding progress indicators";
  }

  if (occurrenceCount > 3) {
    return "This node is visited frequently with high latency - consider caching or optimization";
  }

  if (impact === "high") {
    return "This is a major bottleneck - prioritize optimization";
  }

  return "Review for potential optimization opportunities";
}

/**
 * Format duration in human-readable form.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
