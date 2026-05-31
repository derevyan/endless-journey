/**
 * Agent Workflow Canvas
 *
 * React Flow canvas for building agent workflows.
 *
 * @module features/agent-workflows/components/canvas/agent-workflow-canvas
 */

import { useCallback, useEffect, useMemo } from "react";

import { useStore } from "@tanstack/react-store";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowNodeType } from "@journey/schemas";

import { AutoLayoutPanel } from "@/shared/components/ui/auto-layout-panel";
import { NodeSelectorPanel, type NodeSelectorItem } from "@/shared/components/ui/node-selector-panel";
import { useDebouncedLayoutPreview } from "@/shared/hooks/use-debounced-layout-preview";
import { DEFAULT_WORKFLOW_LAYOUT_OPTIONS } from "@/shared/lib/ui/layout";
import { notify } from "@/shared/lib/ui/notify";

import { getWorkflowNodeTheme } from "@/features/nodes/workflow/config/workflow-theme";
import { workflowNodeRegistry } from "@/features/nodes/workflow/definitions";
import { useNodeDimensions } from "@/features/nodes/workflow/hooks/use-node-dimensions";

import { useAgentWorkflowKeyboardShortcuts } from "../../hooks/use-agent-workflow-keyboard-shortcuts";
import {
  agentWorkflowActions,
  agentWorkflowStore,
  clearSelectionWithAutoSave,
  selectNodeWithAutoSave,
  type WorkflowCanvasEdge,
  type WorkflowCanvasNode,
} from "../../stores/agent-workflow-store";
import { NodeConfigPanel } from "../config-panel/node-config-panel";
import { AgentWorkflowEdge } from "./agent-workflow-edge";

// =============================================================================
// EDGE TYPES
// =============================================================================

const agentWorkflowEdgeTypes = {
  default: AgentWorkflowEdge,
};

// =============================================================================
// TYPES
// =============================================================================

interface AgentWorkflowCanvasProps {
  /** Whether the canvas is in read-only mode */
  readOnly?: boolean;
}

// =============================================================================
// INNER COMPONENT
// =============================================================================

function AgentWorkflowCanvasInner({ readOnly = false }: AgentWorkflowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  // Map registry nodes to NodeSelectorItem format
  const nodeSelectorItems = useMemo<NodeSelectorItem[]>(() => {
    return workflowNodeRegistry.getAddable().map((node) => ({
      type: node.type,
      label: node.displayName,
      icon: node.icon,
      iconColorClass: getWorkflowNodeTheme(node.type).icon,
    }));
  }, []);

  // Get state from store
  const storeNodes = useStore(agentWorkflowStore, (s) => s.nodes);
  const storeEdges = useStore(agentWorkflowStore, (s) => s.edges);
  const selectedNodeId = useStore(agentWorkflowStore, (s) => s.selectedNodeId);
  const selectedEdgeId = useStore(agentWorkflowStore, (s) => s.selectedEdgeId);
  const simulatorCurrentNodeId = useStore(agentWorkflowStore, (s) => s.simulatorCurrentNodeId);
  const simulatorVisitedNodeIds = useStore(agentWorkflowStore, (s) => s.simulatorVisitedNodeIds);
  const simulatorVisitedEdgeIds = useStore(agentWorkflowStore, (s) => s.simulatorVisitedEdgeIds);
  const autoLayoutPanelOpen = useStore(agentWorkflowStore, (s) => s.autoLayoutPanelOpen);
  const layoutSettings = useStore(agentWorkflowStore, (s) => s.layoutSettings);

  // Get node dimensions for ELK layout
  const { getAllDimensions } = useNodeDimensions();

  // Debounced layout preview and apply handlers
  const { handlePreviewLayout, handleApplyLayout } = useDebouncedLayoutPreview({
    getAllDimensions,
    nodes: storeNodes,
    previewLayoutAsync: agentWorkflowActions.previewLayoutAsync,
    commitLayoutAsync: agentWorkflowActions.commitLayoutPreviewAsync,
  });

  // Local React Flow state
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<WorkflowCanvasNode>(storeNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<WorkflowCanvasEdge>(storeEdges);

  // Sync local state with store
  useEffect(() => {
    setNodes(storeNodes);
  }, [storeNodes, setNodes]);

  useEffect(() => {
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  // Process nodes to add selection state and simulator mode visual feedback
  const processedNodes = useMemo(() => {
    return nodes.map((node) => {
      const isCurrentNode = readOnly && simulatorCurrentNodeId === node.id;
      const isVisitedNode = readOnly && simulatorVisitedNodeIds.includes(node.id);

      return {
        ...node,
        selected: node.id === selectedNodeId,
        // Pass simulator state to node data for visual feedback
        data: {
          ...node.data,
          isCurrentNode,
          isVisitedNode,
        },
      };
    });
  }, [nodes, selectedNodeId, readOnly, simulatorCurrentNodeId, simulatorVisitedNodeIds]);

  // Process edges to add selection state, visited state, and delete handler
  const processedEdges = useMemo(() => {
    return edges.map((edge) => {
      const isVisitedEdge = readOnly && simulatorVisitedEdgeIds.includes(edge.id);
      return {
        ...edge,
        selected: edge.id === selectedEdgeId,
        data: {
          ...edge.data,
          isVisitedEdge,
          onDelete: (edgeId: string) => agentWorkflowActions.deleteEdge(edgeId),
        },
      };
    });
  }, [edges, selectedEdgeId, readOnly, simulatorVisitedEdgeIds]);

  // Handle node changes - separate position updates from other changes
  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowCanvasNode>[]) => {
      if (readOnly) return;

      // Apply changes locally for smooth dragging
      onNodesChangeInternal(changes);

      // Collect position changes (handled separately - no undo tracking during drag)
      const positionUpdates = new Map<string, { x: number; y: number }>();
      const otherChanges: NodeChange<WorkflowCanvasNode>[] = [];

      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          positionUpdates.set(change.id, change.position);
        } else {
          otherChanges.push(change);
        }
      });

      // Handle position updates (state captured at drag start, not per-frame)
      if (positionUpdates.size > 0) {
        agentWorkflowActions.updateNodePositions(positionUpdates);
      }

      // Handle other changes normally
      if (otherChanges.length > 0) {
        agentWorkflowActions.applyNodeChanges(otherChanges, applyNodeChanges);
      }
    },
    [readOnly, onNodesChangeInternal]
  );

  // Handle drag start - capture state once for undo
  const onNodeDragStart = useCallback(() => {
    if (!readOnly) {
      agentWorkflowActions.startNodeDrag();
    }
  }, [readOnly]);

  // Handle drag stop - no-op (state was captured at start)
  const onNodeDragStop = useCallback(() => {
    if (!readOnly) {
      agentWorkflowActions.endNodeDrag();
    }
  }, [readOnly]);

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;

      onEdgesChangeInternal(changes);
      agentWorkflowActions.applyEdgeChanges(changes, applyEdgeChanges);
    },
    [readOnly, onEdgesChangeInternal]
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      agentWorkflowActions.addEdge(connection);
    },
    [readOnly]
  );

  // Handle node click - in edit mode selects node (with auto-save)
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: WorkflowCanvasNode) => {
      if (readOnly) return;
      void selectNodeWithAutoSave(node.id);
    },
    [readOnly]
  );

  // Handle edge click (select edge) - only in edit mode
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: WorkflowCanvasEdge) => {
      if (readOnly) return;
      agentWorkflowActions.selectEdge(edge.id);
    },
    [readOnly]
  );

  // Handle pane click (deselect with auto-save)
  // Uses clearSelectionWithAutoSave to trigger auto-save before clearing selection
  const onPaneClick = useCallback(() => {
    void clearSelectionWithAutoSave();
  }, []);

  // Handle drop for adding new nodes
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (readOnly) return;

      event.preventDefault();
      const type = event.dataTransfer.getData("application/workflow-node") as WorkflowNodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      agentWorkflowActions.addNode(type, position);
    },
    [readOnly, screenToFlowPosition]
  );

  // Handle copy with notification
  const handleCopy = useCallback(() => {
    const copied = agentWorkflowActions.copyNodeToClipboard();
    if (copied) {
      notify.success("Node copied");
    } else if (selectedNodeId) {
      // Selected but couldn't copy (must be start node)
      notify.warning("Start node cannot be copied");
    }
  }, [selectedNodeId]);

  // Handle paste with notification
  const handlePaste = useCallback(() => {
    const { clipboard } = agentWorkflowStore.state;
    if (!clipboard) {
      notify.warning("Clipboard empty");
      return;
    }
    const newId = agentWorkflowActions.pasteNode();
    if (newId) {
      notify.success("Node pasted");
    }
  }, []);

  // Handle duplicate with notification
  const handleDuplicate = useCallback(() => {
    const { selectedNodeId: nodeId, nodes } = agentWorkflowStore.state;
    if (!nodeId) return;

    const node = nodes.find((n) => n.id === nodeId);
    if (node?.type === "start") {
      notify.warning("Start node cannot be duplicated");
      return;
    }

    const newId = agentWorkflowActions.duplicateNode();
    if (newId) {
      notify.success("Node duplicated");
    }
  }, []);

  // Keyboard shortcuts with capture phase
  useAgentWorkflowKeyboardShortcuts({
    readOnly,
    selectedNodeId,
    selectedEdgeId,
    onUndo: () => agentWorkflowActions.undo(),
    onRedo: () => agentWorkflowActions.redo(),
    onDeleteNode: (nodeId) => agentWorkflowActions.deleteNode(nodeId),
    onDeleteEdge: (edgeId) => agentWorkflowActions.deleteEdge(edgeId),
    onCopyNode: handleCopy,
    onPasteNode: handlePaste,
    onDuplicateNode: handleDuplicate,
  });

  return (
    <div className="h-full w-full" data-testid="workflow-canvas">
      <ReactFlow
        nodes={processedNodes}
        edges={processedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={workflowNodeRegistry.getNodeTypesMap()}
        edgeTypes={agentWorkflowEdgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-muted/30"
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={null} // We handle delete ourselves
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
      >
        <Background color="currentColor" className="text-muted-foreground/20" gap={20} size={1} />
        <Controls showInteractive={false} />
        <NodeSelectorPanel
          nodes={nodeSelectorItems}
          dataTransferType="application/workflow-node"
          readOnly={readOnly}
        />
        <NodeConfigPanel readOnly={readOnly} />
        <AutoLayoutPanel
          isOpen={autoLayoutPanelOpen}
          onClose={() => agentWorkflowActions.closeAutoLayoutPanel()}
          initialOptions={layoutSettings ?? undefined}
          defaultOptions={DEFAULT_WORKFLOW_LAYOUT_OPTIONS}
          onStartPreview={() => agentWorkflowActions.startLayoutPreview()}
          onPreview={handlePreviewLayout}
          onCancelPreview={() => agentWorkflowActions.cancelLayoutPreview()}
          onApply={handleApplyLayout}
          readOnly={readOnly}
          className="top-[15px] left-[252px]"
        />
      </ReactFlow>
    </div>
  );
}

// =============================================================================
// WRAPPER COMPONENT
// =============================================================================

export function AgentWorkflowCanvas(props: AgentWorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <AgentWorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
