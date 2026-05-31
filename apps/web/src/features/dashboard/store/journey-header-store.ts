/**
 * Journey Header Store
 *
 * TanStack Store for journey-specific controls in the dashboard header.
 * This allows the Journey Builder to inject its controls into the global header.
 *
 * NOTE: This store only contains journey-specific state that can't be derived
 * from other stores. The following are accessed directly from their respective stores:
 * - isEditMode, simulatorActive, pendingChanges: from uiStore (mode, pendingChanges)
 * - canUndo, canRedo: from journeyNodesStore (undoStack.length, redoStack.length)
 * - setEditMode: use uiActions.setMode() directly
 * - onHistoryClick: use uiActions.openHistory() directly
 * - onSettingsClick: use uiActions.openJourneySettings() directly
 *
 * @module features/dashboard/store/journey-header-store
 */

import type { LayoutOptions } from "@/shared/lib/ui/layout";
import { Store } from "@tanstack/react-store";

export interface JourneyHeaderControlsState {
  // Journey selection
  selectedJourneySlug: string | null;
  selectedJourneyId: string | null;
  journeyStatus: string | null;
  journeyName: string | null;
  journeyDescription: string | null;
  journeyDefaultPipelineId: string | null;

  // Callbacks that must come from the journey page
  onJourneySelect: ((journeySlug: string) => void) | null;
  onStatusChange: ((status: string, deactivationMode?: string) => Promise<void>) | null;
  onSave: ((notes?: string) => void) | null;
  onDiscard: (() => void) | null;
  onDeleteJourney: (() => void) | null;
  onUndo: (() => void) | null;
  onRedo: (() => void) | null;
  onAutoLayout: ((options: LayoutOptions) => void) | null;

  // Sidebar controls (for header toggle button)
  sidebarOpen: boolean;
  onToggleSidebar: (() => void) | null;

  // Flags
  loading: boolean;
  canDeleteJourney: boolean;

  // Is the journey page active?
  isActive: boolean;
}

const initialState: JourneyHeaderControlsState = {
  selectedJourneySlug: null,
  selectedJourneyId: null,
  journeyStatus: null,
  journeyName: null,
  journeyDescription: null,
  journeyDefaultPipelineId: null,
  onJourneySelect: null,
  onStatusChange: null,
  onSave: null,
  onDiscard: null,
  onDeleteJourney: null,
  onUndo: null,
  onRedo: null,
  onAutoLayout: null,
  sidebarOpen: true,
  onToggleSidebar: null,
  loading: false,
  canDeleteJourney: false,
  isActive: false,
};

// HMR Safety - Singleton pattern prevents stale subscriptions during hot reload
declare global {
  var __journeyHeaderStore: ReturnType<typeof createStore> | undefined;
}

function createStore() {
  return new Store<JourneyHeaderControlsState>(initialState);
}

function getOrCreateStore() {
  if (globalThis.__journeyHeaderStore) {
    return globalThis.__journeyHeaderStore;
  }
  const store = createStore();
  if (import.meta.env.DEV) {
    globalThis.__journeyHeaderStore = store;
  }
  return store;
}

export const journeyHeaderStore = getOrCreateStore();

// Actions to update the store
export const journeyHeaderActions = {
  setControls: (controls: Partial<JourneyHeaderControlsState>) => {
    journeyHeaderStore.setState((state) => ({
      ...state,
      ...controls,
      isActive: true,
    }));
  },

  clearControls: () => {
    journeyHeaderStore.setState(() => initialState);
  },
};
