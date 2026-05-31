import { beforeEach, describe, expect, it } from "vitest";
import type { JourneyConfig } from "@/features/nodes/journey/react-flow-types";
import { EdgeTypeEnum, NodeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { journeyNodesActions, journeyNodesStore } from "../journey-nodes-store";
import { uiActions, uiStore } from "../ui-store";
import {
  addEdgeWithSync,
  addNodeWithSync,
  deleteEdgeWithSync,
  deleteNodeWithSync,
  discardChanges,
  redoWithSync,
  setButtonTargetNode,
  setJourneyData,
  undoWithSync,
  updateEdgeWithSync,
  updateNodeWithSync,
} from "../store-actions";
import { versionActions, versionStore } from "../version-store";

describe("store-actions (cross-store coordination)", () => {
  beforeEach(() => {
    // Reset store states before each test
    journeyNodesActions.setCurrentData({ nodes: [], edges: [] }, true);
    journeyNodesActions.setJourneyId(null);
    versionActions.setJourneySlug(null);
  });

  describe("setJourneyData", () => {
    it("should set journey data and mark as clean (no pending changes) when markAsClean is true", () => {
      const config: JourneyConfig = {
        nodes: [
          {
            id: "start-1",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: NodeTypeEnum.START, label: "Start", content: "Welcome" },
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

      setJourneyData(config, true);

      expect(journeyNodesStore.state.nodes).toHaveLength(1);
      expect(journeyNodesStore.state.originalNodes).toHaveLength(1);
      expect(uiStore.state.pendingChanges).toBe(false);
    });

    it("should mark as dirty (has pending changes) when markAsClean is false", () => {
      const config: JourneyConfig = {
        nodes: [
          {
            id: "start-1",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: NodeTypeEnum.START, label: "Start", content: "Welcome" },
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

      setJourneyData(config, false);

      expect(journeyNodesStore.state.nodes).toHaveLength(1);
      // pendingChanges should be true because markAsClean is false (dirty state)
      expect(uiStore.state.pendingChanges).toBe(true);
    });
  });

  describe("addNodeWithSync", () => {
    it("should add a node and set pending changes", () => {
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);

      expect(node).toBeDefined();
      expect(node.data.type).toBe(NodeTypeEnum.MESSAGE);
      expect(journeyNodesStore.state.nodes).toHaveLength(1);
      expect(uiStore.state.pendingChanges).toBe(true);
    });

    it("should add node at specified position", () => {
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE, { x: 100, y: 200 });

      expect(node.position.x).toBe(100);
      expect(node.position.y).toBe(200);
    });
  });

  describe("addEdgeWithSync", () => {
    it("should add an edge between nodes and set pending changes", () => {
      const node1 = addNodeWithSync(NodeTypeEnum.START);
      const node2 = addNodeWithSync(NodeTypeEnum.END);

      const edge = addEdgeWithSync(node1.id, node2.id, "Flow", EdgeTypeEnum.DEFAULT);

      expect(edge).toBeDefined();
      expect(edge.source).toBe(node1.id);
      expect(edge.target).toBe(node2.id);
      expect(edge.label).toBe("Flow");
      expect(journeyNodesStore.state.edges).toHaveLength(1);
      expect(uiStore.state.pendingChanges).toBe(true);
    });
  });

  describe("updateNodeWithSync", () => {
    it("should update node and set pending changes", () => {
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);

      updateNodeWithSync(node.id, {
        data: { ...node.data, label: "Updated Label" },
      });

      const updatedNode = journeyNodesStore.state.nodes.find((n) => n.id === node.id);
      expect(updatedNode?.data.label).toBe("Updated Label");
      expect(uiStore.state.pendingChanges).toBe(true);
    });
  });

  describe("deleteNodeWithSync", () => {
    it("should delete node and connected edges", () => {
      const node1 = addNodeWithSync(NodeTypeEnum.START);
      const node2 = addNodeWithSync(NodeTypeEnum.END);
      addEdgeWithSync(node1.id, node2.id);

      expect(journeyNodesStore.state.nodes).toHaveLength(2);
      expect(journeyNodesStore.state.edges).toHaveLength(1);

      deleteNodeWithSync(node1.id);

      expect(journeyNodesStore.state.nodes).toHaveLength(1);
      expect(journeyNodesStore.state.edges).toHaveLength(0);
      expect(uiStore.state.pendingChanges).toBe(true);
    });

    it("should clear selection if deleted node was selected", () => {
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);
      // Manually simulate selection
      uiActions.setSelectedNode(node);

      expect(uiStore.state.selectedNodeId).toBe(node.id);

      deleteNodeWithSync(node.id);

      expect(uiStore.state.selectedNodeId).toBeNull();
    });
  });

  describe("updateEdgeWithSync", () => {
    it("should update edge and set pending changes", () => {
      const node1 = addNodeWithSync(NodeTypeEnum.START);
      const node2 = addNodeWithSync(NodeTypeEnum.END);
      const edge = addEdgeWithSync(node1.id, node2.id);

      updateEdgeWithSync(edge.id, { label: "Updated Edge" });

      const updatedEdge = journeyNodesStore.state.edges.find((e) => e.id === edge.id);
      expect(updatedEdge?.label).toBe("Updated Edge");
      expect(uiStore.state.pendingChanges).toBe(true);
    });
  });

  describe("deleteEdgeWithSync", () => {
    it("should delete edge and set pending changes", () => {
      const node1 = addNodeWithSync(NodeTypeEnum.START);
      const node2 = addNodeWithSync(NodeTypeEnum.END);
      const edge = addEdgeWithSync(node1.id, node2.id);

      expect(journeyNodesStore.state.edges).toHaveLength(1);

      deleteEdgeWithSync(edge.id);

      expect(journeyNodesStore.state.edges).toHaveLength(0);
      expect(uiStore.state.pendingChanges).toBe(true);
    });

    it("should clear selection if deleted edge was selected", () => {
      const node1 = addNodeWithSync(NodeTypeEnum.START);
      const node2 = addNodeWithSync(NodeTypeEnum.END);
      const edge = addEdgeWithSync(node1.id, node2.id);

      // Manually simulate selection
      uiActions.setSelectedEdge(edge);

      expect(uiStore.state.selectedEdgeId).toBe(edge.id);

      deleteEdgeWithSync(edge.id);

      expect(uiStore.state.selectedEdgeId).toBeNull();
    });
  });

  describe("discardChanges", () => {
    it("should restore original data and reset pending changes", () => {
      const config: JourneyConfig = {
        nodes: [
          {
            id: "start-1",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: NodeTypeEnum.START, label: "Start", content: "Welcome" },
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

      setJourneyData(config, true);

      // Make some changes
      addNodeWithSync(NodeTypeEnum.MESSAGE);
      expect(journeyNodesStore.state.nodes).toHaveLength(2);
      expect(uiStore.state.pendingChanges).toBe(true);

      // Discard changes
      discardChanges();

      expect(journeyNodesStore.state.nodes).toHaveLength(1);
      expect(uiStore.state.pendingChanges).toBe(false);
    });
  });

  describe("updateNode metadata merge", () => {
    it("should merge new metadata with existing metadata", () => {
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);

      // Manually set metadata on the node
      journeyNodesActions.updateNode(node.id, {
        metadata: {
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
          status: "draft",
          notes: "original notes",
        },
      } as any);

      // Now update with new notes
      journeyNodesActions.updateNode(node.id, {
        metadata: {
          notes: "updated notes",
        },
      } as any);

      const updatedNode = journeyNodesStore.state.nodes.find((n) => n.id === node.id) as any;
      expect(updatedNode.metadata.notes).toBe("updated notes");
      expect(updatedNode.metadata.status).toBe("draft"); // preserved from original
      expect(updatedNode.metadata.version).toBe("1.0.0"); // preserved from original
    });

    it("should preserve existing metadata when update has no metadata", () => {
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);

      // Set initial metadata
      journeyNodesActions.updateNode(node.id, {
        metadata: {
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
          status: "active",
          notes: "keep these notes",
        },
      } as any);

      // Update data only (no metadata)
      journeyNodesActions.updateNode(node.id, {
        data: { ...node.data, label: "New Label" },
      });

      const updatedNode = journeyNodesStore.state.nodes.find((n) => n.id === node.id) as any;
      expect(updatedNode.metadata.notes).toBe("keep these notes");
      expect(updatedNode.metadata.status).toBe("active");
      expect(updatedNode.data.label).toBe("New Label");
    });

    it("should handle node without existing metadata when adding new metadata", () => {
      // Create a node without metadata by directly modifying store
      journeyNodesStore.setState((state) => ({
        ...state,
        nodes: [
          {
            id: "test-no-meta",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: NodeTypeEnum.MESSAGE, label: "No Meta" },
            // No metadata property
          },
        ],
      }));

      // Add metadata
      journeyNodesActions.updateNode("test-no-meta", {
        metadata: {
          notes: "new notes",
          status: "draft",
        },
      } as any);

      const updatedNode = journeyNodesStore.state.nodes.find((n) => n.id === "test-no-meta") as any;
      expect(updatedNode.metadata.notes).toBe("new notes");
      expect(updatedNode.metadata.status).toBe("draft");
      expect(updatedNode.metadata.updatedAt).toBeDefined();
    });
  });

  describe("undoWithSync / redoWithSync", () => {
    it("should undo last change", () => {
      const node1 = addNodeWithSync(NodeTypeEnum.START);
      expect(journeyNodesStore.state.nodes).toHaveLength(1);

      addNodeWithSync(NodeTypeEnum.MESSAGE);
      expect(journeyNodesStore.state.nodes).toHaveLength(2);

      const undone = undoWithSync();
      expect(undone).toBe(true);
      expect(journeyNodesStore.state.nodes).toHaveLength(1);
    });

    it("should redo undone change", () => {
      addNodeWithSync(NodeTypeEnum.START);
      addNodeWithSync(NodeTypeEnum.MESSAGE);
      expect(journeyNodesStore.state.nodes).toHaveLength(2);

      undoWithSync();
      expect(journeyNodesStore.state.nodes).toHaveLength(1);

      const redone = redoWithSync();
      expect(redone).toBe(true);
      expect(journeyNodesStore.state.nodes).toHaveLength(2);
    });

    it("should return false when nothing to undo", () => {
      const result = undoWithSync();
      expect(result).toBe(false);
    });

    it("should return false when nothing to redo", () => {
      const result = redoWithSync();
      expect(result).toBe(false);
    });
  });

  describe("End-to-End Notes Save", () => {
    it("should persist notes through complete save flow", () => {
      // 1. Create node with no metadata
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);

      // 2. Add notes via updateNodeWithSync (simulates form save)
      updateNodeWithSync(node.id, {
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
          status: "draft",
          notes: "My test notes",
        },
      } as any);

      // 3. Verify notes persisted
      const updated = journeyNodesStore.state.nodes.find((n) => n.id === node.id) as any;
      expect(updated.metadata.notes).toBe("My test notes");

      // 4. Clear notes (empty string)
      updateNodeWithSync(node.id, {
        metadata: { notes: "" },
      } as any);

      // 5. Verify empty notes persisted (not reverted to previous value)
      const cleared = journeyNodesStore.state.nodes.find((n) => n.id === node.id) as any;
      expect(cleared.metadata.notes).toBe("");
    });

    it("should preserve notes when updating other node data", () => {
      // Create node and set notes
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);
      updateNodeWithSync(node.id, {
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
          status: "draft",
          notes: "Important notes",
        },
      } as any);

      // Update data only (no metadata in update)
      updateNodeWithSync(node.id, {
        data: { ...node.data, label: "Updated Label" },
      });

      // Notes should still be there
      const updated = journeyNodesStore.state.nodes.find((n) => n.id === node.id) as any;
      expect(updated.metadata.notes).toBe("Important notes");
      expect(updated.data.label).toBe("Updated Label");
    });
  });

  describe("updateBaseline (discard-after-save fix)", () => {
    it("should update baseline after calling updateBaseline", () => {
      // 1. Load journey data (sets initial baseline)
      const config: JourneyConfig = {
        nodes: [
          {
            id: "start-1",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: NodeTypeEnum.START, label: "Start", content: "Initial" },
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
      setJourneyData(config, true);

      expect(journeyNodesStore.state.nodes).toHaveLength(1);
      expect(journeyNodesStore.state.originalNodes).toHaveLength(1);

      // 2. Make changes (add a node)
      const newNode = addNodeWithSync(NodeTypeEnum.MESSAGE);
      expect(journeyNodesStore.state.nodes).toHaveLength(2);
      expect(journeyNodesStore.state.originalNodes).toHaveLength(1); // baseline unchanged

      // 3. Simulate save by calling updateBaseline
      journeyNodesActions.updateBaseline();

      // Baseline should now reflect the 2-node state
      expect(journeyNodesStore.state.originalNodes).toHaveLength(2);

      // 4. Make more changes (add another node)
      addNodeWithSync(NodeTypeEnum.END);
      expect(journeyNodesStore.state.nodes).toHaveLength(3);

      // 5. Discard changes - should revert to the "saved" state (2 nodes), not initial (1 node)
      discardChanges();

      expect(journeyNodesStore.state.nodes).toHaveLength(2);
      expect(journeyNodesStore.state.nodes.some((n) => n.id === newNode.id)).toBe(true);
    });

    it("should preserve baseline nodes and edges independently after updateBaseline", () => {
      // Load initial data
      const config: JourneyConfig = {
        nodes: [
          {
            id: "start-1",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: NodeTypeEnum.START, label: "Start", content: "Initial" },
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
      setJourneyData(config, true);

      // Add a node and edge
      const node2 = addNodeWithSync(NodeTypeEnum.END);
      const edge = addEdgeWithSync("start-1", node2.id);

      // Update baseline (simulates save)
      journeyNodesActions.updateBaseline();

      // Now both node and edge should be in baseline
      expect(journeyNodesStore.state.originalNodes).toHaveLength(2);
      expect(journeyNodesStore.state.originalEdges).toHaveLength(1);

      // Add more changes
      addNodeWithSync(NodeTypeEnum.MESSAGE);
      addEdgeWithSync(node2.id, journeyNodesStore.state.nodes[2].id);

      expect(journeyNodesStore.state.nodes).toHaveLength(3);
      expect(journeyNodesStore.state.edges).toHaveLength(2);

      // Discard should go back to 2 nodes, 1 edge (the saved state)
      discardChanges();

      expect(journeyNodesStore.state.nodes).toHaveLength(2);
      expect(journeyNodesStore.state.edges).toHaveLength(1);
      expect(journeyNodesStore.state.edges[0].id).toBe(edge.id);
    });

    it("should not affect undo stack when updating baseline", () => {
      // Load initial data
      const config: JourneyConfig = {
        nodes: [
          {
            id: "start-1",
            type: "custom",
            position: { x: 0, y: 0 },
            data: { type: NodeTypeEnum.START, label: "Start", content: "Initial" },
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
      setJourneyData(config, true);

      // Make changes
      addNodeWithSync(NodeTypeEnum.MESSAGE);
      addNodeWithSync(NodeTypeEnum.END);

      // Should have undo history
      expect(journeyNodesActions.canUndo()).toBe(true);

      // Update baseline
      journeyNodesActions.updateBaseline();

      // Undo should still work (baseline update doesn't affect history)
      expect(journeyNodesActions.canUndo()).toBe(true);
      undoWithSync();
      expect(journeyNodesStore.state.nodes).toHaveLength(2);
    });
  });

  describe("setButtonTargetNode", () => {
    it("should create managed edge for existing button", () => {
      // Create a message node with buttons
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);
      const existingButton = { id: "btn-1", text: "Click me" };

      // Add button to node
      journeyNodesActions.updateNode(node.id, {
        data: { ...node.data, buttons: [existingButton] },
      });

      // Create target node
      const targetNode = addNodeWithSync(NodeTypeEnum.END);

      // Set button target
      setButtonTargetNode(node.id, existingButton.id, targetNode.id);

      // Verify edge was created
      const edges = journeyNodesStore.state.edges;
      const managedEdge = edges.find((e) => e.id === `managed-btn::${node.id}::${existingButton.id}`);

      expect(managedEdge).toBeDefined();
      expect(managedEdge?.source).toBe(node.id);
      expect(managedEdge?.target).toBe(targetNode.id);
      expect(managedEdge?.managed).toBe(true);
    });

    it("should add new button to store when button does not exist (form-only button)", () => {
      // Create a message node with empty buttons array
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);
      journeyNodesActions.updateNode(node.id, {
        data: { ...node.data, buttons: [] },
      });

      // Create target node
      const targetNode = addNodeWithSync(NodeTypeEnum.END);

      // Simulate: button added in form (not saved yet) → user selects target
      // The button only exists in form state, not in store
      const newButtonId = "btn-new-form-only";

      // Set button target for a button that doesn't exist in store
      setButtonTargetNode(node.id, newButtonId, targetNode.id);

      // Verify button was added to store
      const updatedNode = journeyNodesStore.state.nodes.find((n) => n.id === node.id);
      const buttons = (updatedNode?.data as any).buttons;
      expect(buttons).toHaveLength(1);
      expect(buttons[0].id).toBe(newButtonId);
      expect(buttons[0].targetNodeId).toBe(targetNode.id);

      // Verify edge was created
      const edges = journeyNodesStore.state.edges;
      const managedEdge = edges.find((e) => e.id === `managed-btn::${node.id}::${newButtonId}`);

      expect(managedEdge).toBeDefined();
      expect(managedEdge?.source).toBe(node.id);
      expect(managedEdge?.target).toBe(targetNode.id);
      expect(managedEdge?.managed).toBe(true);
    });

    it("should update edge when button target changes", () => {
      // Create a message node with a button
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);
      const button = { id: "btn-1", text: "Click me" };
      journeyNodesActions.updateNode(node.id, {
        data: { ...node.data, buttons: [button] },
      });

      // Create two target nodes
      const target1 = addNodeWithSync(NodeTypeEnum.END);
      const target2 = addNodeWithSync(NodeTypeEnum.MESSAGE);

      // Set initial target
      setButtonTargetNode(node.id, button.id, target1.id);

      // Verify initial edge
      let edges = journeyNodesStore.state.edges;
      let managedEdge = edges.find((e) => e.id === `managed-btn::${node.id}::${button.id}`);
      expect(managedEdge?.target).toBe(target1.id);

      // Change target
      setButtonTargetNode(node.id, button.id, target2.id);

      // Verify edge was updated
      edges = journeyNodesStore.state.edges;
      managedEdge = edges.find((e) => e.id === `managed-btn::${node.id}::${button.id}`);
      expect(managedEdge?.target).toBe(target2.id);
      expect(edges.filter((e) => e.id.includes(button.id))).toHaveLength(1); // Only one edge
    });

    it("should delete edge when button target is cleared", () => {
      // Create a message node with a button and target
      const node = addNodeWithSync(NodeTypeEnum.MESSAGE);
      const button = { id: "btn-1", text: "Click me" };
      journeyNodesActions.updateNode(node.id, {
        data: { ...node.data, buttons: [button] },
      });

      const targetNode = addNodeWithSync(NodeTypeEnum.END);

      // Set target (creates edge)
      setButtonTargetNode(node.id, button.id, targetNode.id);
      expect(journeyNodesStore.state.edges).toHaveLength(1);

      // Clear target (should delete edge)
      setButtonTargetNode(node.id, button.id, undefined);

      const edges = journeyNodesStore.state.edges;
      expect(edges.filter((e) => e.id.includes(button.id))).toHaveLength(0);
    });
  });
});
