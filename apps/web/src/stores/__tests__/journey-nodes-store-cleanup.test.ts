/**
 * Journey Nodes Store - Cleanup Tests
 *
 * Tests for orphaned reference cleanup when deleting nodes.
 * These are critical for maintaining data integrity on the canvas.
 *
 * Run with: pnpm vitest run src/stores/__tests__/journey-nodes-store-cleanup.test.ts
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { NodeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { journeyNodesStore, journeyNodesActions } from "../journey-nodes-store";
import type { ButtonConfig } from "@journey/schemas";

// Helper to create test nodes
const createTestNode = (
  id: string,
  type = NodeTypeEnum.MESSAGE,
  data: Record<string, unknown> = {}
): JourneyNode => ({
  id,
  type: "custom",
  position: { x: 0, y: 0 },
  data: { type, label: `Node ${id}`, content: "Test content", ...data },
});

// Helper to create a node with buttons
const createNodeWithButtons = (
  id: string,
  buttons: ButtonConfig[]
): JourneyNode => ({
  id,
  type: "custom",
  position: { x: 0, y: 0 },
  data: {
    type: NodeTypeEnum.MESSAGE,
    label: `Node ${id}`,
    content: "Test content",
    buttons,
  },
});

describe("journey-nodes-store cleanup", () => {
  beforeEach(() => {
    // Reset store state before each test
    journeyNodesStore.setState({
      journeyId: "test-journey",
      nodes: [],
      edges: [],
      originalNodes: [],
      originalEdges: [],
      undoStack: [],
      redoStack: [],
    });
  });

  // ===========================================================================
  // Button Reference Cleanup
  // ===========================================================================

  describe("deleteNode - button reference cleanup", () => {
    it("clears button targetNodeIds pointing to deleted node", () => {
      const targetNode = createTestNode("target-node");
      const buttonNode = createNodeWithButtons("button-node", [
        { id: "btn-1", label: "Go to target", targetNodeId: "target-node" },
        { id: "btn-2", label: "Stay here", targetNodeId: "other-node" },
      ]);

      journeyNodesStore.setState((s) => ({
        ...s,
        nodes: [targetNode, buttonNode],
      }));

      // Delete the target node
      journeyNodesActions.deleteNode("target-node");

      const state = journeyNodesStore.state;
      expect(state.nodes).toHaveLength(1);

      const remainingNode = state.nodes[0];
      const buttons = remainingNode.data.buttons as ButtonConfig[];
      expect(buttons[0].targetNodeId).toBeUndefined();
      expect(buttons[1].targetNodeId).toBe("other-node");
    });

    it("handles multiple buttons pointing to same deleted node", () => {
      const targetNode = createTestNode("target-node");
      const buttonNode = createNodeWithButtons("button-node", [
        { id: "btn-1", label: "Option A", targetNodeId: "target-node" },
        { id: "btn-2", label: "Option B", targetNodeId: "target-node" },
        { id: "btn-3", label: "Option C", targetNodeId: "safe-node" },
      ]);
      const safeNode = createTestNode("safe-node");

      journeyNodesStore.setState((s) => ({
        ...s,
        nodes: [targetNode, buttonNode, safeNode],
      }));

      journeyNodesActions.deleteNode("target-node");

      const state = journeyNodesStore.state;
      const buttons = state.nodes.find((n) => n.id === "button-node")?.data.buttons as ButtonConfig[];
      expect(buttons[0].targetNodeId).toBeUndefined();
      expect(buttons[1].targetNodeId).toBeUndefined();
      expect(buttons[2].targetNodeId).toBe("safe-node");
    });

    it("handles nodes with no buttons gracefully", () => {
      const targetNode = createTestNode("target-node");
      const plainNode = createTestNode("plain-node");

      journeyNodesStore.setState((s) => ({
        ...s,
        nodes: [targetNode, plainNode],
      }));

      // Should not throw when deleting
      expect(() => journeyNodesActions.deleteNode("target-node")).not.toThrow();

      const state = journeyNodesStore.state;
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe("plain-node");
    });

  });

  // ===========================================================================
  // Edge Cleanup (existing behavior)
  // ===========================================================================

  describe("deleteNode - edge cleanup", () => {
    it("removes edges connected to deleted node", () => {
      const node1 = createTestNode("node-1");
      const node2 = createTestNode("node-2");
      const node3 = createTestNode("node-3");

      journeyNodesStore.setState((s) => ({
        ...s,
        nodes: [node1, node2, node3],
        edges: [
          { id: "e1", source: "node-1", target: "node-2" },
          { id: "e2", source: "node-2", target: "node-3" },
        ],
      }));

      journeyNodesActions.deleteNode("node-2");

      const state = journeyNodesStore.state;
      expect(state.edges).toHaveLength(0); // Both edges are removed
    });

    it("preserves edges not connected to deleted node", () => {
      const node1 = createTestNode("node-1");
      const node2 = createTestNode("node-2");
      const node3 = createTestNode("node-3");

      journeyNodesStore.setState((s) => ({
        ...s,
        nodes: [node1, node2, node3],
        edges: [
          { id: "e1", source: "node-1", target: "node-3" },
        ],
      }));

      journeyNodesActions.deleteNode("node-2");

      const state = journeyNodesStore.state;
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].id).toBe("e1");
    });
  });

  // ===========================================================================
  // Combined Scenarios
  // ===========================================================================

  describe("deleteNode - combined cleanup scenarios", () => {
    it("cleans up regular buttons when target is deleted", () => {
      const targetNode = createTestNode("target-node");
      const complexNode: JourneyNode = {
        id: "complex-node",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: NodeTypeEnum.MESSAGE,
          label: "Complex Node",
          content: "Test",
          buttons: [{ id: "btn-1", label: "Direct", targetNodeId: "target-node" }],
        },
      };

      journeyNodesStore.setState((s) => ({
        ...s,
        nodes: [targetNode, complexNode],
      }));

      journeyNodesActions.deleteNode("target-node");

      const state = journeyNodesStore.state;
      const remaining = state.nodes[0];

      // Regular buttons cleaned
      const buttons = remaining.data.buttons as ButtonConfig[];
      expect(buttons[0].targetNodeId).toBeUndefined();
    });

    it("handles multiple nodes with references to same deleted node", () => {
      const targetNode = createTestNode("target-node");
      const buttonNode1 = createNodeWithButtons("btn-node-1", [
        { id: "btn-1", label: "Go", targetNodeId: "target-node" },
      ]);
      const buttonNode2 = createNodeWithButtons("btn-node-2", [
        { id: "btn-2", label: "Also go", targetNodeId: "target-node" },
      ]);

      journeyNodesStore.setState((s) => ({
        ...s,
        nodes: [targetNode, buttonNode1, buttonNode2],
      }));

      journeyNodesActions.deleteNode("target-node");

      const state = journeyNodesStore.state;
      expect(state.nodes).toHaveLength(2);

      const buttons1 = state.nodes[0].data.buttons as ButtonConfig[];
      const buttons2 = state.nodes[1].data.buttons as ButtonConfig[];
      expect(buttons1[0].targetNodeId).toBeUndefined();
      expect(buttons2[0].targetNodeId).toBeUndefined();
    });
  });
});
