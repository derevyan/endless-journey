import { useStore } from "@tanstack/react-store";
import {
  Background,
  ConnectionLineType,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  useReactFlow,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { REACT_FLOW_CONFIG } from "@/features/journey/builder/config/canvas-config";
import { useCanvasContext } from "@/features/journey/builder/context";
import { useCanvasKeyboardShortcuts } from "@/features/journey/builder/hooks/use-canvas-keyboard-shortcuts";
import { useNodeDimensions } from "@/features/journey/builder/hooks/use-node-dimensions";
import { useProcessedEdges } from "@/features/journey/builder/hooks/use-processed-edges";
import { useProcessedNodes } from "@/features/journey/builder/hooks/use-processed-nodes";
import { NodeWrapper as CustomNode } from "@/features/nodes/journey/components/node-wrapper";
import { nodeRegistry } from "@/features/nodes/journey/registry/node-registry";
import { CustomEdge, CustomSmoothStepEdge, CustomStepEdge, CustomStraightEdge } from "@/features/nodes/journey/edges/custom-edge";
import { EdgeEditor } from "@/features/nodes/journey/editors/edge-editor";
import type { JourneyEdge, JourneyNode, NodeType } from "@/features/nodes/journey/react-flow-types";
import { pluginCompatibilityRegistry } from "@journey/schemas";
import { ManagedEdgeId } from "@/features/nodes/journey/utils/edge-identity";
import { pluginRegistry } from "@/features/nodes/journey/plugins";
import { buildPluginNodesForJourney } from "@/features/nodes/journey/plugins/utils/derive-plugin-nodes";
import { useSimulatorPath } from "@/features/journey/simulator/hooks/use-simulator-path";
import { AutoLayoutPanel } from "@/shared/components/ui/auto-layout-panel";
import { NodeSelectorPanel, type NodeSelectorItem, type NodeSelectorSection } from "@/shared/components/ui/node-selector-panel";
import { appConfig } from "@/shared/lib/app-config";
import { useDebouncedLayoutPreview } from "@/shared/hooks/use-debounced-layout-preview";
import { DEFAULT_LAYOUT_OPTIONS } from "@/shared/lib/ui/layout";
import { journeyNodesActions, journeyNodesStore } from "@/stores/journey-nodes-store";
import { copySelectedNode, duplicateSelectedNode, pasteNode } from "@/stores/store-actions";
import { uiActions, uiStore, type EdgeConnectionStyle } from "@/stores/ui-store";
import { NodeEditorPanel } from "./node-editor-panel";

// Map EdgeConnectionStyle to ConnectionLineType
const connectionLineTypeMap: Record<EdgeConnectionStyle, ConnectionLineType> = {
  default: ConnectionLineType.Bezier,
  straight: ConnectionLineType.Straight,
  step: ConnectionLineType.Step,
  smoothstep: ConnectionLineType.SmoothStep,
};

// Note: Plugins are rendered as addons inside their parent nodes (not as separate React Flow nodes)

const nodeTypes = {
  custom: CustomNode,
} as const;

const edgeTypes = {
  default: CustomEdge,
  straight: CustomStraightEdge,
  step: CustomStepEdge,
  smoothstep: CustomSmoothStepEdge,
} as const;

/**
 * JourneyCanvas Props - Minimal interface after context refactoring.
 *
 * All editor state, interactions, and actions are now provided via useCanvasContext().
 */
interface JourneyCanvasProps {
  /** Node data to render */
  nodes: JourneyNode[];
  /** Edge data to render */
  edges: JourneyEdge[];
  /** Whether sidebar is open (for layout adjustments) */
  sidebarOpen?: boolean;
  /** Callback when node editor should close */
  onCloseNodeEditor?: () => void;
}

// Inner component that can use useReactFlow since it's wrapped by ReactFlowProvider
function JourneyCanvasInner({ nodes, edges, sidebarOpen = false, onCloseNodeEditor }: JourneyCanvasProps) {
  // Derive plugin nodes from embedded node.data.plugins for edge source transformation
  const pluginNodes = useMemo(() => buildPluginNodesForJourney(nodes), [nodes]);

  // Get state, interactions, and actions from context
  const { state, simulator, interactions, actions } = useCanvasContext();
  const { isEditMode, isSimulatorMode, selectedNodeForEdit } = state;
  const { currentNodeId: currentTestNodeId, isActive: isSimulatorActive } = simulator;

  // Map registry nodes to sections format
  const nodeSelectorSections = useMemo<NodeSelectorSection[]>(() => {
    // Nodes section - from registry
    const nodeItems: NodeSelectorItem[] = nodeRegistry
      .getAll()
      .filter((node) => !appConfig.canvas.excludedNodeTypes.includes(node.type))
      .map((node) => ({
        type: node.type,
        label: node.displayName,
        icon: node.icon,
        iconColorClass: node.colors.icon,
      }));

    // Plugins section (drag-and-drop enabled)
    const pluginItems: NodeSelectorItem[] = pluginRegistry
      .getAll()
      .filter((descriptor) =>
        selectedNodeForEdit
          ? pluginCompatibilityRegistry.isCompatible(descriptor.pluginType, selectedNodeForEdit.data.type)
          : true
      )
      .map((descriptor) => ({
        type: `plugin-${descriptor.pluginType}`,
        label: descriptor.displayName,
        icon: descriptor.icon,
        iconColorClass: descriptor.colors.icon,
        // No onClick = draggable. Drop handling is in base-node.tsx
      }));

    return [
      { title: "Nodes", items: nodeItems },
      { title: "Plugins", items: pluginItems },
    ];
  }, [selectedNodeForEdit]);

  // Local state for selected edge (bypasses broken TanStack Store subscription)
  const [localSelectedEdge, setLocalSelectedEdge] = useState<JourneyEdge | null>(null);

  // Track selected edge ID separately from the full edge object
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Use React Flow's selection change hook for reliable edge selection tracking
  useOnSelectionChange({
    onChange: ({ edges: selectedEdges }) => {
      if (selectedEdges.length > 0 && isEditMode) {
        setSelectedEdgeId(selectedEdges[0].id);
        // Clear node selection when edge is selected
        uiActions.setSelectedNode(null);
      } else if (selectedEdges.length === 0) {
        setSelectedEdgeId(null);
      }
    },
  });

  // Derive localSelectedEdge from edges prop and selectedEdgeId
  // This ensures the edge data stays in sync after saves
  useEffect(() => {
    if (selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      setLocalSelectedEdge(edge ?? null);
    } else {
      setLocalSelectedEdge(null);
    }
  }, [selectedEdgeId, edges]);

  // Ensure editors are mutually exclusive: clear edge selection when node is selected
  // This catches all paths that select nodes (handleNodeClick, selectPluginWithNode, etc.)
  useEffect(() => {
    if (selectedNodeForEdit) {
      setSelectedEdgeId(null);
    }
  }, [selectedNodeForEdit]);

  // Check if selected edge is editable (not managed)
  const isEdgeEditable = localSelectedEdge ? !ManagedEdgeId.is(localSelectedEdge.id) : false;

  const [reactFlowNodes, setReactFlowNodes, onNodesChangeInternal] = useNodesState<JourneyNode>(nodes);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChangeInternal] = useEdgesState(edges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Get edge connection style and animation settings from UI store (combined selector)
  const { edgeConnectionStyle, edgeAnimationsEnabled, selectedPluginId } = useStore(uiStore, (state) => ({
    edgeConnectionStyle: state.edgeConnectionStyle,
    edgeAnimationsEnabled: state.edgeAnimations,
    selectedPluginId: state.selectedPluginId,
  }));
  const connectionLineType = connectionLineTypeMap[edgeConnectionStyle];

  // Get auto layout panel state from journey nodes store
  const autoLayoutPanelOpen = useStore(journeyNodesStore, (s) => s.autoLayoutPanelOpen);
  const layoutSettings = useStore(journeyNodesStore, (s) => s.layoutSettings);

  // Get node dimensions for ELK layout (uses actual measured sizes from React Flow)
  const { getAllDimensions } = useNodeDimensions();

  // Debounced layout preview and apply handlers
  const { handlePreviewLayout, handleApplyLayout } = useDebouncedLayoutPreview({
    getAllDimensions,
    nodes,
    previewLayoutAsync: journeyNodesActions.previewLayoutAsync,
    commitLayoutAsync: async (options, dimensions) => {
      await journeyNodesActions.previewLayoutAsync(options, dimensions);
      journeyNodesActions.commitLayoutPreview(options);
    },
  });

  // Get simulator path for visualization during simulator mode
  const simulatorPath = useSimulatorPath(edges);

  // Handle plugin deletion (for keyboard shortcut)
  const handleDeletePlugin = useCallback((pluginId: string) => {
    journeyNodesActions.deletePlugin(pluginId);
    uiActions.clearPluginSelection();
  }, []);

  // Keyboard shortcuts (Undo/Redo/Delete/Copy/Paste/Duplicate)
  useCanvasKeyboardShortcuts({
    isEditMode,
    selectedNodeId: selectedNodeForEdit?.id || null,
    selectedPluginId,
    onUndo: actions.undo,
    onRedo: actions.redo,
    onDeleteNode: actions.deleteNode,
    onDeletePlugin: handleDeletePlugin,
    onCopyNode: copySelectedNode,
    onPasteNode: pasteNode,
    onDuplicateNode: duplicateSelectedNode,
  });

  // Handle drag over to allow drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop to add new node at drop position
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!isEditMode) return;

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      // Plugin drops are handled by nodes (base-node.tsx), not canvas
      if (type.startsWith("plugin-")) return;

      // Convert screen position to flow position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      actions.addNode(type as NodeType, position);
    },
    [isEditMode, actions, screenToFlowPosition]
  );

  // Transform nodes with simulator state (extracted to hook)
  const processedNodes = useProcessedNodes(nodes, {
    currentTestNodeId,
    isSimulatorMode,
    isSimulatorActive,
    simulatorPath,
  });

  // Handler for edge selection when clicking on edge label
  const onSelectEdge = useCallback(
    (edgeId: string) => {
      if (!isEditMode) return;
      setSelectedEdgeId(edgeId);
      uiActions.setSelectedNode(null);

      // Update React Flow's selection state so edge gets highlighted
      // This syncs label clicks with React Flow's internal selection
      setReactFlowEdges((edges) =>
        edges.map((edge) => ({
          ...edge,
          selected: edge.id === edgeId,
        }))
      );
    },
    [isEditMode, setReactFlowEdges]
  );

  // Transform edges with styling and interactions (extracted to hook)
  const processedEdges = useProcessedEdges(edges, {
    pluginNodes,
    isEditMode,
    edgeConnectionStyle,
    edgeAnimationsEnabled,
    isSimulatorActive,
    simulatorPath,
    onDeleteEdge: actions.deleteEdge,
    onSelectEdge,
  });

  // Sync ReactFlow with external nodes/edges
  // Use a ref to prevent unnecessary updates when React Flow's internal state changes
  useEffect(() => {
    setReactFlowNodes(processedNodes);
  }, [processedNodes, setReactFlowNodes]);

  useEffect(() => {
    setReactFlowEdges(processedEdges);
  }, [processedEdges, setReactFlowEdges]);

  // Combine internal and external change handlers
  // These handlers are stable and memoized to prevent unnecessary re-renders
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeInternal>[0]) => {
      onNodesChangeInternal(changes);
      // Cast to JourneyNode changes - position updates work identically for all node types
      interactions.onNodesChange(changes as NodeChange<JourneyNode>[]);
    },
    [onNodesChangeInternal, interactions]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeInternal>[0]) => {
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal]
  );

  // Wrap node click to clear edge selection
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: JourneyNode) => {
      setSelectedEdgeId(null);
      interactions.onNodeClick(event, node);
    },
    [interactions]
  );

  // Wrap pane click to clear edge selection
  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    interactions.onPaneClick();
  }, [interactions]);

  return (
    <div ref={reactFlowWrapper} className="h-full w-full min-h-0 overflow-hidden overscroll-none">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={interactions.onNodeDoubleClick}
        onEdgeClick={isEditMode ? interactions.onEdgeClick : undefined}
        onPaneClick={handlePaneClick}
        onConnect={isEditMode ? interactions.onConnect : undefined}
        onReconnectStart={isEditMode ? interactions.onReconnectStart : undefined}
        onReconnect={isEditMode ? interactions.onReconnect : undefined}
        onReconnectEnd={isEditMode ? interactions.onReconnectEnd : undefined}
        onNodeDragStart={isEditMode ? actions.onNodeDragStart : undefined}
        onNodeDragStop={isEditMode ? actions.onNodeDragStop : undefined}
        onDrop={onDrop}
        onDragOver={onDragOver}
        connectionLineType={connectionLineType}
        fitView
        className="bg-background"
        minZoom={REACT_FLOW_CONFIG.minZoom}
        deleteKeyCode={null} // We handle delete ourselves in the keyboard handler
        edgesFocusable={isEditMode}
      >
        <Background color="currentColor" className="text-muted-foreground/20" gap={REACT_FLOW_CONFIG.backgroundGap} size={1} />
        <Controls />
        <NodeSelectorPanel sections={nodeSelectorSections} dataTransferType="application/reactflow" readOnly={!isEditMode || isSimulatorMode} />
        <AutoLayoutPanel
          isOpen={autoLayoutPanelOpen}
          onClose={() => journeyNodesActions.closeAutoLayoutPanel()}
          initialOptions={layoutSettings ?? undefined}
          defaultOptions={DEFAULT_LAYOUT_OPTIONS}
          onStartPreview={() => journeyNodesActions.startLayoutPreview()}
          onPreview={handlePreviewLayout}
          onCancelPreview={() => journeyNodesActions.cancelLayoutPreview()}
          onApply={handleApplyLayout}
          readOnly={!isEditMode}
          className="top-[15px] left-[252px]"
        />
        {selectedNodeForEdit && onCloseNodeEditor && (
          <NodeEditorPanel
            node={selectedNodeForEdit}
            onClose={onCloseNodeEditor}
            onDelete={isEditMode ? () => actions.deleteNode(selectedNodeForEdit.id) : undefined}
            readOnly={!isEditMode}
            sidebarOpen={sidebarOpen}
          />
        )}
        {appConfig.canvas.edgeEditable && localSelectedEdge && isEdgeEditable && (
          <EdgeEditor edge={localSelectedEdge} readOnly={!isEditMode} onClose={() => setSelectedEdgeId(null)} />
        )}
      </ReactFlow>
    </div>
  );
}

// Wrapper component that provides the ReactFlowProvider
export function JourneyCanvas(props: JourneyCanvasProps) {
  return (
    <ReactFlowProvider>
      <JourneyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
