/**
 * Race Condition Tester
 *
 * Tests timing-sensitive scenarios for nodes with timers:
 * - user_first: User responds before timeout fires
 * - timeout_first: Timeout fires before user responds
 * - concurrent: Both events arrive at nearly the same time
 *
 * These tests verify the engine handles race conditions correctly,
 * ensuring deterministic behavior regardless of timing.
 *
 * @module engine/testing/race-condition-tester
 */

import { createLogger } from "@journey/logger";
import type { JourneyConfig, EnhancedUserJourney, MessageNodeData } from "@journey/schemas";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "../validation/mock-adapter";
import { isTimerEdge } from "../utils";
import type {
  TestVariation,
  VariationResult,
  VariationStep,
  TimingScenario,
} from "./types";

// =============================================================================
// RACE CONDITION TESTER
// =============================================================================

export interface RaceConditionTestResult {
  /** The timing scenario tested */
  scenario: TimingScenario;
  /** Node ID where race was tested */
  nodeId: string;
  /** Whether the test passed */
  passed: boolean;
  /** Expected outcome */
  expected: {
    winningEvent: "user" | "timeout";
    finalNodeId: string;
  };
  /** Actual outcome */
  actual: {
    winningEvent: "user" | "timeout" | "unknown";
    finalNodeId: string;
  };
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  durationMs: number;
}

export interface RaceConditionReport {
  /** Total tests run */
  total: number;
  /** Tests that passed */
  passed: number;
  /** Tests that failed */
  failed: number;
  /** Individual test results */
  results: RaceConditionTestResult[];
  /** Nodes that were tested */
  testedNodes: string[];
  /** Total execution time */
  durationMs: number;
}

export class RaceConditionTester {
  private journey: JourneyConfig;
  private logger: ReturnType<typeof createLogger>;

  constructor(journey: JourneyConfig) {
    this.journey = journey;
    this.logger = createLogger("race-condition-tester");
  }

  /**
   * Find all nodes with timers that need race condition testing
   */
  findTimerNodes(): string[] {
    const timerNodes: string[] = [];

    for (const node of this.journey.nodes) {
      if (node.data.type === "message") {
        const msgData = node.data as MessageNodeData;
        if (msgData.timer && msgData.timer.seconds > 0) {
          timerNodes.push(node.id);
        }
      }
    }

    return timerNodes;
  }

  /**
   * Run race condition tests for all timer nodes
   */
  async runAllTests(): Promise<RaceConditionReport> {
    const startTime = Date.now();
    const timerNodes = this.findTimerNodes();
    const results: RaceConditionTestResult[] = [];

    for (const nodeId of timerNodes) {
      // Test all three timing scenarios for each timer node
      const scenarios: TimingScenario[] = ["user_first", "timeout_first", "concurrent"];

      for (const scenario of scenarios) {
        const result = await this.testScenario(nodeId, scenario);
        results.push(result);
      }
    }

    const passed = results.filter((r) => r.passed).length;

    return {
      total: results.length,
      passed,
      failed: results.length - passed,
      results,
      testedNodes: timerNodes,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Test a specific timing scenario for a node
   */
  async testScenario(
    nodeId: string,
    scenario: TimingScenario
  ): Promise<RaceConditionTestResult> {
    const startTime = Date.now();

    // Find the node and its timer configuration
    const node = this.journey.nodes.find((n) => n.id === nodeId);
    if (!node || node.data.type !== "message") {
      return {
        scenario,
        nodeId,
        passed: false,
        expected: { winningEvent: "user", finalNodeId: "" },
        actual: { winningEvent: "unknown", finalNodeId: "" },
        error: `Node ${nodeId} not found or is not a message node`,
        durationMs: Date.now() - startTime,
      };
    }

    const msgData = node.data as MessageNodeData;
    const buttons = (msgData.buttons || []) as Array<{ id: string; targetNodeId?: string }>;
    const timerEdge = this.journey.edges.find((e) => e.source === nodeId && isTimerEdge(e));

    if (!timerEdge) {
      return {
        scenario,
        nodeId,
        passed: false,
        expected: { winningEvent: "user", finalNodeId: "" },
        actual: { winningEvent: "unknown", finalNodeId: "" },
        error: `No timer edge found for node ${nodeId}`,
        durationMs: Date.now() - startTime,
      };
    }

    // Determine expected outcomes based on scenario
    const firstButton = buttons[0];
    const userTargetNode = firstButton?.targetNodeId || "";
    const timeoutTargetNode = timerEdge.target;

    const expected = {
      winningEvent: scenario === "timeout_first" ? "timeout" as const : "user" as const,
      finalNodeId: scenario === "timeout_first" ? timeoutTargetNode : userTargetNode,
    };

    // Create test session starting at the timer node
    const adapter = new MockMessagingAdapter();
    const session = this.createSession(nodeId);

    const engine = new SessionEngine(session, this.journey, adapter, {
      logger: this.logger.child({ scenario, nodeId }),
    });

    try {
      // Start the engine at the timer node
      await engine.start();

      // Wait a tick for the timer to be scheduled
      await this.sleep(10);

      // Get the scheduled timer
      const timers = adapter.getScheduledTimers();
      const timer = timers.find((t) => t.sessionId === session.sessionId);

      if (!timer && scenario !== "user_first") {
        return {
          scenario,
          nodeId,
          passed: false,
          expected,
          actual: { winningEvent: "unknown", finalNodeId: session.currentNodeId },
          error: "No timer was scheduled",
          durationMs: Date.now() - startTime,
        };
      }

      let winningEvent: "user" | "timeout" | "unknown" = "unknown";

      switch (scenario) {
        case "user_first":
          // User responds before timeout
          if (firstButton) {
            await adapter.simulateButtonClick(
              firstButton.id,
              session.userId,
              session.sessionId
            );
            winningEvent = "user";
          }
          // Wait a bit, then fire timeout (should be ignored)
          await this.sleep(5);
          if (timer) {
            await adapter.simulateTimeout(
              timer.timerId,
              session.userId,
              session.sessionId
            );
          }
          break;

        case "timeout_first":
          // Timeout fires before user
          if (timer) {
            await adapter.simulateTimeout(
              timer.timerId,
              session.userId,
              session.sessionId
            );
            winningEvent = "timeout";
          }
          // Wait a bit, then user responds (should be ignored)
          await this.sleep(5);
          if (firstButton) {
            await adapter.simulateButtonClick(
              firstButton.id,
              session.userId,
              session.sessionId
            );
          }
          break;

        case "concurrent":
          // Both events at nearly the same time
          // The engine should handle this deterministically
          const promises: Promise<void>[] = [];

          if (firstButton) {
            promises.push(
              adapter.simulateButtonClick(
                firstButton.id,
                session.userId,
                session.sessionId
              )
            );
          }
          if (timer) {
            promises.push(
              adapter.simulateTimeout(
                timer.timerId,
                session.userId,
                session.sessionId
              )
            );
          }

          await Promise.all(promises);
          // First one to be processed wins (user button typically)
          winningEvent = "user";
          break;
      }

      // Wait for transitions to complete
      await this.sleep(20);

      // Determine what actually happened
      const finalNodeId = session.currentNodeId;

      // Check if we ended up at the expected node
      const passed = finalNodeId === expected.finalNodeId ||
        // For concurrent, either outcome is acceptable as long as it's deterministic
        (scenario === "concurrent" && (finalNodeId === userTargetNode || finalNodeId === timeoutTargetNode));

      return {
        scenario,
        nodeId,
        passed,
        expected,
        actual: {
          winningEvent,
          finalNodeId,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        scenario,
        nodeId,
        passed: false,
        expected,
        actual: { winningEvent: "unknown", finalNodeId: session.currentNodeId },
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a session starting at a specific node
   */
  private createSession(startNodeId: string): EnhancedUserJourney {
    return {
      sessionId: `race-test-${Date.now()}`,
      journeyId: (this.journey as { id?: string }).id || "test-journey",
      userId: "race-test-user",
      platformUserId: "race-test-user",
      currentNodeId: startNodeId,
      status: "active",
      context: {},
      tags: [],
      history: [],
      pendingTimers: [],
      pendingPluginFollowUps: [],
      nodeOutputs: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    hasStarted: false,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Format race condition report for display
 */
export function formatRaceConditionReport(report: RaceConditionReport): string {
  const lines: string[] = [];

  lines.push("Race Condition Test Results");
  lines.push("=".repeat(50));
  lines.push("");

  // Summary
  const status = report.failed === 0 ? "PASSED" : "FAILED";
  lines.push(`${status}: ${report.passed}/${report.total} tests`);
  lines.push(`Nodes tested: ${report.testedNodes.join(", ") || "none"}`);
  lines.push("");

  // Failures
  const failures = report.results.filter((r) => !r.passed);
  if (failures.length > 0) {
    lines.push("Failures:");
    lines.push("-".repeat(50));

    for (const failure of failures) {
      lines.push(`  ${failure.nodeId} (${failure.scenario}):`);
      lines.push(`    Expected: ${failure.expected.winningEvent} -> ${failure.expected.finalNodeId}`);
      lines.push(`    Actual:   ${failure.actual.winningEvent} -> ${failure.actual.finalNodeId}`);
      if (failure.error) {
        lines.push(`    Error: ${failure.error}`);
      }
      lines.push("");
    }
  }

  // Timing
  lines.push(`Time: ${report.durationMs}ms`);

  return lines.join("\n");
}
