/**
 * MindState Header Store
 *
 * TanStack Store for mindstate builder controls in the dashboard header.
 * Follows the journey/agent header store pattern.
 *
 * @module features/dashboard/store/mindstate-header-store
 */

import { Store } from "@tanstack/react-store";

import type { MindstateStatus } from "@journey/schemas";

export interface MindstateHeaderState {
  // Definition selection (uses key for branded URLs)
  definitionKey: string | null;
  onDefinitionSelect: ((definitionKey: string) => void) | null;

  // Status
  definitionStatus: MindstateStatus | null;
  onStatusChange: ((status: MindstateStatus) => Promise<void>) | null;
  isUpdatingStatus: boolean;

  // Actions
  onSave: (() => void) | null;
  onDiscard: (() => void) | null;
  onUndo: (() => void) | null;
  onRedo: (() => void) | null;
  onClearPreview: (() => void) | null;
  onHistory: (() => void) | null;
  onSettings: (() => void) | null;

  // Sidebar controls
  sidebarOpen: boolean;
  onToggleSidebar: (() => void) | null;

  // Is the mindstate builder active?
  isActive: boolean;
}

const initialState: MindstateHeaderState = {
  definitionKey: null,
  onDefinitionSelect: null,
  definitionStatus: null,
  onStatusChange: null,
  isUpdatingStatus: false,
  onSave: null,
  onDiscard: null,
  onUndo: null,
  onRedo: null,
  onClearPreview: null,
  onHistory: null,
  onSettings: null,
  sidebarOpen: true,
  onToggleSidebar: null,
  isActive: false,
};

// =============================================================================
// STORE SINGLETON (HMR-safe)
// =============================================================================
// Use global variable to ensure store instance survives Vite HMR reloads.
// Without this, HMR creates new store instances while React components
// remain subscribed to old instances, breaking reactivity.

declare global {
   
  var __mindstateHeaderStore: ReturnType<typeof createStore> | undefined;
}

function createStore() {
  return new Store<MindstateHeaderState>(initialState);
}

function getOrCreateStore() {
  if (globalThis.__mindstateHeaderStore) {
    return globalThis.__mindstateHeaderStore;
  }
  const store = createStore();
  if (import.meta.env.DEV) {
    globalThis.__mindstateHeaderStore = store;
  }
  return store;
}

export const mindstateHeaderStore = getOrCreateStore();

export const mindstateHeaderActions = {
  setControls: (controls: Partial<MindstateHeaderState>) => {
    mindstateHeaderStore.setState((state) => ({
      ...state,
      ...controls,
      isActive: true,
    }));
  },

  setUpdatingStatus: (isUpdating: boolean) => {
    mindstateHeaderStore.setState((state) => ({
      ...state,
      isUpdatingStatus: isUpdating,
    }));
  },

  clearControls: () => {
    mindstateHeaderStore.setState(() => initialState);
  },
};
