/**
 * Editor Hooks
 *
 * Re-exports all editor-related hooks for convenient imports.
 *
 * Granular selector hooks for focused state access:
 * - useEditorMode() - edit mode and pending changes (2 subscriptions)
 * - useEditorSelection() - selected node/edge (4 subscriptions)
 * - useEditorJourneyData() - nodes, edges, journeyId (3 subscriptions)
 * - useEditorVersions() - versions and custom journeys (3 subscriptions)
 *
 * Action hooks:
 * - useEditorActions() - CRUD operations
 * - useEditorInteractions() - interaction handlers
 */
export { useCanvasKeyboardShortcuts } from "./use-canvas-keyboard-shortcuts";
export { useEditorActions } from "./use-editor-actions";
export { useEditorInteractions } from "./use-editor-interactions";
export { useJourneyVisualization } from "./use-journey-visualization";
export { useProcessedEdges, type ProcessedEdgesConfig } from "./use-processed-edges";
export { useProcessedNodes, type ProcessedNodesConfig } from "./use-processed-nodes";

// Granular selector hooks for focused state access
export {
  useEditorMode,
  useEditorSelection,
  useEditorJourneyData,
  useEditorVersions,
} from "./selectors/editor-selectors";

// Note: useNodeEditorContext, useNodeEditorForm moved to @/nodes/hooks
// Note: Template form hooks moved to @/nodes/hooks/forms

// Query hooks
// Re-export from shared hooks (moved to break circular dependency)
export { useJourneyConfig } from "@/hooks/queries/use-journey-config";
export { useJourneyData } from "./queries/use-journey-data";
export { useJourneyDataSync } from "./queries/use-journey-data-sync";
// Re-export from shared hooks (moved to break circular dependency)
export { useJourneyListManifest } from "@/hooks/queries/use-journey-list-manifest";

