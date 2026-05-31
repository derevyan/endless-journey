/**
 * Enhanced Coverage Tracker Tests
 *
 * Tests for the enhanced coverage metrics:
 * - Handler execution coverage by node type
 * - Error path coverage
 * - Timer outcome coverage (expired/cancelled/race)
 * - Condition context diversity
 */

import { describe, expect, it, beforeEach } from "vitest";
import { CoverageTracker } from "../testing/coverage-tracker";
import type {
  JourneyConfig,
  MessageNodeData,
  ConditionNodeData,
  WaitNodeData,
  StartNodeData,
  EndNodeData,
} from "@journey/schemas";
import type { VariationResult, TestVariation } from "../testing/types";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const defaultMetadata = {
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: "1.0.0",
  status: "active" as const,
};

function createTestJourney(): JourneyConfig {
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        position: { x: 0, y: 0 },
        data: { type: "start", label: "Start", content: "" } as StartNodeData,
        metadata: defaultMetadata,
      },
      {
        id: "msg-1",
        type: "custom",
        position: { x: 0, y: 100 },
        data: {
          type: "message",
          label: "Welcome",
          content: "Hello!",
          buttons: [
            { id: "btn-yes", text: "Yes", targetNodeId: "condition-1" },
            { id: "btn-no", text: "No", targetNodeId: "end" },
          ],
        } as MessageNodeData,
        metadata: defaultMetadata,
      },
      {
        id: "condition-1",
        type: "custom",
        position: { x: 0, y: 200 },
        data: {
          type: "condition",
          label: "Check Value",
          expression: "context.value > 50",
          rulesOperator: "and",
          branches: [
            { id: "branch-high", label: "High" },
            { id: "default", label: "Default", isDefault: true },
          ],
        } as ConditionNodeData,
        metadata: defaultMetadata,
      },
      {
        id: "wait-1",
        type: "custom",
        position: { x: 0, y: 300 },
        data: {
          type: "wait",
          label: "Wait Timer",
          duration: { seconds: 5 },
        } as WaitNodeData,
        metadata: defaultMetadata,
      },
      {
        id: "msg-with-timer",
        type: "custom",
        position: { x: 100, y: 300 },
        data: {
          type: "message",
          label: "Timed Message",
          content: "Click or wait",
          buttons: [{ id: "btn-click", text: "Click", targetNodeId: "end" }],
        } as MessageNodeData,
        metadata: defaultMetadata,
      },
      {
        id: "end",
        type: "custom",
        position: { x: 0, y: 400 },
        data: { type: "end", label: "End" } as EndNodeData,
        metadata: defaultMetadata,
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "msg-1" },
      {
        id: "e2",
        source: "msg-1",
        target: "condition-1",
        sourceHandle: "btn-yes",
      },
      { id: "e3", source: "msg-1", target: "end", sourceHandle: "btn-no" },
      {
        id: "e4",
        source: "condition-1",
        target: "wait-1",
        sourceHandle: "branch-high",
      },
      { id: "e5", source: "condition-1", target: "end", sourceHandle: "default" },
      { id: "e6", source: "wait-1", target: "end" },
      { id: "e7", source: "msg-with-timer", target: "end", sourceHandle: "btn-click" },
      {
        id: "e8-timer",
        source: "msg-with-timer",
        target: "end",
        edgeType: "timer",
        data: { delay: 10 },
      },
    ],
  };
}

function createSuccessVariation(overrides: Partial<TestVariation> = {}): TestVariation {
  return {
    id: "test-variation-1",
    path: ["start", "msg-1", "end"],
    inputs: [{ nodeId: "msg-1", inputType: "button", value: "btn-no" }],
    timing: "none",
    contextSetup: {},
    ...overrides,
  };
}

function createSuccessResult(
  variation: TestVariation,
  overrides: Partial<VariationResult> = {}
): VariationResult {
  return {
    variation,
    success: true,
    visitedNodes: variation.path,
    messagesSent: [],
    steps: [
      { nodeId: "start", action: "start", timestamp: Date.now() },
      { nodeId: "msg-1", action: "click", details: "Button btn-no", timestamp: Date.now() },
      { nodeId: "end", action: "finish", timestamp: Date.now() },
    ],
    durationMs: 100,
    finalStatus: "completed",
    ...overrides,
  };
}

function createFailedResult(
  variation: TestVariation,
  error: string
): VariationResult {
  return {
    variation,
    success: false,
    error,
    visitedNodes: ["start", "msg-1"],
    messagesSent: [],
    steps: [
      { nodeId: "start", action: "start", timestamp: Date.now() },
    ],
    durationMs: 5000,
    finalStatus: "failed",
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Enhanced Coverage Tracker", () => {
  let tracker: CoverageTracker;
  let journey: JourneyConfig;

  beforeEach(() => {
    journey = createTestJourney();
    tracker = new CoverageTracker(journey);
  });

  describe("Handler Coverage", () => {
    it("should track handler executions by node type", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "condition-1", "wait-1", "end"],
      });
      const result = createSuccessResult(variation, {
        visitedNodes: variation.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      expect(metrics.handlers).toBeDefined();
      expect(metrics.handlers!.byType["start"]).toBeDefined();
      expect(metrics.handlers!.byType["message"]).toBeDefined();
      expect(metrics.handlers!.byType["condition"]).toBeDefined();
      expect(metrics.handlers!.byType["wait"]).toBeDefined();
      expect(metrics.handlers!.byType["end"]).toBeDefined();
    });

    it("should count executed nodes per type", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "end"],
      });
      const result = createSuccessResult(variation);

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      expect(metrics.handlers!.byType["start"].executed).toBe(1);
      expect(metrics.handlers!.byType["message"].executed).toBe(1);
      expect(metrics.handlers!.byType["end"].executed).toBe(1);
    });

    it("should track which variations executed each type", () => {
      const variation1 = createSuccessVariation({ id: "var-1" });
      const variation2 = createSuccessVariation({ id: "var-2" });

      tracker.processResults(
        [variation1, variation2],
        [createSuccessResult(variation1), createSuccessResult(variation2)]
      );

      const metrics = tracker.getMetrics();

      expect(metrics.handlers!.byType["message"].executionVariations).toContain("var-1");
      expect(metrics.handlers!.byType["message"].executionVariations).toContain("var-2");
    });

    it("should calculate handler coverage percentage", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "end"],
      });
      const result = createSuccessResult(variation);

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      // We visited start, message, and end types
      // Journey has: start, message, condition, wait, end
      // So 3 out of 5 types were executed
      expect(metrics.handlers!.percentage).toBeGreaterThan(0);
    });
  });

  describe("Error Path Coverage", () => {
    it("should track errors from failed variations", () => {
      const variation = createSuccessVariation();
      const result = createFailedResult(variation, "Operation timed out after 5000ms");

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      expect(metrics.errors).toBeDefined();
      expect(metrics.errors!.triggered["TIMEOUT"]).toBeDefined();
      expect(metrics.errors!.triggered["TIMEOUT"].variations).toContain("test-variation-1");
    });

    it("should extract error code from message", () => {
      const testCases = [
        { error: "Timeout exceeded", expected: "TIMEOUT" },
        { error: "Validation failed", expected: "VALIDATION_ERROR" },
        { error: "Webhook request failed", expected: "WEBHOOK_FAILED" },
        { error: "CRM update error", expected: "CRM_ERROR" },
        { error: "Max iterations reached", expected: "MAX_ITERATIONS" },
        { error: "Invalid transition", expected: "INVALID_TRANSITION" },
        { error: "Some unknown error", expected: "UNKNOWN_ERROR" },
      ];

      for (const { error, expected } of testCases) {
        const tracker = new CoverageTracker(journey);
        const variation = createSuccessVariation({ id: `var-${expected}` });
        const result = createFailedResult(variation, error);

        tracker.processResults([variation], [result]);
        const metrics = tracker.getMetrics();

        expect(metrics.errors!.triggered[expected]).toBeDefined();
      }
    });

    it("should track untriggered error paths", () => {
      // No failed variations
      const variation = createSuccessVariation();
      const result = createSuccessResult(variation);

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      // All potential errors should be in untriggered
      expect(metrics.errors!.untriggered).toContain("TIMEOUT");
      expect(metrics.errors!.untriggered).toContain("VALIDATION_ERROR");
      expect(metrics.errors!.untriggered).toContain("WEBHOOK_FAILED");
    });

    it("should calculate error coverage percentage", () => {
      const variation = createSuccessVariation();
      const result = createFailedResult(variation, "Operation timed out");

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      // 1 error type triggered out of 6 known
      expect(metrics.errors!.percentage).toBeGreaterThan(0);
      expect(metrics.errors!.percentage).toBeLessThan(100);
    });
  });

  describe("Timer Path Coverage", () => {
    it("should track timer expired outcomes", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "condition-1", "wait-1", "end"],
      });
      const result = createSuccessResult(variation, {
        visitedNodes: variation.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      expect(metrics.timers).toBeDefined();
      expect(metrics.timers!.byNode["wait-1"]).toBeDefined();
      expect(metrics.timers!.byNode["wait-1"].expiredCount).toBe(1);
    });

    it("should track timer cancelled outcomes (user clicked)", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-with-timer", "end"],
      });
      const result = createSuccessResult(variation, {
        visitedNodes: variation.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-with-timer", action: "click", details: "Button btn-click", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      expect(metrics.timers!.byNode["msg-with-timer"]).toBeDefined();
      expect(metrics.timers!.byNode["msg-with-timer"].cancelledCount).toBe(1);
    });

    it("should calculate timer coverage percentage", () => {
      // Test with both expired and cancelled
      const variation1 = createSuccessVariation({
        id: "var-expired",
        path: ["start", "msg-with-timer", "end"],
      });
      const result1 = createSuccessResult(variation1, {
        visitedNodes: variation1.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-with-timer", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      const variation2 = createSuccessVariation({
        id: "var-cancelled",
        path: ["start", "msg-with-timer", "end"],
      });
      const result2 = createSuccessResult(variation2, {
        visitedNodes: variation2.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-with-timer", action: "click", details: "Button btn-click", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation1, variation2], [result1, result2]);
      const metrics = tracker.getMetrics();

      // msg-with-timer should have both expired and cancelled
      expect(metrics.timers!.byNode["msg-with-timer"].expiredCount).toBe(1);
      expect(metrics.timers!.byNode["msg-with-timer"].cancelledCount).toBe(1);
    });

    it("should include timer duration in metrics", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "condition-1", "wait-1", "end"],
      });
      const result = createSuccessResult(variation, {
        visitedNodes: variation.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      // wait-1 has duration: 5 (seconds) = 5000ms
      expect(metrics.timers!.byNode["wait-1"].duration).toBe(5000);
    });
  });

  describe("Condition Context Coverage", () => {
    it("should track condition evaluations", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "condition-1", "wait-1", "end"],
        contextSetup: { value: 75 },
      });
      const result = createSuccessResult(variation, {
        visitedNodes: variation.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      expect(metrics.conditions).toBeDefined();
      expect(metrics.conditions!.byCondition["condition-1"]).toBeDefined();
      expect(metrics.conditions!.byCondition["condition-1"].trueCases).toBe(1);
    });

    it("should track both true and false cases", () => {
      const variation1 = createSuccessVariation({
        id: "var-true",
        path: ["start", "msg-1", "condition-1", "wait-1", "end"],
        contextSetup: { value: 75 },
      });
      const result1 = createSuccessResult(variation1, {
        visitedNodes: variation1.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      // For false case, we go through default edge to end
      const variation2 = createSuccessVariation({
        id: "var-false",
        path: ["start", "msg-1", "condition-1", "end"],
        contextSetup: { value: 25 },
      });
      const result2 = createSuccessResult(variation2, {
        visitedNodes: variation2.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation1, variation2], [result1, result2]);
      const metrics = tracker.getMetrics();

      expect(metrics.conditions!.byCondition["condition-1"].trueCases).toBe(1);
      expect(metrics.conditions!.byCondition["condition-1"].falseCases).toBe(1);
      expect(metrics.conditions!.byCondition["condition-1"].isBalanced).toBe(true);
    });

    it("should store context samples", () => {
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "condition-1", "wait-1", "end"],
        contextSetup: { value: 75, name: "test" },
      });
      const result = createSuccessResult(variation, {
        visitedNodes: variation.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      expect(metrics.conditions!.byCondition["condition-1"].trueContextSamples.length).toBe(1);
      expect(metrics.conditions!.byCondition["condition-1"].trueContextSamples[0]).toEqual({
        value: 75,
        name: "test",
      });
    });

    it("should limit context samples to 3", () => {
      const variations: TestVariation[] = [];
      const results: VariationResult[] = [];

      for (let i = 0; i < 5; i++) {
        const variation = createSuccessVariation({
          id: `var-${i}`,
          path: ["start", "msg-1", "condition-1", "wait-1", "end"],
          contextSetup: { value: 75 + i },
        });
        variations.push(variation);
        results.push(
          createSuccessResult(variation, {
            visitedNodes: variation.path,
            steps: [
              { nodeId: "start", action: "start", timestamp: Date.now() },
              { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
              { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
              { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
              { nodeId: "end", action: "finish", timestamp: Date.now() },
            ],
          })
        );
      }

      tracker.processResults(variations, results);
      const metrics = tracker.getMetrics();

      // Should only keep 3 samples
      expect(metrics.conditions!.byCondition["condition-1"].trueContextSamples.length).toBe(3);
    });

    it("should calculate condition diversity percentage", () => {
      // Only true cases for condition
      const variation = createSuccessVariation({
        path: ["start", "msg-1", "condition-1", "wait-1", "end"],
        contextSetup: { value: 75 },
      });
      const result = createSuccessResult(variation, {
        visitedNodes: variation.path,
        steps: [
          { nodeId: "start", action: "start", timestamp: Date.now() },
          { nodeId: "msg-1", action: "click", details: "Button btn-yes", timestamp: Date.now() },
          { nodeId: "condition-1", action: "auto", timestamp: Date.now() },
          { nodeId: "wait-1", action: "timeout", timestamp: Date.now() },
          { nodeId: "end", action: "finish", timestamp: Date.now() },
        ],
      });

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      // Only true cases, no false cases = not balanced
      expect(metrics.conditions!.byCondition["condition-1"].isBalanced).toBe(false);
      // 0 out of 1 condition is balanced
      expect(metrics.conditions!.percentage).toBe(0);
    });
  });

  describe("Backward Compatibility", () => {
    it("should work without enhanced metrics when disabled", () => {
      const trackerNoEnhanced = new CoverageTracker(journey, {
        collectEnhanced: false,
      });

      const variation = createSuccessVariation();
      const result = createSuccessResult(variation);

      trackerNoEnhanced.processResults([variation], [result]);
      const metrics = trackerNoEnhanced.getMetrics();

      // Basic metrics should still work
      expect(metrics.nodes).toBeDefined();
      expect(metrics.edges).toBeDefined();
      expect(metrics.paths).toBeDefined();
      expect(metrics.branches).toBeDefined();
      expect(metrics.inputs).toBeDefined();

      // Enhanced metrics should not be present
      expect(metrics.handlers).toBeUndefined();
      expect(metrics.errors).toBeUndefined();
      expect(metrics.timers).toBeUndefined();
      expect(metrics.conditions).toBeUndefined();
    });

    it("should enable enhanced metrics by default", () => {
      const variation = createSuccessVariation();
      const result = createSuccessResult(variation);

      tracker.processResults([variation], [result]);
      const metrics = tracker.getMetrics();

      // Enhanced metrics should be present
      expect(metrics.handlers).toBeDefined();
      expect(metrics.errors).toBeDefined();
      expect(metrics.timers).toBeDefined();
      expect(metrics.conditions).toBeDefined();
    });
  });

  describe("Direct Recording Methods", () => {
    it("should support direct recordHandlerExecution calls", () => {
      tracker.recordHandlerExecution("message", "msg-1", "var-1");
      tracker.recordHandlerExecution("message", "msg-2", "var-2");

      // Process empty results to trigger getMetrics
      tracker.processResults([], []);
      const metrics = tracker.getMetrics();

      expect(metrics.handlers!.byType["message"]?.executed).toBe(2);
    });

    it("should support direct recordErrorPath calls", () => {
      tracker.recordErrorPath("CUSTOM_ERROR", "node-1", "var-1", "Custom error message");

      tracker.processResults([], []);
      const metrics = tracker.getMetrics();

      expect(metrics.errors!.triggered["CUSTOM_ERROR"]).toBeDefined();
      expect(metrics.errors!.triggered["CUSTOM_ERROR"].sampleMessage).toBe("Custom error message");
    });

    it("should support direct recordTimerOutcome calls", () => {
      tracker.recordTimerOutcome("wait-1", "expired");
      tracker.recordTimerOutcome("wait-1", "cancelled");
      tracker.recordTimerOutcome("wait-1", "race");

      tracker.processResults([], []);
      const metrics = tracker.getMetrics();

      expect(metrics.timers!.byNode["wait-1"]?.expiredCount).toBe(1);
      expect(metrics.timers!.byNode["wait-1"]?.cancelledCount).toBe(1);
      expect(metrics.timers!.byNode["wait-1"]?.raceConditionCount).toBe(1);
    });

    it("should support direct recordConditionEvaluation calls", () => {
      tracker.recordConditionEvaluation(
        "condition-1",
        "value > 50",
        { value: 75 },
        true
      );
      tracker.recordConditionEvaluation(
        "condition-1",
        "value > 50",
        { value: 25 },
        false
      );

      tracker.processResults([], []);
      const metrics = tracker.getMetrics();

      expect(metrics.conditions!.byCondition["condition-1"]?.trueCases).toBe(1);
      expect(metrics.conditions!.byCondition["condition-1"]?.falseCases).toBe(1);
    });
  });
});
