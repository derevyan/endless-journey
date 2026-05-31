/**
 * Canvas Context
 *
 * Provides editor state, interactions, and actions to JourneyCanvas
 * and its children. Eliminates prop drilling by aggregating existing hooks.
 *
 * @module features/journey/builder/context/canvas-context
 */

import type { Connection, NodeChange } from "@xyflow/react";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useEditorMode, useEditorSelection } from "@/features/journey/builder/hooks/selectors/editor-selectors";
import { useEditorActions } from "@/features/journey/builder/hooks/use-editor-actions";
import { useEditorInteractions } from "@/features/journey/builder/hooks/use-editor-interactions";
import type { JourneyEdge, JourneyNode, NodeType } from "@/features/nodes/journey/react-flow-types";
import { useSimulatorContext } from "@/features/journey/simulator";
import { journeyNodesActions } from "@/stores/journey-nodes-store";
import { uiStore } from "@/stores/ui-store";

/**
 * Canvas context value interface.
 *
 * Organized into logical groups:
 * - state: Read-only UI and editor state
 * - simulator: Simulator state for simulator mode visualization
 * - interactions: React Flow event handlers
 * - actions: Imperative actions for modifying data
 */
export interface CanvasContextValue {
  /** UI and editor state */
  state: {
    isEditMode: boolean;
    isSimulatorMode: boolean;
    selectedNodeForEdit: JourneyNode | null;
    selectedEdgeForEdit: JourneyEdge | null;
  };

  /** Simulator state for simulator mode visualization */
  simulator: {
    currentNodeId: string | null;
    isActive: boolean;
  };

  /** React Flow interaction handlers */
  interactions: {
    onNodesChange: (changes: NodeChange<JourneyNode>[]) => void;
    onNodeClick: (event: React.MouseEvent, node: JourneyNode) => void;
    onNodeDoubleClick: (event: React.MouseEvent, node: JourneyNode) => void;
    onEdgeClick: (event: React.MouseEvent, edge: JourneyEdge) => void;
    onPaneClick: () => void;
    onConnect: (connection: Connection) => void;
    onReconnectStart: () => void;
    onReconnect: (oldEdge: JourneyEdge, newConnection: Connection) => void;
    onReconnectEnd: () => void;
  };

  /** Imperative actions */
  actions: {
    addNode: (type: NodeType, position: { x: number; y: number }) => void;
    deleteNode: (nodeId: string) => void;
    deleteEdge: (edgeId: string) => void;
    undo: () => void;
    redo: () => void;
    onNodeDragStart: () => void;
    onNodeDragStop: () => void;
    setSelectedNode: (node: JourneyNode | null) => void;
  };
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

/**
 * Props for CanvasProvider.
 */
interface CanvasProviderProps {
  children: ReactNode;
  /** Whether simulator mode is active (from parent's simulatorActive) */
  simulatorActive: boolean;
  /** Custom node click handler for simulator mode */
  onSimulatorModeNodeClick?: (event: React.MouseEvent, node: JourneyNode) => void;
  /** Custom nodes change handler */
  onNodesChange?: (changes: NodeChange<JourneyNode>[]) => void;
}

/**
 * Canvas Provider - Aggregates editor hooks into a single context.
 *
 * This provider composes existing hooks without duplicating logic:
 * - useEditorMode() / useEditorSelection() for granular editor state
 * - useEditorActions() for actions
 * - useEditorInteractions() for interaction handlers
 * - useSimulatorContext() for simulator state
 */
export function CanvasProvider({ children, simulatorActive, onSimulatorModeNodeClick, onNodesChange: customNodesChange }: CanvasProviderProps) {
  // Use granular selectors for minimal subscriptions
  const { isEditMode } = useEditorMode();
  const { selectedNode: selectedNodeForEdit, selectedEdge: selectedEdgeForEdit } = useEditorSelection();
  const { addNode, deleteNode, deleteEdge, undo, redo, setSelectedNode } = useEditorActions();
  const { onNodeClick, onNodeDoubleClick, onEdgeClick, onPaneClick, onConnect, onReconnectStart, onReconnect, onReconnectEnd } = useEditorInteractions();
  const simulator = useSimulatorContext();

  // Compose context value with memoization for performance
  const value = useMemo<CanvasContextValue>(() => {
    // Node drag handlers for undo tracking
    const onNodeDragStart = () => {
      if (isEditMode) {
        journeyNodesActions.startNodeDrag();
      }
    };

    const onNodeDragStop = () => {
      if (isEditMode) {
        journeyNodesActions.endNodeDrag();
      }
    };

    // Handle node click differently in simulator mode vs edit/view mode
    // NOTE: Check store directly to avoid stale closure when simulatorActive changes
    const handleNodeClick = (event: React.MouseEvent, node: JourneyNode) => {
      const isCurrentlyInSimulatorMode = uiStore.state.mode === "simulator";
      if (isCurrentlyInSimulatorMode && onSimulatorModeNodeClick) {
        onSimulatorModeNodeClick(event, node);
      } else {
        onNodeClick(event, node);
      }
    };

    // Handle nodes change (position updates during drag)
    const handleNodesChange = (changes: NodeChange<JourneyNode>[]) => {
      if (customNodesChange) {
        customNodesChange(changes);
      }
    };

    return {
      state: {
        isEditMode,
        isSimulatorMode: simulatorActive,
        selectedNodeForEdit,
        selectedEdgeForEdit,
      },
      simulator: {
        currentNodeId: simulator.currentSession?.currentNodeId ?? null,
        isActive: simulator.isActive,
      },
      interactions: {
        onNodesChange: handleNodesChange,
        onNodeClick: handleNodeClick,
        onNodeDoubleClick,
        onEdgeClick,
        onPaneClick,
        onConnect,
        onReconnectStart,
        onReconnect,
        onReconnectEnd,
      },
      actions: {
        addNode,
        deleteNode,
        deleteEdge,
        undo,
        redo,
        onNodeDragStart,
        onNodeDragStop,
        setSelectedNode,
      },
    };
  }, [
    isEditMode,
    simulatorActive,
    selectedNodeForEdit,
    selectedEdgeForEdit,
    simulator.currentSession?.currentNodeId,
    simulator.isActive,
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onPaneClick,
    onConnect,
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
    addNode,
    deleteNode,
    deleteEdge,
    undo,
    redo,
    setSelectedNode,
    onSimulatorModeNodeClick,
    customNodesChange,
  ]);

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

/**
 * Hook to consume canvas context.
 *
 * @throws Error if used outside CanvasProvider
 *
 * @example
 * ```tsx
 * function JourneyCanvasInner() {
 *   const { state, interactions, actions } = useCanvasContext();
 *
 *   return (
 *     <ReactFlow
 *       onNodeClick={interactions.onNodeClick}
 *       onPaneClick={interactions.onPaneClick}
 *     />
 *   );
 * }
 * ```
 */
export function useCanvasContext(): CanvasContextValue {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error("useCanvasContext must be used within a CanvasProvider");
  }
  return context;
}

/**
 * Optional hook for contexts where CanvasProvider might not be present.
 * Returns null if outside provider.
 */
export function useCanvasContextOptional(): CanvasContextValue | null {
  return useContext(CanvasContext);
}
