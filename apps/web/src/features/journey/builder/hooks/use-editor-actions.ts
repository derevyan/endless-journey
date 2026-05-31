import { useCallback } from "react";
import type { JourneySlug } from "@journey/schemas";
import type { JourneyConfig } from "@/features/nodes/journey/react-flow-types";
import { EdgeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { journeyNodesActions } from "@/stores/journey-nodes-store";
import {
  addEdgeWithSync,
  addNodeWithSync,
  deleteEdgeWithSync,
  deleteNodeWithSync,
  discardChanges as discardChangesSync,
  loadVersion as loadVersionSync,
  redoWithSync,
  saveVersion as saveVersionSync,
  setJourneyData as setJourneyDataSync,
  undoWithSync,
  updateEdgeWithSync,
  updateNodeWithSync,
} from "@/stores/store-actions";
import { uiActions } from "@/stores/ui-store";
import { versionActions } from "@/stores/version-store";

/**
 * useEditorActions - CRUD operations for editor
 *
 * Provides actions for creating, updating, and deleting nodes/edges.
 * For journey CRUD operations (create/delete), use useJourneyCRUD hook instead.
 */
export function useEditorActions() {
  // Compound actions that coordinate multiple stores
  // Note: setJourneySlug sets the URL slug (not UUID) for routing purposes
  const setJourneySlug = useCallback((slug: JourneySlug | null) => {
    // journey-nodes-store still uses setJourneyId internally (migration in progress)
    journeyNodesActions.setJourneyId(slug);
    versionActions.setJourneySlug(slug);
  }, []);

  const setCurrentData = useCallback((data: JourneyConfig, resetPendingChanges = true) => {
    setJourneyDataSync(data, resetPendingChanges);
  }, []);

  return {
    // Node/Edge CRUD - direct store action references (stable functions)
    setJourneySlug,
    setJourneyUuid: versionActions.setJourneyUuid,
    setNodes: journeyNodesActions.setNodes,
    setEdges: journeyNodesActions.setEdges,
    setCurrentData,
    addNode: addNodeWithSync,
    updateNode: updateNodeWithSync,
    deleteNode: deleteNodeWithSync,
    addEdge: (source: string, target: string, label?: string, edgeType = EdgeTypeEnum.DEFAULT, sourceHandle?: string) =>
      addEdgeWithSync(source, target, label, edgeType, sourceHandle),
    updateEdge: updateEdgeWithSync,
    deleteEdge: deleteEdgeWithSync,
    discardChanges: discardChangesSync,
    getCurrentData: journeyNodesActions.getCurrentData,
    undo: undoWithSync,
    redo: redoWithSync,

    // Version management
    saveCurrentVersion: saveVersionSync,
    loadVersionById: loadVersionSync,
    refreshVersions: versionActions.refreshVersions,

    // Editor UI - direct store action references
    setMode: uiActions.setMode,
    setSelectedNode: uiActions.setSelectedNode,
    setSelectedEdge: uiActions.setSelectedEdge,
    clearSelection: uiActions.clearSelection,
  };
}
