import { beforeEach, describe, expect, it } from "vitest";
import type { JourneyConfig, JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { EdgeTypeEnum, NodeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { journeyNodesActions, journeyNodesStore } from "../journey-nodes-store";
import { uiActions, uiSelectors, uiStore } from "../ui-store";
import { versionActions, versionStore } from "../version-store";

describe("editor stores", () => {
  beforeEach(() => {
    // Reset store states before each test
    journeyNodesActions.setCurrentData({ nodes: [], edges: [] }, true);
    uiActions.setMode("edit"); // Default to edit mode
    uiActions.setSelectedNode(null);
    uiActions.setSelectedEdge(null);
    uiActions.setPendingChanges(false); // Reset pending changes after data operations
    journeyNodesActions.setJourneyId(null);
    versionActions.setJourneySlug(null);
  });

  describe("uiActions", () => {
    describe("setMode", () => {
      it("should toggle between edit and simulator modes", () => {
        // Default state is edit mode
        expect(uiSelectors.isEditMode(uiStore.state)).toBe(true);
        expect(uiSelectors.isSimulatorActive(uiStore.state)).toBe(false);

        // Switch to simulator mode
        uiActions.setMode("simulator");
        expect(uiSelectors.isEditMode(uiStore.state)).toBe(false);
        expect(uiSelectors.isSimulatorActive(uiStore.state)).toBe(true);

        // Switch back to edit mode
        uiActions.setMode("edit");
        expect(uiSelectors.isEditMode(uiStore.state)).toBe(true);
        expect(uiSelectors.isSimulatorActive(uiStore.state)).toBe(false);
      });
    });
  });

  describe("journeyNodesActions", () => {
    describe("addNode", () => {
      it("should add a new node with generated ID", () => {
        const node = journeyNodesActions.addNode(NodeTypeEnum.MESSAGE);
        expect(node).toBeDefined();
        expect(node.id).toBe("node-1");
        expect(node.data.type).toBe(NodeTypeEnum.MESSAGE);
        expect(journeyNodesStore.state.nodes).toHaveLength(1);
        // Note: pendingChanges is managed by uiStore, not journeyNodesStore
        // Use store-actions.ts functions (e.g., addNodeWithSync) for cross-store coordination
      });

      it("should generate unique node IDs", () => {
        const node1 = journeyNodesActions.addNode(NodeTypeEnum.START);
        const node2 = journeyNodesActions.addNode(NodeTypeEnum.END);
        expect(node1.id).not.toBe(node2.id);
        expect(journeyNodesStore.state.nodes).toHaveLength(2);
      });

      it("should create node with metadata", () => {
        const node = journeyNodesActions.addNode(NodeTypeEnum.CONDITION);
        const nodeWithMeta = node as any; // Type assertion for test
        expect(nodeWithMeta.metadata).toBeDefined();
        expect(nodeWithMeta.metadata.createdAt).toBeDefined();
        expect(nodeWithMeta.metadata.updatedAt).toBeDefined();
        expect(nodeWithMeta.metadata.version).toBe("1.0.0");
        expect(nodeWithMeta.metadata.status).toBe("draft");
      });
    });

    describe("deleteNode", () => {
      it("should delete a node and connected edges", () => {
        const node1 = journeyNodesActions.addNode(NodeTypeEnum.START);
        const node2 = journeyNodesActions.addNode(NodeTypeEnum.END);
        const edge = journeyNodesActions.addEdge(node1.id, node2.id);

        expect(journeyNodesStore.state.nodes).toHaveLength(2);
        expect(journeyNodesStore.state.edges).toHaveLength(1);

        journeyNodesActions.deleteNode(node1.id);

        expect(journeyNodesStore.state.nodes).toHaveLength(1);
        expect(journeyNodesStore.state.edges).toHaveLength(0); // Edge should be removed
        // Note: pendingChanges is managed by uiStore via store-actions.ts
      });
    });

    describe("addEdge", () => {
      it("should add a new edge with generated ID", () => {
        const node1 = journeyNodesActions.addNode(NodeTypeEnum.START);
        const node2 = journeyNodesActions.addNode(NodeTypeEnum.END);
        const edge = journeyNodesActions.addEdge(node1.id, node2.id);

        expect(edge).toBeDefined();
        expect(edge.id).toBe("e1");
        expect(edge.source).toBe(node1.id);
        expect(edge.target).toBe(node2.id);
        expect(journeyNodesStore.state.edges).toHaveLength(1);
        // Note: pendingChanges is managed by uiStore via store-actions.ts
      });

      it("should generate unique edge IDs", () => {
        const node1 = journeyNodesActions.addNode(NodeTypeEnum.START);
        const node2 = journeyNodesActions.addNode(NodeTypeEnum.MESSAGE);
        const node3 = journeyNodesActions.addNode(NodeTypeEnum.END);

        const edge1 = journeyNodesActions.addEdge(node1.id, node2.id);
        const edge2 = journeyNodesActions.addEdge(node2.id, node3.id);

        expect(edge1.id).not.toBe(edge2.id);
        expect(journeyNodesStore.state.edges).toHaveLength(2);
      });
    });

    describe("deleteEdge", () => {
      it("should delete an edge", () => {
        const node1 = journeyNodesActions.addNode(NodeTypeEnum.START);
        const node2 = journeyNodesActions.addNode(NodeTypeEnum.END);
        const edge = journeyNodesActions.addEdge(node1.id, node2.id);

        expect(journeyNodesStore.state.edges).toHaveLength(1);

        journeyNodesActions.deleteEdge(edge.id);

        expect(journeyNodesStore.state.edges).toHaveLength(0);
        // Note: pendingChanges is managed by uiStore via store-actions.ts
      });
    });

    describe("updateNode", () => {
      it("should update node data and metadata", async () => {
        const node = journeyNodesActions.addNode(NodeTypeEnum.MESSAGE);
        const nodeWithMeta = node as any; // Type assertion for test
        const originalUpdatedAt = nodeWithMeta.metadata.updatedAt;

        // Wait a bit to ensure timestamp changes
        await new Promise((resolve) => setTimeout(resolve, 10));

        journeyNodesActions.updateNode(node.id, {
          data: { ...node.data, label: "Updated Label" },
        });

        const updatedNode = journeyNodesStore.state.nodes.find((n) => n.id === node.id);
        const updatedNodeWithMeta = updatedNode as any; // Type assertion for test
        expect(updatedNode?.data.label).toBe("Updated Label");
        expect(updatedNodeWithMeta?.metadata.updatedAt).not.toBe(originalUpdatedAt);
        // Note: pendingChanges is managed by store-actions, not journeyNodesActions
      });
    });

    describe("setCurrentData", () => {
      it("should set nodes and edges without triggering pending changes", () => {
        const config: JourneyConfig = {
          nodes: [
            {
              id: "test-node",
              type: "custom",
              position: { x: 0, y: 0 },
              data: { type: NodeTypeEnum.START, label: "Test", content: "Test" },
              metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: "1.0.0",
                status: "active",
              },
            },
          ],
          edges: [],
        };

        journeyNodesActions.setCurrentData(config, true);

        expect(journeyNodesStore.state.nodes).toHaveLength(1);
        expect(journeyNodesStore.state.edges).toHaveLength(0);
        // setCurrentData emits journey:loaded, not individual CRUD events
        // so it doesn't trigger pendingChanges via event bus
        // pendingChanges coordination is handled by store-actions.ts (setJourneyData)
        expect(uiStore.state.pendingChanges).toBe(false);
      });
    });
  });
});
