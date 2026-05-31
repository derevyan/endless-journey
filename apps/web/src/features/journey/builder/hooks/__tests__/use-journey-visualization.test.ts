import { CANVAS_COLORS } from "@/features/journey/builder/config/canvas-config";
import type { JourneyEdge, JourneyNode, UserJourney } from "@/features/nodes/journey/react-flow-types";
import type { ScenarioPath } from "@journey/schemas";
import { describe, expect, it } from "vitest";

/**
 * Helper functions extracted from useJourney.ts for testing
 * These represent the pure logic that calculates visualization state
 */

function calculateJourneyVisualization(
  baseNodes: JourneyNode[],
  baseEdges: JourneyEdge[],
  journey: UserJourney
): { nodes: JourneyNode[]; edges: JourneyEdge[] } {
  // Calculate journey step order based on enteredAt timestamps
  const visitedNodes = Object.entries(journey.nodeStates)
    .filter(([, state]) => state.visited && state.enteredAt)
    .sort((a, b) => new Date(a[1].enteredAt!).getTime() - new Date(b[1].enteredAt!).getTime());

  const stepMap = new Map<string, number>();
  visitedNodes.forEach(([nodeId], idx) => stepMap.set(nodeId, idx + 1));

  // Find edges that connect consecutive visited nodes in the journey path
  const journeyEdgeSet = new Set<string>();
  for (let i = 0; i < visitedNodes.length - 1; i++) {
    const fromNodeId = visitedNodes[i][0];
    const toNodeId = visitedNodes[i + 1][0];
    const edge = baseEdges.find((e) => e.source === fromNodeId && e.target === toNodeId);
    if (edge) {
      journeyEdgeSet.add(edge.id);
    }
  }

  const journeyNodes = baseNodes.map((node) => {
    const state = journey.nodeStates[node.id];
    if (!state) return node;

    return {
      ...node,
      data: {
        ...node.data,
        journeyVisited: state.visited,
        journeyCurrent: state.isCurrent,
        journeyDroppedOff: state.droppedOff,
        journeyStep: stepMap.get(node.id),
      },
    };
  });

  const journeyEdges = baseEdges.map((edge) => {
    const isInPath = journeyEdgeSet.has(edge.id);
    if (!isInPath) return edge;

    return {
      ...edge,
      style: {
        ...(edge.style || {}),
        stroke: CANVAS_COLORS.journeyHighlight,
        strokeWidth: CANVAS_COLORS.journeyHighlightWidth,
        strokeDasharray: undefined,
      },
      animated: true,
    };
  });

  return { nodes: journeyNodes, edges: journeyEdges };
}

function calculateScenarioVisualization(
  baseNodes: JourneyNode[],
  baseEdges: JourneyEdge[],
  scenario: ScenarioPath
): { nodes: JourneyNode[]; edges: JourneyEdge[] } {
  const nodeSet = new Set(scenario.nodeSequence);
  const stepMap = new Map<string, number>();
  scenario.nodeSequence.forEach((id, idx) => stepMap.set(id, idx + 1));
  const edgeSet = new Set(scenario.edgeSequence);

  const highlightedNodes = baseNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      scenarioActive: nodeSet.has(node.id),
      scenarioStep: stepMap.get(node.id),
    },
  }));

  const highlightedEdges = baseEdges.map((edge) => {
    const active = edgeSet.has(edge.id);
    const style = active
      ? {
          ...(edge.style || {}),
          stroke: CANVAS_COLORS.scenarioHighlight,
          strokeWidth: CANVAS_COLORS.scenarioHighlightWidth,
          strokeDasharray: undefined,
        }
      : edge.style;
    return {
      ...edge,
      style,
      animated: active || edge.animated,
    };
  });

  return { nodes: highlightedNodes, edges: highlightedEdges };
}

// Test fixtures
const createBaseNodes = (): JourneyNode[] => [
  {
    id: "msg-1",
    type: "custom",
    position: { x: 0, y: 0 },
    data: { type: "start", label: "Start", content: "Welcome" },
  },
  {
    id: "v1-button",
    type: "custom",
    position: { x: 0, y: 100 },
    data: { type: "message", label: "Video Button", content: "Watch video" },
  },
  {
    id: "v1",
    type: "custom",
    position: { x: 0, y: 200 },
    data: { type: "message", label: "Video 1", content: "Video content" },
  },
  {
    id: "q1",
    type: "custom",
    position: { x: 0, y: 300 },
    data: { type: "condition", label: "Question 1", content: "Are you ready?", buttons: ["Yes", "No"] },
  },
  {
    id: "end",
    type: "custom",
    position: { x: 0, y: 400 },
    data: { type: "end", label: "End", content: "Thank you" },
  },
];

const createBaseEdges = (): JourneyEdge[] => [
  { id: "e1", source: "msg-1", target: "v1-button" },
  { id: "e2", source: "v1-button", target: "v1" },
  { id: "e3", source: "v1", target: "q1" },
  { id: "e4", source: "q1", target: "end" },
];

const createUserJourney = (): UserJourney => ({
  userId: "user-001",
  journeyId: "test-journey",
  startedAt: "2025-01-20T09:00:00Z",
  completedAt: null,
    hasStarted: false,
  currentNodeId: "q1",
  nodeStates: {
    "msg-1": {
      visited: true,
      visitCount: 1,
      isCurrent: false,
      enteredAt: "2025-01-20T09:00:00Z",
      exitedAt: "2025-01-20T09:00:05Z",
      dwellTime: 5,
      actionTaken: "clicked-video-button",
      droppedOff: false,
    },
    "v1-button": {
      visited: true,
      visitCount: 1,
      isCurrent: false,
      enteredAt: "2025-01-20T09:00:05Z",
      exitedAt: "2025-01-20T09:00:10Z",
      dwellTime: 5,
      actionTaken: "clicked-video-1",
      droppedOff: false,
    },
    v1: {
      visited: true,
      visitCount: 1,
      isCurrent: false,
      enteredAt: "2025-01-20T09:00:10Z",
      exitedAt: "2025-01-20T09:06:30Z",
      dwellTime: 380,
      actionTaken: "watched-full-video",
      droppedOff: false,
    },
    q1: {
      visited: true,
      visitCount: 1,
      isCurrent: true,
      enteredAt: "2025-01-20T09:06:30Z",
      exitedAt: null,
      dwellTime: null,
      actionTaken: null,
      droppedOff: false,
    },
  },
});

const createScenario = (): ScenarioPath => ({
  id: "happy-path",
  name: "Happy Path",
  description: "User completes the entire journey",
  nodeSequence: ["msg-1", "v1-button", "v1", "q1", "end"],
  edgeSequence: ["e1", "e2", "e3", "e4"],
});

describe("Journey Visualization", () => {
  describe("calculateJourneyVisualization", () => {
    it("should calculate step numbers based on enteredAt timestamps", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const journey = createUserJourney();

      const result = calculateJourneyVisualization(baseNodes, baseEdges, journey);

      // Check step numbers are assigned in chronological order
      const msg1Node = result.nodes.find((n) => n.id === "msg-1");
      const v1ButtonNode = result.nodes.find((n) => n.id === "v1-button");
      const v1Node = result.nodes.find((n) => n.id === "v1");
      const q1Node = result.nodes.find((n) => n.id === "q1");
      const endNode = result.nodes.find((n) => n.id === "end");

      expect(msg1Node?.data.journeyStep).toBe(1);
      expect(v1ButtonNode?.data.journeyStep).toBe(2);
      expect(v1Node?.data.journeyStep).toBe(3);
      expect(q1Node?.data.journeyStep).toBe(4);
      expect(endNode?.data.journeyStep).toBeUndefined(); // Not visited
    });

    it("should mark visited and current nodes correctly", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const journey = createUserJourney();

      const result = calculateJourneyVisualization(baseNodes, baseEdges, journey);

      const msg1Node = result.nodes.find((n) => n.id === "msg-1");
      const q1Node = result.nodes.find((n) => n.id === "q1");
      const endNode = result.nodes.find((n) => n.id === "end");

      expect(msg1Node?.data.journeyVisited).toBe(true);
      expect(msg1Node?.data.journeyCurrent).toBe(false);

      expect(q1Node?.data.journeyVisited).toBe(true);
      expect(q1Node?.data.journeyCurrent).toBe(true); // Current position

      expect(endNode?.data.journeyVisited).toBeUndefined(); // Not in nodeStates
    });

    it("should highlight edges connecting visited nodes in path order", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const journey = createUserJourney();

      const result = calculateJourneyVisualization(baseNodes, baseEdges, journey);

      const e1Edge = result.edges.find((e) => e.id === "e1"); // msg-1 -> v1-button
      const e2Edge = result.edges.find((e) => e.id === "e2"); // v1-button -> v1
      const e3Edge = result.edges.find((e) => e.id === "e3"); // v1 -> q1
      const e4Edge = result.edges.find((e) => e.id === "e4"); // q1 -> end

      // Edges in the journey path should be highlighted
      expect(e1Edge?.style?.stroke).toBe(CANVAS_COLORS.journeyHighlight);
      expect(e1Edge?.animated).toBe(true);

      expect(e2Edge?.style?.stroke).toBe(CANVAS_COLORS.journeyHighlight);
      expect(e2Edge?.animated).toBe(true);

      expect(e3Edge?.style?.stroke).toBe(CANVAS_COLORS.journeyHighlight);
      expect(e3Edge?.animated).toBe(true);

      // e4 should NOT be highlighted (end node not visited yet)
      expect(e4Edge?.style?.stroke).not.toBe(CANVAS_COLORS.journeyHighlight);
    });

    it("should not highlight nodes not in the journey", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const journey = createUserJourney();

      const result = calculateJourneyVisualization(baseNodes, baseEdges, journey);

      const endNode = result.nodes.find((n) => n.id === "end");
      expect(endNode?.data.journeyVisited).toBeUndefined();
      expect(endNode?.data.journeyCurrent).toBeUndefined();
      expect(endNode?.data.journeyStep).toBeUndefined();
    });

    it("should handle empty journey gracefully", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const emptyJourney: UserJourney = {
        userId: "user-002",
        journeyId: "test-journey",
        startedAt: "2025-01-20T10:00:00Z",
        completedAt: null,
    hasStarted: false,
        currentNodeId: null,
        nodeStates: {},
      };

      const result = calculateJourneyVisualization(baseNodes, baseEdges, emptyJourney);

      // All nodes should be unchanged
      result.nodes.forEach((node) => {
        expect(node.data.journeyVisited).toBeUndefined();
        expect(node.data.journeyCurrent).toBeUndefined();
        expect(node.data.journeyStep).toBeUndefined();
      });

      // All edges should be unchanged
      result.edges.forEach((edge) => {
        expect(edge.style?.stroke).not.toBe(CANVAS_COLORS.journeyHighlight);
      });
    });

    it("should mark dropped off nodes correctly", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const journeyWithDropoff: UserJourney = {
        userId: "user-003",
        journeyId: "test-journey",
        startedAt: "2025-01-20T09:00:00Z",
        completedAt: null,
    hasStarted: false,
        currentNodeId: null,
        nodeStates: {
          "msg-1": {
            visited: true,
            visitCount: 1,
            isCurrent: false,
            enteredAt: "2025-01-20T09:00:00Z",
            exitedAt: "2025-01-20T09:00:05Z",
            dwellTime: 5,
            actionTaken: null,
            droppedOff: true, // User dropped off here
          },
        },
      };

      const result = calculateJourneyVisualization(baseNodes, baseEdges, journeyWithDropoff);

      const msg1Node = result.nodes.find((n) => n.id === "msg-1");
      expect(msg1Node?.data.journeyDroppedOff).toBe(true);
    });
  });
});

describe("Scenario Visualization", () => {
  describe("calculateScenarioVisualization", () => {
    it("should calculate step numbers based on nodeSequence order", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const scenario = createScenario();

      const result = calculateScenarioVisualization(baseNodes, baseEdges, scenario);

      const msg1Node = result.nodes.find((n) => n.id === "msg-1");
      const v1ButtonNode = result.nodes.find((n) => n.id === "v1-button");
      const v1Node = result.nodes.find((n) => n.id === "v1");
      const q1Node = result.nodes.find((n) => n.id === "q1");
      const endNode = result.nodes.find((n) => n.id === "end");

      expect(msg1Node?.data.scenarioStep).toBe(1);
      expect(v1ButtonNode?.data.scenarioStep).toBe(2);
      expect(v1Node?.data.scenarioStep).toBe(3);
      expect(q1Node?.data.scenarioStep).toBe(4);
      expect(endNode?.data.scenarioStep).toBe(5);
    });

    it("should mark nodes in scenario as active", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const scenario = createScenario();

      const result = calculateScenarioVisualization(baseNodes, baseEdges, scenario);

      result.nodes.forEach((node) => {
        expect(node.data.scenarioActive).toBe(true);
      });
    });

    it("should highlight edges in scenario path", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const scenario = createScenario();

      const result = calculateScenarioVisualization(baseNodes, baseEdges, scenario);

      result.edges.forEach((edge) => {
        expect(edge.style?.stroke).toBe(CANVAS_COLORS.scenarioHighlight);
        expect(edge.animated).toBe(true);
      });
    });

    it("should handle partial scenario correctly", () => {
      const baseNodes = createBaseNodes();
      const baseEdges = createBaseEdges();
      const partialScenario: ScenarioPath = {
        id: "partial-path",
        name: "Partial Path",
        description: "User views video only",
        nodeSequence: ["msg-1", "v1-button", "v1"],
        edgeSequence: ["e1", "e2"],
      };

      const result = calculateScenarioVisualization(baseNodes, baseEdges, partialScenario);

      // Nodes in scenario should be active
      const msg1Node = result.nodes.find((n) => n.id === "msg-1");
      const v1ButtonNode = result.nodes.find((n) => n.id === "v1-button");
      const v1Node = result.nodes.find((n) => n.id === "v1");
      const q1Node = result.nodes.find((n) => n.id === "q1");
      const endNode = result.nodes.find((n) => n.id === "end");

      expect(msg1Node?.data.scenarioActive).toBe(true);
      expect(v1ButtonNode?.data.scenarioActive).toBe(true);
      expect(v1Node?.data.scenarioActive).toBe(true);
      expect(q1Node?.data.scenarioActive).toBe(false);
      expect(endNode?.data.scenarioActive).toBe(false);

      // Only e1 and e2 should be highlighted
      const e1Edge = result.edges.find((e) => e.id === "e1");
      const e2Edge = result.edges.find((e) => e.id === "e2");
      const e3Edge = result.edges.find((e) => e.id === "e3");
      const e4Edge = result.edges.find((e) => e.id === "e4");

      expect(e1Edge?.style?.stroke).toBe(CANVAS_COLORS.scenarioHighlight);
      expect(e2Edge?.style?.stroke).toBe(CANVAS_COLORS.scenarioHighlight);
      expect(e3Edge?.style?.stroke).not.toBe(CANVAS_COLORS.scenarioHighlight);
      expect(e4Edge?.style?.stroke).not.toBe(CANVAS_COLORS.scenarioHighlight);
    });
  });
});
