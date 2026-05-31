/**
 * Tests for Unified Transition Resolution
 *
 * Validates the consolidated routing logic in resolve-transition.ts
 */

import { describe, expect, it, vi } from "vitest";
import type { JourneyEdgeData, JourneyNodeData, ButtonConfig } from "@journey/schemas";
import {
  resolveButtonClick,
  resolveMessage,
  resolveTimeout,
  filterRoutableButtons,
  type TransitionOptions,
  type ActiveButtonInfo,
} from "../routing/resolve-transition";
import { buildGuardContextFromExecution } from "../utils/guard-utils";

// =============================================================================
// TEST HELPERS
// =============================================================================

const createEdge = (overrides: Partial<JourneyEdgeData> & { id: string; target: string }): JourneyEdgeData => ({
  source: "node-1",
  edgeType: "default",
  ...overrides,
});

const createNode = (overrides?: Partial<JourneyNodeData["data"]>): JourneyNodeData => ({
  id: "node-1",
  type: "custom",
  position: { x: 0, y: 0 },
  metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: "1", status: "active" as const },
  data: { type: "message", label: "Test Node", content: "Hello", ...overrides } as JourneyNodeData["data"],
});

const createOptions = (overrides?: Partial<TransitionOptions>): TransitionOptions => {
  const passableEdges = overrides?.passableEdges ?? [];
  return {
    passableEdgeIds: new Set(passableEdges.map((e) => e.id)),
    passableEdges,
    guardContext: buildGuardContextFromExecution({
      session: {
        sessionId: "test-session",
        userId: "test-user",
        context: {},
        tags: [],
      } as never,
    }),
    ...overrides,
  };
};

// =============================================================================
// BUTTON ROUTING TESTS
// =============================================================================

describe("resolveButtonClick", () => {
  it("routes to activeButton target when guard passes", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-a", managedBy: "button-btn-1" }),
      createEdge({ id: "edge-2", target: "node-b", managedBy: "button-btn-2" }),
    ];

    const activeButtons: ActiveButtonInfo[] = [
      { id: "btn-1", text: "Option A", targetNodeId: "node-a", source: "node" },
      { id: "btn-2", text: "Option B", targetNodeId: "node-b", source: "node" },
    ];

    const options = createOptions({
      passableEdges: edges,
      activeButtons,
    });

    const result = resolveButtonClick("btn-1", createNode(), edges, options);

    expect(result.targetNodeId).toBe("node-a");
    expect(result.reason).toBe("button_guard_pass");
    expect(result.matchedButtonId).toBe("btn-1");
  });

  it("falls back to static button config when not in activeButtons", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-a", managedBy: "button-btn-1" }),
    ];

    const node = createNode({
      buttons: [
        { id: "btn-1", text: "Static Button", targetNodeId: "node-a" },
      ],
    });

    const options = createOptions({
      passableEdges: edges,
      activeButtons: [], // Empty - will use static buttons
    });

    const result = resolveButtonClick("btn-1", node, edges, options);

    expect(result.targetNodeId).toBe("node-a");
    expect(result.reason).toBe("button_guard_pass");
  });

  it("uses fallback when exactly one non-timer passable edge exists", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-fallback" }),
    ];

    const options = createOptions({
      passableEdges: edges,
      activeButtons: [], // No matching button
    });

    const result = resolveButtonClick("unknown-btn", createNode(), edges, options);

    expect(result.targetNodeId).toBe("node-fallback");
    expect(result.reason).toBe("button_fallback");
    expect(result.matchedEdgeId).toBe("edge-1");
  });

  it("returns no_match when multiple edges exist and no button matches", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-a" }),
      createEdge({ id: "edge-2", target: "node-b" }),
    ];

    const options = createOptions({
      passableEdges: edges,
      activeButtons: [],
    });

    const result = resolveButtonClick("unknown-btn", createNode(), edges, options);

    expect(result.targetNodeId).toBeNull();
    expect(result.reason).toBe("no_match");
  });

  it("blocks routing when guard fails for button target", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-a", managedBy: "button-btn-1" }),
    ];

    const activeButtons: ActiveButtonInfo[] = [
      { id: "btn-1", text: "Option A", targetNodeId: "node-a", source: "node" },
    ];

    // Edge NOT in passable set = guard failed
    const options = createOptions({
      passableEdges: [],
      activeButtons,
    });

    const result = resolveButtonClick("btn-1", createNode(), edges, options);

    expect(result.targetNodeId).toBeNull();
    expect(result.reason).toBe("no_match");
  });
});

// =============================================================================
// MESSAGE ROUTING TESTS
// =============================================================================

describe("resolveMessage", () => {
  it("routes to first passable default edge for text nodes", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-next", edgeType: "default" }),
    ];

    const node = createNode({ responseType: "text" });
    const options = createOptions({ passableEdges: edges });

    const result = resolveMessage(node, edges, options);

    expect(result.targetNodeId).toBe("node-next");
    expect(result.reason).toBe("message_guard_pass");
    expect(result.matchedEdgeId).toBe("edge-1");
  });

  it("routes for any responseType", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-next", edgeType: "default" }),
    ];

    const node = createNode({ responseType: "any" });
    const options = createOptions({ passableEdges: edges });

    const result = resolveMessage(node, edges, options);

    expect(result.targetNodeId).toBe("node-next");
    expect(result.reason).toBe("message_guard_pass");
  });

  it("does not route for buttons-only nodes", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-next", edgeType: "default" }),
    ];

    const node = createNode({ responseType: "buttons" });
    const options = createOptions({ passableEdges: edges });

    const result = resolveMessage(node, edges, options);

    expect(result.targetNodeId).toBeNull();
    expect(result.reason).toBe("no_match");
  });

  it("uses fallback when exactly one non-default passable edge exists", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-fallback", edgeType: "timer" }), // Timer edge excluded
      createEdge({ id: "edge-2", target: "node-only", edgeType: "success" }), // Not a default edge
    ];

    const node = createNode({ responseType: "text" });
    // Only non-timer edge is passable (but it's not a default edge)
    const options = createOptions({ passableEdges: [edges[1]] });

    const result = resolveMessage(node, edges, options);

    expect(result.targetNodeId).toBe("node-only");
    expect(result.reason).toBe("message_fallback");
  });
});

// =============================================================================
// TIMEOUT ROUTING TESTS
// =============================================================================

describe("resolveTimeout", () => {
  it("routes via timer-to-edge mapping when available", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-timer-1", target: "node-timeout", edgeType: "timer" }),
      createEdge({ id: "edge-default", target: "node-other" }),
    ];

    const timerEdgeMap = new Map([["timer-123", "edge-timer-1"]]);

    const options = createOptions({
      passableEdges: edges,
      timerEdgeMap,
    });

    const result = resolveTimeout("timer-123", edges, options);

    expect(result.targetNodeId).toBe("node-timeout");
    expect(result.reason).toBe("timeout");
    expect(result.matchedEdgeId).toBe("edge-timer-1");
  });

  it("finds first passable timer edge when no mapping exists", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-default", target: "node-other" }),
      createEdge({ id: "edge-timer", target: "node-timeout", edgeType: "timer" }),
    ];

    const options = createOptions({
      passableEdges: edges,
    });

    const result = resolveTimeout("unknown-timer", edges, options);

    expect(result.targetNodeId).toBe("node-timeout");
    expect(result.reason).toBe("timeout");
    expect(result.matchedEdgeId).toBe("edge-timer");
  });

  it("uses timer fallback when exactly one timer edge exists", () => {
    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-timer", target: "node-timeout", edgeType: "timer" }),
    ];

    // Timer edge NOT in passable set (guard failed)
    const options = createOptions({
      passableEdges: [],
    });

    const result = resolveTimeout("timer-123", edges, options);

    expect(result.targetNodeId).toBe("node-timeout");
    expect(result.reason).toBe("timeout_fallback");
  });
});

// =============================================================================
// BUTTON FILTERING TESTS
// =============================================================================

describe("filterRoutableButtons", () => {
  it("includes buttons whose edges pass guards", () => {
    const buttons: ButtonConfig[] = [
      { id: "btn-1", text: "Option A", targetNodeId: "node-a" },
      { id: "btn-2", text: "Option B", targetNodeId: "node-b" },
    ];

    const edges: JourneyEdgeData[] = [
      createEdge({ id: "edge-1", target: "node-a", managedBy: "button-btn-1" }),
      createEdge({ id: "edge-2", target: "node-b", managedBy: "button-btn-2" }),
    ];

    // Only first button's edge passes guard
    const passableEdgeIds = new Set(["edge-1"]);

    const result = filterRoutableButtons(buttons, edges, passableEdgeIds);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("btn-1");
  });

  it("includes buttons without matching edges (defensive)", () => {
    const buttons: ButtonConfig[] = [
      { id: "btn-orphan", text: "Orphan Button", targetNodeId: "node-x" },
    ];

    const edges: JourneyEdgeData[] = [];
    const passableEdgeIds = new Set<string>();

    const result = filterRoutableButtons(buttons, edges, passableEdgeIds);

    // Button with no matching edge is included (defensive behavior)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("btn-orphan");
  });
});
