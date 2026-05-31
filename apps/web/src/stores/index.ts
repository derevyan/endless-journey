/**
 * Stores
 *
 * Re-exports all TanStack stores for convenient imports.
 *
 * @module stores
 */

// Custom Journey Store (from feature)
export { customJourneyStore, customJourneyActions } from "@/features/journey/builder/store/custom-journey-store";
export type { CustomJourneyData } from "@/features/journey/builder/store/custom-journey-store";

// Journey Header Store (from feature)
export { journeyHeaderStore, journeyHeaderActions } from "@/features/dashboard/store/journey-header-store";
export type { JourneyHeaderControlsState } from "@/features/dashboard/store/journey-header-store";

// Journey Nodes Store
export { journeyNodesStore, journeyNodesActions } from "./journey-nodes-store";
export type { JourneyNodesStoreState } from "./journey-nodes-store";

// Simulator Store (from feature)
export { simulatorStore, simulatorActions } from "@/features/journey/simulator/store";
export type { PlaybackState } from "@/features/journey/simulator/store";

// UI Store
export { uiStore, uiActions } from "./ui-store";
export type { EdgeConnectionStyle } from "./ui-store";

// User Store
export { userStore, userActions, userSelectors } from "./user-store";
export type { User, UserState } from "./user-store";

// Version Store
export { versionStore, versionActions } from "./version-store";

// Builder Store (MindState)
export { builderStore, builderActions, builderSelectors } from "@/features/mindstate/stores/builder-store";
export type { BuilderStoreState, PreviewMessage, BuilderUIState, PreviewState, DefinitionHistoryEntry } from "@/features/mindstate/lib/types";

// Cross-store coordination actions
export {
  setQueryClient,
  setJourneyData,
  updateNodeWithSync,
  deleteNodeWithSync,
  updateEdgeWithSync,
  deleteEdgeWithSync,
  loadVersion,
  discardChanges,
  addNodeWithSync,
  addEdgeWithSync,
  undoWithSync,
  redoWithSync,
  createCustomJourney,
  deleteCustomJourney,
  resetAllStores,
} from "./store-actions";
