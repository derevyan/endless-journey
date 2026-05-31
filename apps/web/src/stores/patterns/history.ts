/**
 * History Pattern (Undo/Redo)
 *
 * Composable history capability for stores. Enables undo/redo functionality
 * without requiring inheritance or specific store structure.
 *
 * @module stores/patterns/history
 */

import type { Store } from "@tanstack/react-store";

// =============================================================================
// TYPES
// =============================================================================

/**
 * History state structure to be included in store state.
 */
export interface HistoryState<TSnapshot> {
  /** Stack of previous states (for undo) */
  past: TSnapshot[];
  /** Stack of undone states (for redo) */
  future: TSnapshot[];
}

/**
 * History capability interface returned by createHistoryCapability.
 */
export interface HistoryCapability {
  /** Push current state to history (call before making changes) */
  pushHistory: () => void;
  /** Undo to previous state. Returns false if nothing to undo. */
  undo: () => boolean;
  /** Redo to next state. Returns false if nothing to redo. */
  redo: () => boolean;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Clear all history */
  clearHistory: () => void;
  /** Get history stack sizes */
  getHistoryInfo: () => { pastCount: number; futureCount: number };
}

/**
 * Options for creating history capability.
 */
export interface HistoryOptions {
  /** Maximum number of history entries to keep. Default: 50 */
  maxHistory?: number;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create history (undo/redo) capability for a store.
 *
 * This is a composable pattern - it doesn't require inheritance or a specific
 * store structure. Just include a `history` field in your store state.
 *
 * @param store - TanStack Store instance
 * @param getSnapshot - Function to extract snapshot from current state
 * @param applySnapshot - Function to apply a snapshot to state
 * @param options - Configuration options
 * @returns History capability object
 *
 * @example
 * ```typescript
 * // In your store file
 * interface MyState {
 *   nodes: Node[];
 *   edges: Edge[];
 *   history: HistoryState<{ nodes: Node[]; edges: Edge[] }>;
 * }
 *
 * const store = new Store<MyState>(initialState);
 *
 * const history = createHistoryCapability(
 *   store,
 *   (state) => ({ nodes: state.nodes, edges: state.edges }),
 *   (state, snapshot) => ({ nodes: snapshot.nodes, edges: snapshot.edges })
 * );
 *
 * // Use in actions
 * export const actions = {
 *   addNode: (node: Node) => {
 *     history.pushHistory(); // Save current state before change
 *     store.setState((s) => ({ ...s, nodes: [...s.nodes, node] }));
 *   },
 *   undo: history.undo,
 *   redo: history.redo,
 * };
 * ```
 */
export function createHistoryCapability<
  TState extends { history: HistoryState<TSnapshot> },
  TSnapshot,
>(
  store: Store<TState>,
  getSnapshot: (state: TState) => TSnapshot,
  applySnapshot: (state: TState, snapshot: TSnapshot) => Partial<TState>,
  options: HistoryOptions = {}
): HistoryCapability {
  const { maxHistory = 50 } = options;

  return {
    pushHistory: () => {
      const state = store.state;
      const snapshot = getSnapshot(state);
      const newPast = [...state.history.past, snapshot].slice(-maxHistory);

      store.setState((s) => ({
        ...s,
        history: {
          past: newPast,
          future: [], // Clear future on new action (standard undo behavior)
        },
      }));
    },

    undo: () => {
      const state = store.state;
      if (state.history.past.length === 0) return false;

      const currentSnapshot = getSnapshot(state);
      const previousSnapshot = state.history.past[state.history.past.length - 1];

      store.setState((s) => ({
        ...s,
        ...applySnapshot(s, previousSnapshot),
        history: {
          past: s.history.past.slice(0, -1),
          future: [currentSnapshot, ...s.history.future],
        },
      }));

      return true;
    },

    redo: () => {
      const state = store.state;
      if (state.history.future.length === 0) return false;

      const currentSnapshot = getSnapshot(state);
      const nextSnapshot = state.history.future[0];

      store.setState((s) => ({
        ...s,
        ...applySnapshot(s, nextSnapshot),
        history: {
          past: [...s.history.past, currentSnapshot],
          future: s.history.future.slice(1),
        },
      }));

      return true;
    },

    canUndo: () => store.state.history.past.length > 0,
    canRedo: () => store.state.history.future.length > 0,

    clearHistory: () => {
      store.setState((s) => ({
        ...s,
        history: { past: [], future: [] },
      }));
    },

    getHistoryInfo: () => ({
      pastCount: store.state.history.past.length,
      futureCount: store.state.history.future.length,
    }),
  };
}

// =============================================================================
// HELPER: Initial History State
// =============================================================================

/**
 * Create initial history state for a store.
 * Use this when defining your store's initial state.
 *
 * @returns Empty history state
 *
 * @example
 * ```typescript
 * const initialState = {
 *   nodes: [],
 *   edges: [],
 *   history: createInitialHistoryState<{ nodes: Node[]; edges: Edge[] }>(),
 * };
 * ```
 */
export function createInitialHistoryState<TSnapshot>(): HistoryState<TSnapshot> {
  return {
    past: [],
    future: [],
  };
}
