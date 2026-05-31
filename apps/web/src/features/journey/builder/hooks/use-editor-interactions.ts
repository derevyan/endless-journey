import { useStore } from "@tanstack/react-store";
import type { Connection } from "@xyflow/react";
import { useCallback } from "react";
import { useEditorActionsContext } from "@/features/journey/builder/context";
import type { EdgeType, JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { EdgeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { saveManagerActions } from "@/stores/save-manager-store";
import { isButtonHandle, journeyNodesActions, setButtonTargetNode } from "@/stores/store-actions";
import { uiActions, uiSelectors, uiStore } from "@/stores/ui-store";

/**
 * useEditorInteractions - Interaction handlers for editor
 *
 * Provides click handlers and connection handlers for nodes and edges.
 */
export function useEditorInteractions() {
  const isEditMode = useStore(uiStore, uiSelectors.isEditMode);
  const { clearSelectionWithAutoSave, selectNodeWithAutoSave } = useEditorActionsContext();

  // Node interactions (with auto-save)
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: JourneyNode) => {
      // In both edit mode and view mode, set the selected node to open the editor panel
      // In edit mode: full editing capabilities
      // In view mode: read-only view (NodeEditorPanel handles readOnly prop)
      // Uses selectNodeWithAutoSave to save current editor before switching
      void selectNodeWithAutoSave(node);
    },
    [selectNodeWithAutoSave]
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: JourneyNode) => {
      if (isEditMode) {
        // Use auto-save to flush current editor before switching
        void selectNodeWithAutoSave(node);
      }
    },
    [isEditMode, selectNodeWithAutoSave]
  );

  // Edge interactions (with auto-save to flush node editor first)
  const onEdgeClick = useCallback(
    async (_event: React.MouseEvent, edge: JourneyEdge) => {
      if (isEditMode) {
        // Flush any open node editor before switching to edge
        const flushed = await saveManagerActions.flushActiveEditor();
        if (!flushed) return;

        uiActions.setSelectedEdge(edge);
        uiActions.setSelectedNode(null);
      }
    },
    [isEditMode]
  );

  const onPaneClick = useCallback(() => {
    // Clear selection with auto-save support
    // If an editor is open with dirty changes, validates and saves first
    void clearSelectionWithAutoSave();
  }, [clearSelectionWithAutoSave]);

  // Connection handlers
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isEditMode || !connection.source || !connection.target) return;

      const sourceHandle = connection.sourceHandle ?? undefined;

      // Button connections set targetNodeId directly and create managed edges
      // Managed edges are stored in journey.edges for visualization
      if (isButtonHandle(sourceHandle)) {
        setButtonTargetNode(connection.source, sourceHandle!, connection.target);
        return; // Don't create a stored edge
      }

      // Non-button connections (timer, error, output) create real stored edges
      let edgeType: EdgeType = EdgeTypeEnum.DEFAULT;
      if (connection.sourceHandle === "timer") {
        edgeType = EdgeTypeEnum.TIMER;
      } else if (connection.sourceHandle === "error") {
        edgeType = EdgeTypeEnum.RETRY; // Error edges use retry style (orange)
      }

      journeyNodesActions.addEdge(
        connection.source,
        connection.target,
        undefined,
        edgeType,
        connection.sourceHandle || undefined
      );
    },
    [isEditMode]
  );

  // Empty placeholder required by React Flow API for edge reconnection lifecycle
  const onReconnectStart = useCallback(() => {
    // No-op: React Flow requires this callback but we don't need to track reconnection start
  }, []);

  const onReconnect = useCallback(
    (oldEdge: JourneyEdge, newConnection: Connection) => {
      if (!isEditMode) return;

      // If dropped on pane (no target), delete the edge
      if (!newConnection.target) {
        journeyNodesActions.deleteEdge(oldEdge.id);
        uiActions.clearSelection();
        return;
      }

      // Otherwise, update the edge with new connection
      journeyNodesActions.updateEdge(oldEdge.id, {
        source: newConnection.source!,
        target: newConnection.target,
      });
    },
    [isEditMode]
  );

  // Empty placeholder required by React Flow API for edge reconnection lifecycle
  const onReconnectEnd = useCallback(() => {
    // No-op: React Flow requires this callback but we don't need cleanup on reconnection end
  }, []);

  return {
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onPaneClick,
    onConnect,
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
  };
}
