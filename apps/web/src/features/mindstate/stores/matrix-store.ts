/**
 * Matrix Store
 *
 * UI state for the Agent×Parameter matrix view.
 * Data is derived from builder-store - this store only manages view-specific state.
 *
 * @module mindstate/stores/matrix-store
 */

import { Store } from "@tanstack/react-store";

import { createLogger } from "@journey/logger";
import { storeEventBus } from "@/stores/store-event-bus";

const log = createLogger("matrix-store");

// =============================================================================
// TYPES
// =============================================================================

interface MatrixUIState {
  /** Currently hovered agent column */
  hoveredAgentId: string | null;
  /** Currently hovered parameter row */
  hoveredParameterId: string | null;
}

interface MatrixStoreState {
  ui: MatrixUIState;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: MatrixStoreState = {
  ui: {
    hoveredAgentId: null,
    hoveredParameterId: null,
  },
};

// =============================================================================
// HMR-SAFE STORE CREATION
// =============================================================================

declare global {
   
  var __matrixStore: Store<MatrixStoreState> | undefined;
}

function getOrCreateStore(): Store<MatrixStoreState> {
  if (typeof globalThis.__matrixStore !== "undefined") {
    return globalThis.__matrixStore;
  }
  const store = new Store<MatrixStoreState>(initialState);
  if (import.meta.env.DEV) {
    globalThis.__matrixStore = store;
  }
  return store;
}

export const matrixStore = getOrCreateStore();

// =============================================================================
// ACTIONS
// =============================================================================

export const matrixActions = {
  /**
   * Set the currently hovered agent (for column highlighting)
   */
  setHoveredAgent: (agentId: string | null) => {
    matrixStore.setState((s) => ({
      ...s,
      ui: { ...s.ui, hoveredAgentId: agentId },
    }));
  },

  /**
   * Set the currently hovered parameter (for row highlighting)
   */
  setHoveredParameter: (parameterId: string | null) => {
    matrixStore.setState((s) => ({
      ...s,
      ui: { ...s.ui, hoveredParameterId: parameterId },
    }));
  },

  /**
   * Reset store to initial state
   */
  reset: () => {
    matrixStore.setState(() => initialState);
    log.debug({}, "matrix-store:reset");
  },
};

// =============================================================================
// SELECTORS
// =============================================================================

export const matrixSelectors = {
  hoveredAgentId: (state: MatrixStoreState) => state.ui.hoveredAgentId,
  hoveredParameterId: (state: MatrixStoreState) => state.ui.hoveredParameterId,
};

// =============================================================================
// EVENT BUS SUBSCRIPTIONS (with cleanup for HMR)
// =============================================================================

const matrixStoreCleanupFunctions: (() => void)[] = [];

function setupMatrixStoreSubscriptions(): void {
  // Clear existing subscriptions (HMR safety)
  cleanupMatrixStoreSubscriptions();

  // Reset matrix store when builder is reset
  matrixStoreCleanupFunctions.push(
    storeEventBus.on("mindstate:builder:reset", () => {
      matrixActions.reset();
    })
  );

  // Also reset on logout
  matrixStoreCleanupFunctions.push(
    storeEventBus.on("user:loggedOut", () => {
      matrixActions.reset();
    })
  );
}

/**
 * Cleanup matrix store subscriptions.
 * Called during HMR disposal and can be used in tests.
 */
export function cleanupMatrixStoreSubscriptions(): void {
  matrixStoreCleanupFunctions.forEach((fn) => fn());
  matrixStoreCleanupFunctions.length = 0;
}

// Initialize subscriptions
setupMatrixStoreSubscriptions();

// HMR cleanup: Dispose subscriptions before module is replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupMatrixStoreSubscriptions();
  });
}
