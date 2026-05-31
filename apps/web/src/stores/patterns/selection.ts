/**
 * Selection Pattern
 *
 * Composable selection capability for stores. Manages node and edge
 * selection state with mutual exclusivity (selecting a node clears edge selection).
 *
 * @module stores/patterns/selection
 */

import type { Store } from "@tanstack/react-store";
import { storeEventBus } from "../store-event-bus";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Selection state structure to be included in store state.
 */
export interface SelectionState {
  /** Currently selected node ID, or null */
  selectedNodeId: string | null;
  /** Currently selected edge ID, or null */
  selectedEdgeId: string | null;
}

/**
 * Selection capability interface returned by createSelectionCapability.
 */
export interface SelectionCapability {
  /** Select a node (clears edge selection) */
  selectNode: (nodeId: string | null) => void;
  /** Select an edge (clears node selection) */
  selectEdge: (edgeId: string | null) => void;
  /** Clear all selection */
  clearSelection: () => void;
  /** Get selected node ID */
  getSelectedNodeId: () => string | null;
  /** Get selected edge ID */
  getSelectedEdgeId: () => string | null;
  /** Check if anything is selected */
  hasSelection: () => boolean;
  /** Check if a specific node is selected */
  isNodeSelected: (nodeId: string) => boolean;
  /** Check if a specific edge is selected */
  isEdgeSelected: (edgeId: string) => boolean;
}

/**
 * Options for creating selection capability.
 */
export interface SelectionOptions {
  /** Emit events via store event bus. Default: true */
  emitEvents?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selection: { nodeId: string | null; edgeId: string | null }) => void;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create selection capability for a store.
 *
 * This is a composable pattern that adds node/edge selection with mutual
 * exclusivity. When a node is selected, edge selection is cleared, and vice versa.
 *
 * @param store - TanStack Store instance
 * @param options - Configuration options
 * @returns Selection capability object
 *
 * @example
 * ```typescript
 * // In your store file
 * interface MyState {
 *   nodes: Node[];
 *   edges: Edge[];
 *   selectedNodeId: string | null;
 *   selectedEdgeId: string | null;
 * }
 *
 * const store = new Store<MyState>({
 *   nodes: [],
 *   edges: [],
 *   selectedNodeId: null,
 *   selectedEdgeId: null,
 * });
 *
 * const selection = createSelectionCapability(store);
 *
 * // Use in actions
 * export const actions = {
 *   selectNode: selection.selectNode,
 *   selectEdge: selection.selectEdge,
 *   clearSelection: selection.clearSelection,
 * };
 *
 * // In components
 * const selectedNodeId = useStore(store, (s) => s.selectedNodeId);
 * ```
 */
export function createSelectionCapability<TState extends SelectionState>(
  store: Store<TState>,
  options: SelectionOptions = {}
): SelectionCapability {
  const { emitEvents = true, onSelectionChange } = options;

  // Helper to notify selection change
  const notifyChange = (nodeId: string | null, edgeId: string | null) => {
    onSelectionChange?.({ nodeId, edgeId });
  };

  return {
    selectNode: (nodeId: string | null) => {
      store.setState((s) => ({
        ...s,
        selectedNodeId: nodeId,
        selectedEdgeId: null, // Clear edge selection
      }));

      if (emitEvents && nodeId) {
        storeEventBus.emit({
          type: "selection:node",
          payload: { nodeId },
        });
      }

      notifyChange(nodeId, null);
    },

    selectEdge: (edgeId: string | null) => {
      store.setState((s) => ({
        ...s,
        selectedNodeId: null, // Clear node selection
        selectedEdgeId: edgeId,
      }));

      if (emitEvents && edgeId) {
        storeEventBus.emit({
          type: "selection:edge",
          payload: { edgeId },
        });
      }

      notifyChange(null, edgeId);
    },

    clearSelection: () => {
      const hadSelection =
        store.state.selectedNodeId !== null || store.state.selectedEdgeId !== null;

      store.setState((s) => ({
        ...s,
        selectedNodeId: null,
        selectedEdgeId: null,
      }));

      if (emitEvents && hadSelection) {
        storeEventBus.emit({
          type: "selection:cleared",
          payload: {},
        });
      }

      notifyChange(null, null);
    },

    getSelectedNodeId: () => store.state.selectedNodeId,
    getSelectedEdgeId: () => store.state.selectedEdgeId,

    hasSelection: () =>
      store.state.selectedNodeId !== null || store.state.selectedEdgeId !== null,

    isNodeSelected: (nodeId: string) => store.state.selectedNodeId === nodeId,
    isEdgeSelected: (edgeId: string) => store.state.selectedEdgeId === edgeId,
  };
}

// =============================================================================
// HELPER: Initial Selection State
// =============================================================================

/**
 * Create initial selection state for a store.
 * Use this when defining your store's initial state.
 *
 * @returns Empty selection state
 *
 * @example
 * ```typescript
 * const initialState = {
 *   nodes: [],
 *   edges: [],
 *   ...createInitialSelectionState(),
 * };
 * ```
 */
export function createInitialSelectionState(): SelectionState {
  return {
    selectedNodeId: null,
    selectedEdgeId: null,
  };
}
