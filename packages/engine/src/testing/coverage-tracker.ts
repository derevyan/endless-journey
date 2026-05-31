/**
 * Coverage Tracker
 *
 * Tracks test coverage during variation execution:
 * - Node coverage (which nodes were visited)
 * - Edge coverage (which edges were traversed)
 * - Branch coverage (which condition branches were taken)
 * - Input coverage (which buttons/text inputs were tested)
 *
 * @module engine/testing/coverage-tracker
 */

import type {
  JourneyConfig,
  MessageNodeData,
  ConditionNodeData,
  ButtonConfig,
  WaitNodeData,
} from "@journey/schemas";
import { durationToMs } from "@journey/schemas";
import { isTimerEdge } from "../utils";
import type {
  CoverageMetrics,
  NodeCoverage,
  EdgeCoverage,
  BranchCoverage,
  InputCoverage,
  VariationResult,
  TestVariation,
  HandlerCoverage,
  ErrorPathCoverage,
  TimerPathCoverage,
  ConditionContextCoverage,
} from "./types";

// =============================================================================
// COVERAGE TRACKER
// =============================================================================

export class CoverageTracker {
  private journey: JourneyConfig;

  // Tracking maps - Basic coverage
  private nodeVisits = new Map<string, number>();
  private edgeTraversals = new Map<string, number>();
  private branchTaken = new Map<string, Set<string>>();
  private buttonClicks = new Map<string, Set<string>>();
  private textInputTested = new Set<string>();
  private timeoutTested = new Set<string>();
  private pathsTested = new Set<string>();
  private totalPaths = 0;

  // Enhanced coverage tracking
  private handlerExecutions = new Map<
    string,
    { nodeIds: Set<string>; variations: Set<string> }
  >();
  private errorPaths = new Map<
    string,
    { nodeId: string; variations: string[]; message?: string }
  >();
  private timerOutcomes = new Map<
    string,
    { expired: number; cancelled: number; race: number }
  >();
  private conditionEvaluations = new Map<
    string,
    {
      expression: string;
      trueCases: number;
      falseCases: number;
      trueContexts: Array<Record<string, unknown>>;
      falseContexts: Array<Record<string, unknown>>;
    }
  >();

  /** Whether to collect enhanced metrics */
  private collectEnhanced = true;

  constructor(journey: JourneyConfig, options?: { collectEnhanced?: boolean }) {
    this.journey = journey;
    this.collectEnhanced = options?.collectEnhanced ?? true;
  }

  /**
   * Process results from variation execution and update coverage
   */
  processResults(
    variations: TestVariation[],
    results: VariationResult[]
  ): void {
    // Track total paths
    const uniquePaths = new Set(variations.map((v) => v.path.join("->")));
    this.totalPaths = uniquePaths.size;

    // Process each result
    for (const result of results) {
      if (result.success) {
        // Track path
        const pathKey = result.variation.path.join("->");
        this.pathsTested.add(pathKey);

        // Track node visits
        for (const nodeId of result.visitedNodes) {
          const current = this.nodeVisits.get(nodeId) || 0;
          this.nodeVisits.set(nodeId, current + 1);

          // Enhanced: Track handler execution by type
          if (this.collectEnhanced) {
            const node = this.journey.nodes.find((n) => n.id === nodeId);
            if (node) {
              this.recordHandlerExecution(
                node.data.type,
                nodeId,
                result.variation.id
              );
            }
          }
        }

        // Track edge traversals (consecutive node pairs)
        for (let i = 0; i < result.visitedNodes.length - 1; i++) {
          const source = result.visitedNodes[i];
          const target = result.visitedNodes[i + 1];
          const edgeId = this.findEdgeId(source, target);
          if (edgeId) {
            const current = this.edgeTraversals.get(edgeId) || 0;
            this.edgeTraversals.set(edgeId, current + 1);
          }
        }

        // Track inputs
        for (const step of result.steps) {
          if (step.action === "click" && step.details) {
            const buttonId = step.details.replace("Button ", "");
            if (!this.buttonClicks.has(step.nodeId)) {
              this.buttonClicks.set(step.nodeId, new Set());
            }
            this.buttonClicks.get(step.nodeId)!.add(buttonId);

            // Enhanced: Track timer cancelled (user clicked before timeout)
            if (this.collectEnhanced) {
              const node = this.journey.nodes.find((n) => n.id === step.nodeId);
              if (node && this.nodeHasTimer(node)) {
                this.recordTimerOutcome(step.nodeId, "cancelled");
              }
            }
          } else if (step.action === "text") {
            this.textInputTested.add(step.nodeId);
          } else if (step.action === "timeout") {
            this.timeoutTested.add(step.nodeId);

            // Enhanced: Track timer expired
            if (this.collectEnhanced) {
              this.recordTimerOutcome(step.nodeId, "expired");
            }
          }
        }

        // Track branches for condition nodes
        for (let i = 0; i < result.visitedNodes.length - 1; i++) {
          const nodeId = result.visitedNodes[i];
          const node = this.journey.nodes.find((n) => n.id === nodeId);
          if (node?.data.type === "condition") {
            const nextNodeId = result.visitedNodes[i + 1];
            const edge = this.journey.edges.find(
              (e) => e.source === nodeId && e.target === nextNodeId
            );
            if (edge?.sourceHandle) {
              if (!this.branchTaken.has(nodeId)) {
                this.branchTaken.set(nodeId, new Set());
              }
              this.branchTaken.get(nodeId)!.add(edge.sourceHandle);

              // Enhanced: Track condition context diversity
              if (this.collectEnhanced) {
                const conditionData = node.data as ConditionNodeData;
                // Get expression from direct expression or first rule's field
                const expression =
                  conditionData.expression ||
                  conditionData.rules?.[0]?.field ||
                  "";
                const isTrue = edge.sourceHandle !== "default";
                this.recordConditionEvaluation(
                  nodeId,
                  expression,
                  result.variation.contextSetup,
                  isTrue
                );
              }
            }
          }
        }
      } else {
        // Enhanced: Track error paths for failed variations
        if (this.collectEnhanced && result.error) {
          const failedNodeId =
            result.visitedNodes[result.visitedNodes.length - 1] || "unknown";
          const errorCode = this.extractErrorCode(result.error);
          this.recordErrorPath(
            errorCode,
            failedNodeId,
            result.variation.id,
            result.error
          );
        }
      }
    }
  }

  /**
   * Generate complete coverage metrics
   */
  getMetrics(): CoverageMetrics {
    const metrics: CoverageMetrics = {
      nodes: this.getNodeCoverage(),
      edges: this.getEdgeCoverage(),
      paths: this.getPathCoverage(),
      branches: this.getBranchCoverage(),
      inputs: this.getInputCoverage(),
    };

    // Add enhanced metrics if collected
    if (this.collectEnhanced) {
      metrics.handlers = this.getHandlerCoverage();
      metrics.errors = this.getErrorPathCoverage();
      metrics.timers = this.getTimerPathCoverage();
      metrics.conditions = this.getConditionContextCoverage();
    }

    return metrics;
  }

  // =============================================================================
  // ENHANCED COVERAGE RECORDING METHODS
  // =============================================================================

  /**
   * Record handler execution for a node type
   */
  recordHandlerExecution(
    nodeType: string,
    nodeId: string,
    variationId: string
  ): void {
    if (!this.handlerExecutions.has(nodeType)) {
      this.handlerExecutions.set(nodeType, {
        nodeIds: new Set(),
        variations: new Set(),
      });
    }
    const data = this.handlerExecutions.get(nodeType)!;
    data.nodeIds.add(nodeId);
    data.variations.add(variationId);
  }

  /**
   * Record an error path that was triggered
   */
  recordErrorPath(
    errorCode: string,
    nodeId: string,
    variationId: string,
    message?: string
  ): void {
    if (!this.errorPaths.has(errorCode)) {
      this.errorPaths.set(errorCode, {
        nodeId,
        variations: [],
        message,
      });
    }
    const data = this.errorPaths.get(errorCode)!;
    data.variations.push(variationId);
    if (message && !data.message) {
      data.message = message;
    }
  }

  /**
   * Record a timer outcome (expired, cancelled, or race condition)
   */
  recordTimerOutcome(
    nodeId: string,
    outcome: "expired" | "cancelled" | "race"
  ): void {
    if (!this.timerOutcomes.has(nodeId)) {
      this.timerOutcomes.set(nodeId, { expired: 0, cancelled: 0, race: 0 });
    }
    const data = this.timerOutcomes.get(nodeId)!;
    data[outcome]++;
  }

  /**
   * Record a condition evaluation with its context
   */
  recordConditionEvaluation(
    nodeId: string,
    expression: string,
    context: Record<string, unknown>,
    result: boolean
  ): void {
    if (!this.conditionEvaluations.has(nodeId)) {
      this.conditionEvaluations.set(nodeId, {
        expression,
        trueCases: 0,
        falseCases: 0,
        trueContexts: [],
        falseContexts: [],
      });
    }
    const data = this.conditionEvaluations.get(nodeId)!;
    if (result) {
      data.trueCases++;
      if (data.trueContexts.length < 3) {
        // Keep up to 3 samples
        data.trueContexts.push({ ...context });
      }
    } else {
      data.falseCases++;
      if (data.falseContexts.length < 3) {
        data.falseContexts.push({ ...context });
      }
    }
  }

  // =============================================================================
  // ENHANCED COVERAGE METRIC GENERATORS
  // =============================================================================

  /**
   * Get handler coverage metrics
   */
  private getHandlerCoverage(): HandlerCoverage {
    const byType: HandlerCoverage["byType"] = {};

    // Count total nodes by type
    const nodesByType = new Map<string, number>();
    for (const node of this.journey.nodes) {
      const count = nodesByType.get(node.data.type) || 0;
      nodesByType.set(node.data.type, count + 1);
    }

    // Build coverage data
    for (const [type, count] of nodesByType) {
      const execData = this.handlerExecutions.get(type);
      byType[type] = {
        executed: execData?.nodeIds.size || 0,
        totalNodes: count,
        executionVariations: execData
          ? Array.from(execData.variations).slice(0, 10)
          : [],
      };
    }

    // Calculate percentage (types with at least one execution)
    const totalTypes = nodesByType.size;
    const typesWithExecution = Array.from(nodesByType.keys()).filter(
      (type) => this.handlerExecutions.has(type)
    ).length;

    return {
      byType,
      percentage:
        totalTypes > 0 ? Math.round((typesWithExecution / totalTypes) * 100) : 100,
    };
  }

  /**
   * Get error path coverage metrics
   */
  private getErrorPathCoverage(): ErrorPathCoverage {
    const triggered: ErrorPathCoverage["triggered"] = {};

    for (const [code, data] of this.errorPaths) {
      triggered[code] = {
        errorCode: code,
        nodeId: data.nodeId,
        variations: data.variations.slice(0, 10), // Limit to 10 examples
        sampleMessage: data.message,
      };
    }

    // Known potential error types
    const potentialErrors = [
      "TIMEOUT",
      "VALIDATION_ERROR",
      "WEBHOOK_FAILED",
      "CRM_ERROR",
      "MAX_ITERATIONS",
      "INVALID_TRANSITION",
    ];

    const untriggered = potentialErrors.filter((code) => !this.errorPaths.has(code));
    const triggeredCount = this.errorPaths.size;
    const totalPotential = potentialErrors.length;

    return {
      triggered,
      untriggered,
      percentage:
        totalPotential > 0
          ? Math.round((triggeredCount / totalPotential) * 100)
          : 100,
    };
  }

  /**
   * Get timer path coverage metrics
   */
  private getTimerPathCoverage(): TimerPathCoverage {
    const byNode: TimerPathCoverage["byNode"] = {};

    // Find all nodes with timers
    for (const node of this.journey.nodes) {
      if (!this.nodeHasTimer(node)) continue;

      const outcomes = this.timerOutcomes.get(node.id) || {
        expired: 0,
        cancelled: 0,
        race: 0,
      };

      const duration = this.getNodeTimerDuration(node);

      byNode[node.id] = {
        nodeId: node.id,
        label: node.data.label,
        duration,
        expiredCount: outcomes.expired,
        cancelledCount: outcomes.cancelled,
        raceConditionCount: outcomes.race,
      };
    }

    // Calculate percentage (nodes with both expired AND cancelled tested)
    const timerNodes = Object.values(byNode);
    const fullyTested = timerNodes.filter(
      (n) => n.expiredCount > 0 && n.cancelledCount > 0
    ).length;

    return {
      byNode,
      percentage:
        timerNodes.length > 0
          ? Math.round((fullyTested / timerNodes.length) * 100)
          : 100,
    };
  }

  /**
   * Get condition context coverage metrics
   */
  private getConditionContextCoverage(): ConditionContextCoverage {
    const byCondition: ConditionContextCoverage["byCondition"] = {};

    for (const node of this.journey.nodes) {
      if (node.data.type !== "condition") continue;

      const conditionData = node.data as ConditionNodeData;
      const expression =
        conditionData.expression || conditionData.rules?.[0]?.field || "";
      const evalData = this.conditionEvaluations.get(node.id);

      byCondition[node.id] = {
        nodeId: node.id,
        expression,
        trueCases: evalData?.trueCases || 0,
        falseCases: evalData?.falseCases || 0,
        trueContextSamples: evalData?.trueContexts || [],
        falseContextSamples: evalData?.falseContexts || [],
        isBalanced:
          (evalData?.trueCases || 0) > 0 && (evalData?.falseCases || 0) > 0,
      };
    }

    // Calculate percentage (conditions with both true AND false tested)
    const conditions = Object.values(byCondition);
    const balanced = conditions.filter((c) => c.isBalanced).length;

    return {
      byCondition,
      percentage:
        conditions.length > 0 ? Math.round((balanced / conditions.length) * 100) : 100,
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Check if a node has a timer (wait node or message with timeout)
   */
  private nodeHasTimer(node: { id: string; data: { type: string } }): boolean {
    if (node.data.type === "wait") return true;

    if (node.data.type === "message") {
      const msgData = node.data as MessageNodeData;
      // Check for timer edges
      const hasTimerEdge = this.journey.edges.some(
        (e) => e.source === node.id && isTimerEdge(e)
      );
      return hasTimerEdge;
    }

    return false;
  }

  /**
   * Get the timer duration for a node
   */
  private getNodeTimerDuration(node: { id: string; data: { type: string } }): number {
    if (node.data.type === "wait") {
      const waitData = node.data as WaitNodeData;
      if (waitData.duration) {
        return durationToMs(waitData.duration);
      }
      return 0;
    }

    // For message nodes, find timer edge duration
    const timerEdge = this.journey.edges.find(
      (e) => e.source === node.id && isTimerEdge(e)
    );
    if (timerEdge?.data && typeof timerEdge.data === "object" && "delay" in timerEdge.data) {
      const delay = (timerEdge.data as Record<string, unknown>).delay;
      if (typeof delay === "number") {
        return delay * 1000;
      }
    }

    return 0;
  }

  /**
   * Extract error code from error message
   */
  private extractErrorCode(error: string): string {
    const lowerError = error.toLowerCase();
    if (lowerError.includes("timeout") || lowerError.includes("timed out"))
      return "TIMEOUT";
    if (lowerError.includes("validation")) return "VALIDATION_ERROR";
    if (lowerError.includes("webhook")) return "WEBHOOK_FAILED";
    if (lowerError.includes("crm")) return "CRM_ERROR";
    if (lowerError.includes("iteration") || lowerError.includes("loop"))
      return "MAX_ITERATIONS";
    if (lowerError.includes("transition")) return "INVALID_TRANSITION";
    return "UNKNOWN_ERROR";
  }

  /**
   * Get node coverage details
   */
  private getNodeCoverage(): CoverageMetrics["nodes"] {
    const details: NodeCoverage[] = [];

    for (const node of this.journey.nodes) {
      const visitCount = this.nodeVisits.get(node.id) || 0;
      details.push({
        nodeId: node.id,
        label: node.data.label || node.id,
        nodeType: node.data.type,
        visitCount,
        visited: visitCount > 0,
      });
    }

    const visited = details.filter((d) => d.visited).length;
    const total = details.length;

    return {
      total,
      visited,
      coverage: total > 0 ? Math.round((visited / total) * 100) : 100,
      details,
    };
  }

  /**
   * Get edge coverage details
   */
  private getEdgeCoverage(): CoverageMetrics["edges"] {
    const details: EdgeCoverage[] = [];

    for (const edge of this.journey.edges) {
      const traverseCount = this.edgeTraversals.get(edge.id) || 0;
      details.push({
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType: edge.edgeType || "default",
        label: edge.label,
        traverseCount,
        traversed: traverseCount > 0,
      });
    }

    const traversed = details.filter((d) => d.traversed).length;
    const total = details.length;

    return {
      total,
      traversed,
      coverage: total > 0 ? Math.round((traversed / total) * 100) : 100,
      details,
    };
  }

  /**
   * Get path coverage
   */
  private getPathCoverage(): CoverageMetrics["paths"] {
    return {
      total: this.totalPaths,
      tested: this.pathsTested.size,
      coverage:
        this.totalPaths > 0
          ? Math.round((this.pathsTested.size / this.totalPaths) * 100)
          : 100,
    };
  }

  /**
   * Get branch coverage for condition nodes
   */
  private getBranchCoverage(): CoverageMetrics["branches"] {
    const details: BranchCoverage[] = [];

    for (const node of this.journey.nodes) {
      if (node.data.type !== "condition") continue;

      const conditionData = node.data as ConditionNodeData;
      const branches = conditionData.branches || [];
      const takenBranches = this.branchTaken.get(node.id) || new Set();

      for (const branch of branches) {
        details.push({
          nodeId: node.id,
          branchId: branch.id,
          label: branch.label,
          takenCount: takenBranches.has(branch.id) ? 1 : 0,
          taken: takenBranches.has(branch.id),
        });
      }
    }

    const taken = details.filter((d) => d.taken).length;
    const total = details.length;

    return {
      total,
      taken,
      coverage: total > 0 ? Math.round((taken / total) * 100) : 100,
      details,
    };
  }

  /**
   * Get input coverage for interactive nodes
   */
  private getInputCoverage(): CoverageMetrics["inputs"] {
    const details: InputCoverage[] = [];

    for (const node of this.journey.nodes) {
      if (node.data.type !== "message") continue;

      const msgData = node.data as MessageNodeData;
      const buttons = (msgData.buttons as ButtonConfig[]) || [];
      const responseType = msgData.responseType || (buttons.length ? "buttons" : "auto");

      if (responseType === "auto") continue; // Skip non-interactive

      const clickedButtons = this.buttonClicks.get(node.id) || new Set();
      const textTested = this.textInputTested.has(node.id);
      const timeoutTested = this.timeoutTested.has(node.id);

      details.push({
        nodeId: node.id,
        label: msgData.label || node.id,
        totalButtons: buttons.length,
        clickedButtons,
        textTested,
        timeoutTested,
      });
    }

    // Calculate "fully covered" - all buttons clicked, text tested if applicable
    let fullyCovered = 0;
    for (const detail of details) {
      const allButtonsClicked = detail.clickedButtons.size >= detail.totalButtons;
      const node = this.journey.nodes.find((n) => n.id === detail.nodeId);
      const msgData = node?.data as MessageNodeData | undefined;
      const responseType = msgData?.responseType || "buttons";

      const needsTextTest = responseType === "text" || responseType === "any";
      const textOk = !needsTextTest || detail.textTested;

      if (allButtonsClicked && textOk) {
        fullyCovered++;
      }
    }

    return {
      totalNodes: details.length,
      fullyCovered,
      coverage:
        details.length > 0
          ? Math.round((fullyCovered / details.length) * 100)
          : 100,
      details,
    };
  }

  /**
   * Find edge ID between two nodes
   */
  private findEdgeId(source: string, target: string): string | undefined {
    const edge = this.journey.edges.find(
      (e) => e.source === source && e.target === target
    );
    return edge?.id;
  }
}
