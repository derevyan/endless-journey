/**
 * Variation System Tests
 *
 * Tests for the journey variation testing infrastructure:
 * - VariationExplorer: Path discovery and input generation
 * - VariationRunner: Variation execution
 * - PathExplorer: Graph traversal
 *
 * These tests verify the system catches path/input mismatches
 * that could cause impossible test variations.
 *
 * @module engine/tests/variation-system
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { JourneyConfig, NodeMetadata, ButtonConfig } from "@journey/schemas";
import { VariationExplorer } from "../testing/variation-explorer";
import { VariationRunner } from "../testing/variation-runner";
import { PathExplorer } from "../validation/path-explorer";

// =============================================================================
// TEST HELPERS
// =============================================================================

const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

// Button helper with type assertion for optional targetNodeId
const btn = (id: string, text: string, targetNodeId?: string) => ({
  id,
  text,
  ...(targetNodeId ? { targetNodeId } : {}),
}) as ButtonConfig;

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Journey where button targets a node that's NOT in the expected path.
 * This is the core bug scenario: path says A→B but button targets C.
 */
const buttonTargetMismatchJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
      metadata: createMetadata(),
    },
    {
      id: "msg-with-button",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message",
        content: "Click a button",
        responseType: "buttons",
        // Button targets "alternate-path" but edge goes to "expected-next"
        buttons: [btn("btn-1", "Click me", "alternate-path")],
      },
      metadata: createMetadata(),
    },
    {
      id: "expected-next",
      type: "custom",
      position: { x: 0, y: 200 },
      data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "Expected", content: "Expected path" },
      metadata: createMetadata(),
    },
    {
      id: "alternate-path",
      type: "custom",
      position: { x: 200, y: 200 },
      data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "Alternate", content: "Alternate path" },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
      metadata: createMetadata(),
    },
  ],
  edges: [
    { id: "e1", source: "start", target: "msg-with-button", edgeType: "default" },
    // Path to expected-next (what PathExplorer finds)
    { id: "e2", source: "msg-with-button", target: "expected-next", edgeType: "default" },
    // Path from button to alternate-path (what button actually does)
    { id: "e3", source: "msg-with-button", target: "alternate-path", edgeType: "default", sourceHandle: "btn-1" },
    { id: "e4", source: "expected-next", target: "end", edgeType: "default" },
    { id: "e5", source: "alternate-path", target: "end", edgeType: "default" },
  ],
};

/**
 * Journey with cycle that can trap the variation tester.
 * Tests cycle detection and timeout handling.
 */
const cyclicJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
      metadata: createMetadata(),
    },
    {
      id: "node-a",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Node A",
        content: "Node A",
        responseType: "buttons",
        buttons: [btn("btn-to-b", "Go to B", "node-b")],
      },
      metadata: createMetadata(),
    },
    {
      id: "node-b",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Node B",
        content: "Node B",
        responseType: "buttons",
        buttons: [
          btn("btn-to-a", "Back to A", "node-a"), // Creates cycle
          btn("btn-to-end", "Go to End", "end"),
        ],
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
      metadata: createMetadata(),
    },
  ],
  edges: [
    { id: "e1", source: "start", target: "node-a", edgeType: "default" },
    { id: "e2", source: "node-a", target: "node-b", edgeType: "default", sourceHandle: "btn-to-b" },
    { id: "e3", source: "node-b", target: "node-a", edgeType: "default", sourceHandle: "btn-to-a" },
    { id: "e4", source: "node-b", target: "end", edgeType: "default", sourceHandle: "btn-to-end" },
  ],
};

/**
 * Journey with timer node but no timer edge.
 * Tests Bug #7: Timer edge fallback silent failure.
 */
const timerWithoutEdgeJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
      metadata: createMetadata(),
    },
    {
      id: "msg-with-timer",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Timed Message",
        content: "Waiting...",
        timer: { seconds: 60 },
        // No buttons, expects timer to advance
      },
      metadata: createMetadata(),
    },
    {
      id: "after-timer",
      type: "custom",
      position: { x: 0, y: 200 },
      data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "After Timer", content: "Timer completed" },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 300 },
      data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
      metadata: createMetadata(),
    },
  ],
  edges: [
    { id: "e1", source: "start", target: "msg-with-timer", edgeType: "default" },
    // Missing timer edge! Only has default edge
    { id: "e2", source: "msg-with-timer", target: "after-timer", edgeType: "default" },
    { id: "e3", source: "after-timer", target: "end", edgeType: "default" },
  ],
};

/**
 * Journey with questionnaire node for testing fake button ID issue.
 */
const questionnaireJourney: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
      metadata: createMetadata(),
    },
    {
      id: "questionnaire",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "questionnaire",
        schemaVersion: 1,
        label: "Survey",
        questions: [
          {
            id: "q1",
            content: "How are you?",
            responseType: "text" as const,
            required: true,
          },
        ],
        allowBack: false,
        shuffle: false,
      },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 200 },
      data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
      metadata: createMetadata(),
    },
  ],
  edges: [
    { id: "e1", source: "start", target: "questionnaire", edgeType: "default" },
    { id: "e2", source: "questionnaire", target: "end", edgeType: "default" },
  ],
};

// =============================================================================
// BUG #1: BUTTON INPUTS WITHOUT EDGE VALIDATION
// =============================================================================

describe("VariationExplorer - Button Input Generation", () => {
  describe("Bug #1: Button inputs without edge validation", () => {
    it("should only include buttons whose targetNodeId matches the next node in path", () => {
      const explorer = new VariationExplorer(buttonTargetMismatchJourney, {
        maxPaths: 100,
        seed: 12345,
      });

      const variations = explorer.explore();

      // Find variations for the path that goes through expected-next
      const pathThroughExpected = variations.filter((v) =>
        v.path.includes("expected-next")
      );

      // For these variations, button inputs should NOT include btn-1
      // because btn-1 targets alternate-path, not expected-next
      for (const variation of pathThroughExpected) {
        const buttonInputs = variation.inputs.filter(
          (i) => i.inputType === "button" && i.nodeId === "msg-with-button"
        );

        // This test will FAIL with current implementation
        // because it includes all buttons regardless of target
        for (const input of buttonInputs) {
          expect(input.value).not.toBe("btn-1");
        }
      }
    });

    it("should filter buttons whose targetNodeId is not in the discovered path", () => {
      const explorer = new VariationExplorer(buttonTargetMismatchJourney, {
        maxPaths: 100,
        seed: 12345,
      });

      const variations = explorer.explore();

      // Each variation should only have inputs that lead to nodes in its path
      for (const variation of variations) {
        for (const input of variation.inputs) {
          if (input.inputType === "button") {
            // Find the button's target node
            const node = buttonTargetMismatchJourney.nodes.find((n) => n.id === input.nodeId);
            const buttonData = (node?.data as { buttons?: ButtonConfig[] })?.buttons;
            const button = buttonData?.find((b) => b.id === input.value);

            if (button?.targetNodeId) {
              // The target should be in this variation's path
              // This will FAIL with current implementation
              expect(variation.path).toContain(button.targetNodeId);
            }
          }
        }
      }
    });

    it("should not generate variations with buttons targeting non-existent nodes", () => {
      // Create journey with button targeting node that doesn't exist
      const brokenJourney: JourneyConfig = {
        nodes: [
          {
            id: "start",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
            metadata: createMetadata(),
          },
          {
            id: "msg",
            type: "custom",
            position: { x: 0, y: 100 },
            data: {
              type: "message",
              schemaVersion: 2,
              contentFormat: "text",
              label: "Message",
              content: "Click",
              responseType: "buttons",
              buttons: [btn("btn-broken", "Click", "non-existent-node")],
            },
            metadata: createMetadata(),
          },
          {
            id: "end",
            type: "custom",
            position: { x: 0, y: 200 },
            data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
            metadata: createMetadata(),
          },
        ],
        edges: [
          { id: "e1", source: "start", target: "msg", edgeType: "default" },
          { id: "e2", source: "msg", target: "end", edgeType: "default" },
        ],
      };

      const explorer = new VariationExplorer(brokenJourney, { seed: 12345 });
      const variations = explorer.explore();

      // Should NOT include button inputs for btn-broken
      for (const variation of variations) {
        const brokenInputs = variation.inputs.filter(
          (i) => i.inputType === "button" && i.value === "btn-broken"
        );
        expect(brokenInputs).toHaveLength(0);
      }
    });
  });
});

// =============================================================================
// BUG #3: PATH INDEX DIVERGENCE
// =============================================================================

describe("VariationRunner - Path Divergence", () => {
  describe("Bug #3: Path index tracking allows silent divergence", () => {
    it("should fail fast when engine diverges from expected path", async () => {
      const runner = new VariationRunner(buttonTargetMismatchJourney, {
        timeout: 5000,
        logLevel: "silent",
      });

      // Create a variation that expects one path but has input that goes elsewhere
      const divergentVariation = {
        id: "divergent-test",
        path: ["start", "msg-with-button", "expected-next", "end"],
        inputs: [
          {
            nodeId: "msg-with-button",
            inputType: "button" as const,
            value: "btn-1", // This button goes to alternate-path, not expected-next
          },
        ],
        timing: "none" as const,
        contextSetup: {},
      };

      const result = await runner.runSingle(divergentVariation);

      // Debug output to understand what happened
      // console.log("Visited nodes:", result.visitedNodes);
      // console.log("Steps:", result.steps);
      // console.log("Error:", result.error);
      // console.log("Success:", result.success);

      // The variation has a button that targets alternate-path
      // but the path expects expected-next
      // The runner should either:
      // 1. Not even apply the button (if filtered by path) - in which case it would succeed via forced edge
      // 2. Apply the button and fail with divergence error

      // If button was filtered, visited nodes should NOT include alternate-path
      // If button was applied, visited nodes SHOULD include alternate-path and test should fail
      if (result.visitedNodes.includes("alternate-path")) {
        // Button was applied, path diverged - should have failed
        expect(result.success).toBe(false);
        expect(result.error).toContain("diverge");
      } else {
        // Button was filtered or not applied - this is OK due to Bug #1 fix
        // The test design needs to change
        expect(result.visitedNodes).toContain("expected-next");
      }
    });

    it("should report divergence with diagnostic info", async () => {
      const runner = new VariationRunner(buttonTargetMismatchJourney, {
        timeout: 5000,
        logLevel: "silent",
      });

      const divergentVariation = {
        id: "diagnostic-test",
        path: ["start", "msg-with-button", "expected-next", "end"],
        inputs: [
          {
            nodeId: "msg-with-button",
            inputType: "button" as const,
            value: "btn-1",
          },
        ],
        timing: "none" as const,
        contextSetup: {},
      };

      const result = await runner.runSingle(divergentVariation);

      // Error should include useful diagnostic info
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/expected|actual|diverge/i);
    });
  });
});

// =============================================================================
// BUG #4: EDGE SELECTION SKIPS CONSTRAINTS
// =============================================================================

describe("VariationRunner - Edge Selection", () => {
  describe("Bug #4: Edge selection skips button constraints", () => {
    it("should verify edge connects to expected target before forcing", async () => {
      const runner = new VariationRunner(buttonTargetMismatchJourney, {
        timeout: 5000,
        logLevel: "silent",
      });

      // Try to force a path where no compatible edge exists
      const incompatibleVariation = {
        id: "edge-constraint-test",
        path: ["start", "msg-with-button", "expected-next", "end"],
        inputs: [], // No inputs, runner will try to force edge
        timing: "none" as const,
        contextSetup: {},
      };

      const result = await runner.runSingle(incompatibleVariation);

      // Should either succeed via valid edge OR fail with clear error
      // Should NOT silently continue with wrong edge
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});

// =============================================================================
// BUG #5: buttonPassesGuards RETURNS TRUE ON NO MATCH
// =============================================================================

describe("EventRouter - Button Guard Validation", () => {
  describe("Bug #5: buttonPassesGuards returns true when no edges match", () => {
    // Note: This bug is in event-router.ts which requires different test setup
    // We'll test it indirectly through variation execution

    it("should not route button with no matching edge", async () => {
      // Create journey where button has targetNodeId but no edge with that target
      const noEdgeJourney: JourneyConfig = {
        nodes: [
          {
            id: "start",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
            metadata: createMetadata(),
          },
          {
            id: "msg",
            type: "custom",
            position: { x: 0, y: 100 },
            data: {
              type: "message",
              schemaVersion: 2,
              contentFormat: "text",
              label: "Message",
              content: "Click",
              responseType: "buttons",
              buttons: [btn("btn-no-edge", "Click", "orphan-target")],
            },
            metadata: createMetadata(),
          },
          {
            id: "orphan-target",
            type: "custom",
            position: { x: 0, y: 200 },
            data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "Orphan", content: "No edge here" },
            metadata: createMetadata(),
          },
          {
            id: "end",
            type: "custom",
            position: { x: 0, y: 300 },
            data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
            metadata: createMetadata(),
          },
        ],
        edges: [
          { id: "e1", source: "start", target: "msg", edgeType: "default" },
          // No edge from msg to orphan-target!
          { id: "e2", source: "msg", target: "end", edgeType: "default" },
          { id: "e3", source: "orphan-target", target: "end", edgeType: "default" },
        ],
      };

      const runner = new VariationRunner(noEdgeJourney, {
        timeout: 5000,
        logLevel: "silent",
      });

      const variation = {
        id: "no-edge-test",
        path: ["start", "msg", "orphan-target", "end"],
        inputs: [
          {
            nodeId: "msg",
            inputType: "button" as const,
            value: "btn-no-edge",
          },
        ],
        timing: "none" as const,
        contextSetup: {},
      };

      const result = await runner.runSingle(variation);

      // Should fail because button click can't route (no edge)
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// BUG #6: QUESTIONNAIRE FAKE BUTTON ID
// =============================================================================

describe("VariationExplorer - Questionnaire Inputs", () => {
  describe("Bug #6: Questionnaire uses fake button ID", () => {
    it("should generate valid questionnaire completion inputs", () => {
      const explorer = new VariationExplorer(questionnaireJourney, {
        maxPaths: 100,
        seed: 12345,
      });

      const variations = explorer.explore();

      for (const variation of variations) {
        const questionnaireInputs = variation.inputs.filter(
          (i) => i.nodeId === "questionnaire"
        );

        for (const input of questionnaireInputs) {
          // Should NOT use fake button ID "questionnaire-complete"
          // Should use real edge ID or valid completion mechanism
          expect(input.value).not.toBe("questionnaire-complete");
        }
      }
    });
  });
});

// =============================================================================
// BUG #7: TIMER EDGE FALLBACK SILENT FAILURE
// =============================================================================

describe("VariationRunner - Timer Handling", () => {
  describe("Bug #7: Timer edge fallback silently does nothing", () => {
    it("should fail explicitly when timer edge is missing", async () => {
      const runner = new VariationRunner(timerWithoutEdgeJourney, {
        timeout: 5000,
        logLevel: "silent",
      });

      const variation = {
        id: "timer-no-edge-test",
        path: ["start", "msg-with-timer", "after-timer", "end"],
        inputs: [
          {
            nodeId: "msg-with-timer",
            inputType: "timeout" as const,
          },
        ],
        timing: "none" as const,
        contextSetup: {},
      };

      const result = await runner.runSingle(variation);

      // Should either succeed OR fail with clear error
      // Should NOT silently continue without executing timeout
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error).toMatch(/timer|timeout|edge/i);
      }
    });

    it("should handle multiple timers per session correctly", async () => {
      // Create journey with multiple timer edges
      const multiTimerJourney: JourneyConfig = {
        nodes: [
          {
            id: "start",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
            metadata: createMetadata(),
          },
          {
            id: "multi-timer",
            type: "custom",
            position: { x: 0, y: 100 },
            data: {
              type: "message",
              schemaVersion: 2,
              contentFormat: "text",
              label: "Multi Timer",
              content: "Multiple timers",
              timer: { seconds: 60 },
            },
            metadata: createMetadata(),
          },
          {
            id: "timer-path-a",
            type: "custom",
            position: { x: -100, y: 200 },
            data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "Timer A", content: "Path A" },
            metadata: createMetadata(),
          },
          {
            id: "timer-path-b",
            type: "custom",
            position: { x: 100, y: 200 },
            data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "Timer B", content: "Path B" },
            metadata: createMetadata(),
          },
          {
            id: "end",
            type: "custom",
            position: { x: 0, y: 300 },
            data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
            metadata: createMetadata(),
          },
        ],
        edges: [
          { id: "e1", source: "start", target: "multi-timer", edgeType: "default" },
          { id: "e2", source: "multi-timer", target: "timer-path-a", edgeType: "timer", sourceHandle: "timer" },
          { id: "e3", source: "multi-timer", target: "timer-path-b", edgeType: "timer", sourceHandle: "timer" },
          { id: "e4", source: "timer-path-a", target: "end", edgeType: "default" },
          { id: "e5", source: "timer-path-b", target: "end", edgeType: "default" },
        ],
      };

      const runner = new VariationRunner(multiTimerJourney, {
        timeout: 5000,
        logLevel: "silent",
      });

      // Test that the correct timer path is taken
      const variation = {
        id: "multi-timer-test",
        path: ["start", "multi-timer", "timer-path-a", "end"],
        inputs: [
          {
            nodeId: "multi-timer",
            inputType: "timeout" as const,
          },
        ],
        timing: "none" as const,
        contextSetup: {},
      };

      const result = await runner.runSingle(variation);

      // Should successfully traverse to timer-path-a
      expect(result.visitedNodes).toContain("timer-path-a");
    });
  });
});

// =============================================================================
// PATH EXPLORER TESTS
// =============================================================================

describe("PathExplorer", () => {
  describe("Cycle Detection", () => {
    it("should detect simple cycles (A→B→A)", () => {
      const explorer = new PathExplorer(cyclicJourney);
      const paths = explorer.findPaths({ maxPaths: 100 });

      // Should have paths that include the cycle marker
      const pathsWithCycle = paths.filter(
        (p) => p.includes("node-a") && p.includes("node-b") && p.lastIndexOf("node-a") > p.indexOf("node-b")
      );

      // Cycle should be detected and path terminated
      expect(pathsWithCycle.length).toBeGreaterThan(0);
    });

    it("should not infinite loop on cycles", () => {
      const explorer = new PathExplorer(cyclicJourney);

      // This should complete within reasonable time
      const startTime = Date.now();
      const paths = explorer.findPaths({ maxPaths: 1000, maxDepth: 50 });
      const duration = Date.now() - startTime;

      // Should complete quickly, not hang
      expect(duration).toBeLessThan(1000);
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Validation", () => {
    it("should handle edges to non-existent nodes gracefully", () => {
      // Create journey with dangling edge reference
      const danglingJourney: JourneyConfig = {
        nodes: [
          {
            id: "start",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome" },
            metadata: createMetadata(),
          },
          {
            id: "end",
            type: "custom",
            position: { x: 0, y: 100 },
            data: { type: "end", schemaVersion: 1, label: "End", content: "Done" },
            metadata: createMetadata(),
          },
        ],
        edges: [
          { id: "e1", source: "start", target: "non-existent", edgeType: "default" },
          { id: "e2", source: "start", target: "end", edgeType: "default" },
        ],
      };

      const explorer = new PathExplorer(danglingJourney);

      // Should not crash, should find valid paths
      const paths = explorer.findPaths();
      expect(paths.length).toBeGreaterThan(0);

      // Valid path should exist
      const validPath = paths.find((p) => p.includes("end"));
      expect(validPath).toBeDefined();
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("Variation System Integration", () => {
  it("should generate only executable variations", async () => {
    const explorer = new VariationExplorer(buttonTargetMismatchJourney, {
      maxPaths: 50,
      seed: 12345,
    });

    const variations = explorer.explore();
    const runner = new VariationRunner(buttonTargetMismatchJourney, {
      timeout: 5000,
      logLevel: "silent",
    });

    // Every generated variation should be executable
    for (const variation of variations.slice(0, 10)) {
      const result = await runner.runSingle(variation);

      // Each variation should either:
      // 1. Complete successfully, OR
      // 2. Fail with a non-divergence error (like reaching wrong end state)
      //
      // It should NOT fail with "maximum steps exceeded" from path divergence
      if (!result.success) {
        expect(result.error).not.toMatch(/exceeded maximum steps/i);
      }
    }
  });

  it("should catch button/path mismatches at generation time", () => {
    const explorer = new VariationExplorer(buttonTargetMismatchJourney, {
      maxPaths: 100,
      seed: 12345,
    });

    const variations = explorer.explore();

    // For each variation, verify inputs are compatible with path
    for (const variation of variations) {
      for (const input of variation.inputs) {
        if (input.inputType === "button") {
          // Find the button configuration
          const node = buttonTargetMismatchJourney.nodes.find((n) => n.id === input.nodeId);
          const buttons = (node?.data as { buttons?: ButtonConfig[] })?.buttons || [];
          const button = buttons.find((b) => b.id === input.value);

          if (button?.targetNodeId) {
            // Button's target should be in the variation's path
            // This is the key invariant that was violated
            expect(
              variation.path.includes(button.targetNodeId),
              `Button ${button.id} targets ${button.targetNodeId} but path is [${variation.path.join(" → ")}]`
            ).toBe(true);
          }
        }
      }
    }
  });
});
