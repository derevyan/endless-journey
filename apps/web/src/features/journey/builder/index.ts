/**
 * Journey Builder Feature
 *
 * Complete journey editing system with canvas, node editors, and related utilities.
 *
 * Node-related code (components, editors, forms, hooks) is in @/features/nodes/journey/
 * See @/features/journey/index.ts for unified feature exports
 */

// Context providers
export { CanvasProvider, useCanvasContext, useCanvasContextOptional, type CanvasContextValue } from "./context";

// Main components
export { AppLayout } from "./components/app-layout";
export { DeactivationDialog } from "./components/deactivation-dialog";
export { JourneyCanvas } from "./components/journey-canvas";
export { JourneySelector } from "./components/journey-selector";
export { JourneySettingsDialog } from "./components/journey-settings-dialog";
export { NewJourneyDialog } from "./components/new-journey-dialog";
export { NodeEditorPanel } from "./components/node-editor-panel";

// Re-export shared components
export { NodeSelectorPanel } from "@/shared/components/ui/node-selector-panel";

// Editor hooks
// Granular selector hooks for focused state access:
// - useEditorMode() - edit mode and pending changes
// - useEditorSelection() - selected node/edge
// - useEditorJourneyData() - nodes, edges, journeyId
// - useEditorVersions() - versions and custom journeys
// Action hooks: useEditorActions(), useEditorInteractions()
export { useCanvasKeyboardShortcuts } from "./hooks/use-canvas-keyboard-shortcuts";
export { useEditorActions } from "./hooks/use-editor-actions";
export { useEditorInteractions } from "./hooks/use-editor-interactions";
export { useJourneyVisualization } from "./hooks/use-journey-visualization";
export { useEditorMode, useEditorSelection, useEditorJourneyData, useEditorVersions } from "./hooks/selectors/editor-selectors";

// Query hooks
// Re-export from shared hooks (moved to break circular dependency)
export { useJourneyConfig } from "@/hooks/queries/use-journey-config";
export { useJourneyData } from "./hooks/queries/use-journey-data";
export { useJourneyDataSync } from "./hooks/queries/use-journey-data-sync";
// Re-export from shared hooks (moved to break circular dependency)
export { useJourneyListManifest } from "@/hooks/queries/use-journey-list-manifest";

// Lib utilities - journey-specific exports
export {
  // Journey export functions
  exportVersion,
  exportJourneyAsArchive,
  importJourneyFromArchive,
  type ImportResult,
  // Journey loader functions
  loadJourneyConfig,
  listAvailableJourneys,
  // Starter journey
  STARTER_JOURNEY_CONFIG,
  STARTER_JOURNEY_METADATA,
} from "./lib";
