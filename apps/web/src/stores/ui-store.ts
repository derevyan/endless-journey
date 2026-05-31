/**
 * UI Store
 *
 * Purpose: Manages all UI state for the journey editor and application
 *
 * Responsibilities:
 * - UI mode (edit, simulator) - simple 2-mode toggle
 * - Node/edge selection state
 * - Pending changes tracking
 * - Dialog state (new journey dialog)
 * - Panel visibility (history panel)
 * - Edge connection style preference (global, persisted to localStorage)
 *
 * Mode Behavior:
 * - UIMode is a simple enum: "edit" | "simulator"
 * - Edit mode is the default for building journeys
 * - Simulator mode is for testing journeys
 *
 * Boundaries:
 * - Does NOT manage journey data (see journey-nodes-store)
 * - Does NOT manage version history (see version-store)
 * - Focuses only on UI presentation and editor state
 */
import type { JourneyEdge, JourneyNode, JourneyStepData } from "@/features/nodes/journey/react-flow-types";
import { appConfig } from "@/shared/lib/app-config";
import type { JourneyValidationResult } from "@journey/schemas";
import { Store } from "@tanstack/react-store";

/**
 * UI Mode - Simple 2-mode toggle for journey builder.
 *
 * - "edit": Building/editing journey nodes and edges (default)
 * - "simulator": Testing the journey with simulated interactions
 */
export type UIMode = "edit" | "simulator";

// Edge connection style types supported by React Flow
export type EdgeConnectionStyle = "default" | "straight" | "step" | "smoothstep";

// localStorage keys for persisting settings
// Version 2: Global setting (not per-journey)
const EDGE_STYLE_STORAGE_KEY = "journey-edge-style-v2";
// Version 2: Changed default from true to false (performance fix)
const EDGE_ANIMATIONS_STORAGE_KEY = "journey-edge-animations-v2";

// Helper to get stored edge animations setting from localStorage
function getStoredEdgeAnimations(): boolean {
  try {
    const stored = localStorage.getItem(EDGE_ANIMATIONS_STORAGE_KEY);
    return stored !== null ? JSON.parse(stored) : appConfig.canvas.edgeAnimations;
  } catch {
    return appConfig.canvas.edgeAnimations;
  }
}

// Helper to save edge animations setting
function saveEdgeAnimations(enabled: boolean) {
  try {
    localStorage.setItem(EDGE_ANIMATIONS_STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Helper to get stored edge style from localStorage (global setting)
function getStoredEdgeStyle(): EdgeConnectionStyle {
  try {
    const stored = localStorage.getItem(EDGE_STYLE_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as EdgeConnectionStyle) : appConfig.canvas.defaultEdgeStyle;
  } catch {
    return appConfig.canvas.defaultEdgeStyle;
  }
}

// Helper to save edge style globally
function saveEdgeStyle(style: EdgeConnectionStyle) {
  try {
    localStorage.setItem(EDGE_STYLE_STORAGE_KEY, JSON.stringify(style));
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Clipboard state for node copy/paste
interface ClipboardState {
  nodeData: JourneyStepData;
  copiedAt: number;
}

interface UIStoreState {
  // Application mode (simple 2-mode toggle: edit/simulator)
  mode: UIMode;

  /**
   * UI-level dirty indicator for browser beforeunload warning.
   *
   * This is updated via storeEventBus events (node:added, edge:updated, etc.)
   * and provides a simple boolean for UI display purposes.
   *
   * NOTE: save-manager-store tracks granular dirty state (formDirtyMap for
   * per-editor forms, journeyDirty for canvas changes). This boolean is
   * intentionally separate - ui-store reacts to events for display,
   * save-manager tracks authoritative save state.
   *
   * @see save-manager-store.ts for authoritative dirty tracking
   */
  pendingChanges: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  // Plugin selection (for editing plugin addons within a node)
  selectedPluginId: string | null;

  // Clipboard for node copy/paste
  clipboard: ClipboardState | null;

  // Canvas settings (global, persisted to localStorage)
  edgeConnectionStyle: EdgeConnectionStyle;
  edgeAnimations: boolean; // Enable/disable edge animations (can cause high CPU usage)

  // Panels
  showHistory: boolean;
  showConsole: boolean;

  // New journey dialog
  isNewJourneyDialogOpen: boolean;
  newJourneyName: string;
  newJourneyDescription: string;
  newJourneyDefaultPipelineId: string | null;

  // Journey settings dialog (self-managed)
  journeySettingsDialogOpen: boolean;

  // New definition dialog (self-managed)
  isNewDefinitionDialogOpen: boolean;
  newDefinitionName: string;
  newDefinitionKey: string;
  newDefinitionDescription: string;
  newDefinitionSelectedJourneyIds: string[];

  // Validation dialog (self-managed)
  validationDialog: {
    open: boolean;
    validation: JourneyValidationResult | null;
    title: string;
    proceedLabel: string;
  };
}

const initialState: UIStoreState = {
  // Application mode (edit is default)
  mode: "edit",
  pendingChanges: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  // Plugin selection (for editing plugin addons within a node)
  selectedPluginId: null,

  // Clipboard for node copy/paste
  clipboard: null,

  // Canvas settings (global, persisted to localStorage)
  edgeConnectionStyle: getStoredEdgeStyle(),
  edgeAnimations: getStoredEdgeAnimations(),

  // Panels
  showHistory: false,
  showConsole: true,

  // New journey dialog
  isNewJourneyDialogOpen: false,
  newJourneyName: "New Journey",
  newJourneyDescription: "Create your own journey description",
  newJourneyDefaultPipelineId: null,

  // Journey settings dialog
  journeySettingsDialogOpen: false,

  // New definition dialog
  isNewDefinitionDialogOpen: false,
  newDefinitionName: "",
  newDefinitionKey: "",
  newDefinitionDescription: "",
  newDefinitionSelectedJourneyIds: [],

  // Validation dialog
  validationDialog: {
    open: false,
    validation: null,
    title: "Journey Has Issues",
    proceedLabel: "Save Anyway",
  },
};

// =============================================================================
// STORE SINGLETON (HMR-safe)
// =============================================================================
// Use global variable to ensure store instance survives Vite HMR reloads.
// Without this, HMR creates new store instances while React components
// remain subscribed to old instances, breaking reactivity.

declare global {
   
  var __journeyUiStore: Store<UIStoreState> | undefined;
}

function getOrCreateStore(): Store<UIStoreState> {
  if (typeof globalThis.__journeyUiStore !== "undefined") {
    return globalThis.__journeyUiStore;
  }
  const store = new Store(initialState);
  if (import.meta.env.DEV) {
    globalThis.__journeyUiStore = store;
  }
  return store;
}

export const uiStore = getOrCreateStore();

/**
 * Selectors for derived state values.
 * Use these with useStore() for reactive subscriptions:
 *
 * @example
 * const isEditMode = useStore(uiStore, uiSelectors.isEditMode);
 */
export const uiSelectors = {
  /** Check if currently in edit mode */
  isEditMode: (state: UIStoreState) => state.mode === "edit",
  /** Check if currently in simulator mode */
  isSimulatorActive: (state: UIStoreState) => state.mode === "simulator",
  /** Check if there are pending unsaved changes */
  hasPendingChanges: (state: UIStoreState) => state.pendingChanges,
};

// Actions
export const uiActions = {
  /**
   * Set the application mode.
   * Clears node/edge/plugin selection when entering or exiting simulator mode.
   */
  setMode: (newMode: UIMode) => {
    uiStore.setState((state) => {
      const enteringSimulator = newMode === "simulator";
      const exitingSimulator = state.mode === "simulator" && newMode === "edit";
      const shouldClearSelections = enteringSimulator || exitingSimulator;

      return {
        ...state,
        mode: newMode,
        // Clear selections when entering simulator or returning to edit from simulator
        selectedNodeId: shouldClearSelections ? null : state.selectedNodeId,
        selectedEdgeId: shouldClearSelections ? null : state.selectedEdgeId,
        selectedPluginId: shouldClearSelections ? null : state.selectedPluginId,
      };
    });
  },

  // Selection actions
  setSelectedNode: (node: JourneyNode | null) => {
    uiStore.setState((state) => {
      const nodeId = node?.id || null;
      return {
        ...state,
        selectedNodeId: nodeId,
        selectedEdgeId: null,
        // Clear plugin selection when selecting a different node
        selectedPluginId: null,
      };
    });
  },

  setSelectedEdge: (edge: JourneyEdge | null) => {
    uiStore.setState((state) => ({
      ...state,
      selectedEdgeId: edge?.id || null,
      selectedNodeId: edge ? null : state.selectedNodeId,
    }));
  },

  clearSelection: () => {
    uiStore.setState((state) => ({
      ...state,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedPluginId: null,
    }));
  },

  // Plugin selection actions (for editing plugin addons)
  setSelectedPlugin: (pluginId: string | null) => {
    uiStore.setState((state) => ({
      ...state,
      selectedPluginId: pluginId,
      // Keep the parent node selected when selecting a plugin
      selectedEdgeId: null,
    }));
  },

  clearPluginSelection: () => {
    uiStore.setState((state) => ({
      ...state,
      selectedPluginId: null,
    }));
  },

  /**
   * Select a plugin and ensure its parent node is also selected.
   * Unlike using setSelectedNode + setSelectedPlugin separately,
   * this performs an atomic update that doesn't clear the plugin selection.
   */
  selectPluginWithNode: (pluginId: string, parentNodeId: string) => {
    uiStore.setState((state) => ({
      ...state,
      selectedNodeId: parentNodeId,
      selectedEdgeId: null,
      selectedPluginId: pluginId,
    }));
  },

  // Clipboard actions for node copy/paste
  copyNodeToClipboard: (node: JourneyNode) => {
    uiStore.setState((state) => ({
      ...state,
      clipboard: {
        nodeData: structuredClone(node.data),
        copiedAt: Date.now(),
      },
    }));
  },

  clearClipboard: () => {
    uiStore.setState((state) => ({
      ...state,
      clipboard: null,
    }));
  },

  // Pending changes actions
  setPendingChanges: (hasChanges: boolean) => {
    uiStore.setState((state) => ({
      ...state,
      pendingChanges: hasChanges,
    }));
  },

  // History panel actions
  openHistory: () => {
    uiStore.setState((state) => ({
      ...state,
      showHistory: true,
    }));
  },

  closeHistory: () => {
    uiStore.setState((state) => ({
      ...state,
      showHistory: false,
    }));
  },

  // Console panel actions
  toggleConsole: () => {
    uiStore.setState((state) => ({
      ...state,
      showConsole: !state.showConsole,
    }));
  },

  setShowConsole: (show: boolean) => {
    uiStore.setState((state) => ({
      ...state,
      showConsole: show,
    }));
  },

  // New journey dialog actions
  openNewJourneyDialog: () => {
    uiStore.setState((state) => ({
      ...state,
      isNewJourneyDialogOpen: true,
    }));
  },

  closeNewJourneyDialog: () => {
    uiStore.setState((state) => ({
      ...state,
      isNewJourneyDialogOpen: false,
    }));
  },

  setJourneyName: (name: string) => {
    uiStore.setState((state) => ({
      ...state,
      newJourneyName: name,
    }));
  },

  setJourneyDescription: (desc: string) => {
    uiStore.setState((state) => ({
      ...state,
      newJourneyDescription: desc,
    }));
  },

  setJourneyDefaultPipelineId: (pipelineId: string | null) => {
    uiStore.setState((state) => ({
      ...state,
      newJourneyDefaultPipelineId: pipelineId,
    }));
  },

  resetNewJourneyDialog: () => {
    uiStore.setState((state) => ({
      ...state,
      isNewJourneyDialogOpen: false,
      newJourneyName: "New Journey",
      newJourneyDescription: "Create your own journey description",
      newJourneyDefaultPipelineId: null,
    }));
  },

  // Journey settings dialog actions (self-managed)
  openJourneySettings: () => {
    uiStore.setState((state) => ({
      ...state,
      journeySettingsDialogOpen: true,
    }));
  },

  closeJourneySettings: () => {
    uiStore.setState((state) => ({
      ...state,
      journeySettingsDialogOpen: false,
    }));
  },

  // New definition dialog actions (self-managed)
  openNewDefinitionDialog: () => {
    uiStore.setState((state) => ({
      ...state,
      isNewDefinitionDialogOpen: true,
    }));
  },

  setDefinitionName: (name: string) => {
    uiStore.setState((state) => ({
      ...state,
      newDefinitionName: name,
    }));
  },

  setDefinitionKey: (key: string) => {
    uiStore.setState((state) => ({
      ...state,
      newDefinitionKey: key,
    }));
  },

  setDefinitionDescription: (desc: string) => {
    uiStore.setState((state) => ({
      ...state,
      newDefinitionDescription: desc,
    }));
  },

  toggleDefinitionJourney: (journeyId: string) => {
    uiStore.setState((state) => ({
      ...state,
      newDefinitionSelectedJourneyIds: state.newDefinitionSelectedJourneyIds.includes(journeyId)
        ? state.newDefinitionSelectedJourneyIds.filter((id) => id !== journeyId)
        : [...state.newDefinitionSelectedJourneyIds, journeyId],
    }));
  },

  resetNewDefinitionDialog: () => {
    uiStore.setState((state) => ({
      ...state,
      isNewDefinitionDialogOpen: false,
      newDefinitionName: "",
      newDefinitionKey: "",
      newDefinitionDescription: "",
      newDefinitionSelectedJourneyIds: [],
    }));
  },

  // Edge connection style actions (global setting)
  setEdgeConnectionStyle: (style: EdgeConnectionStyle) => {
    saveEdgeStyle(style);
    uiStore.setState((state) => ({
      ...state,
      edgeConnectionStyle: style,
    }));
  },

  // Edge animations toggle (global setting)
  setEdgeAnimations: (enabled: boolean) => {
    saveEdgeAnimations(enabled);
    uiStore.setState((state) => ({
      ...state,
      edgeAnimations: enabled,
    }));
  },

  // Validation dialog actions (self-managed)
  showValidationDialog: (validation: JourneyValidationResult, options?: { title?: string; proceedLabel?: string }) => {
    uiStore.setState((state) => ({
      ...state,
      validationDialog: {
        open: true,
        validation,
        title: options?.title ?? (validation.valid ? "Journey Has Warnings" : "Journey Has Errors"),
        proceedLabel: options?.proceedLabel ?? "Publish Anyway",
      },
    }));
  },

  hideValidationDialog: () => {
    uiStore.setState((state) => ({
      ...state,
      validationDialog: {
        ...state.validationDialog,
        open: false,
      },
    }));
  },

  /**
   * Reset store to initial state (used on logout/user change)
   */
  reset: () => {
    uiStore.setState(() => initialState);
  },
};

// =============================================================================
// EVENT BUS SUBSCRIPTIONS (with cleanup for HMR)
// =============================================================================

import { storeEventBus } from "./store-event-bus";

/**
 * Store subscription cleanup functions for HMR and testing.
 * Captures unsubscribe functions to prevent memory leaks during hot module replacement.
 */
const uiStoreCleanupFunctions: (() => void)[] = [];

/**
 * Setup store event subscriptions.
 * Wrapped in a function to allow re-initialization after HMR cleanup.
 */
function setupUiStoreSubscriptions(): void {
  // Clear any existing subscriptions first (HMR safety)
  cleanupUiStoreSubscriptions();

  // Auto-clear selection when selected node is deleted
  uiStoreCleanupFunctions.push(
    storeEventBus.on("node:deleted", (event) => {
      if (uiStore.state.selectedNodeId === event.payload.nodeId) {
        uiActions.clearSelection();
      }
    })
  );

  // Auto-clear selection when selected edge is deleted
  uiStoreCleanupFunctions.push(
    storeEventBus.on("edge:deleted", (event) => {
      if (uiStore.state.selectedEdgeId === event.payload.edgeId) {
        uiActions.clearSelection();
      }
    })
  );

  // Auto-clear selection when selected plugin is deleted
  uiStoreCleanupFunctions.push(
    storeEventBus.on("plugin:deleted", (event) => {
      if (uiStore.state.selectedPluginId === event.payload.pluginId) {
        uiActions.clearSelection();
      }
    })
  );

  // Auto-track pending changes when any data changes
  uiStoreCleanupFunctions.push(
    storeEventBus.onMany(
      [
        "web:node:added",
        "node:updated",
        "node:deleted",
        "web:edge:added",
        "edge:updated",
        "edge:deleted",
        "plugin:added",
        "plugin:updated",
        "plugin:deleted",
      ],
      () => {
        uiActions.setPendingChanges(true);
      }
    )
  );

  // Listen for save-manager's authoritative dirty state changes
  // This ensures ui-store stays in sync with save-manager's granular tracking
  uiStoreCleanupFunctions.push(
    storeEventBus.on("saveManager:pendingChangesUpdated", (event) => {
      uiActions.setPendingChanges(event.payload.hasAnyDirty);
    })
  );
}

/**
 * Cleanup UI store subscriptions.
 * Called during HMR disposal and can be used in tests.
 */
export function cleanupUiStoreSubscriptions(): void {
  uiStoreCleanupFunctions.forEach((fn) => fn());
  uiStoreCleanupFunctions.length = 0;
}

// Initialize subscriptions
setupUiStoreSubscriptions();

// HMR cleanup: Dispose subscriptions before module is replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupUiStoreSubscriptions();
  });
}
