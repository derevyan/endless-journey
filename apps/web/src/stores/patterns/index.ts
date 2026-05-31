/**
 * Store Patterns
 *
 * Composable patterns for TanStack stores. These patterns can be combined
 * to build stores with common functionality without inheritance.
 *
 * @module stores/patterns
 *
 * @example
 * ```typescript
 * import {
 *   createHistoryCapability,
 *   createCRUDCapability,
 *   createSelectionCapability,
 *   createInitialHistoryState,
 *   createInitialSelectionState,
 * } from "@/stores/patterns";
 *
 * // Define state with pattern states
 * interface MyState {
 *   nodes: Node[];
 *   edges: Edge[];
 *   history: HistoryState<{ nodes: Node[]; edges: Edge[] }>;
 *   selectedNodeId: string | null;
 *   selectedEdgeId: string | null;
 * }
 *
 * const initialState: MyState = {
 *   nodes: [],
 *   edges: [],
 *   history: createInitialHistoryState(),
 *   ...createInitialSelectionState(),
 * };
 *
 * const store = new Store(initialState);
 *
 * // Create capabilities
 * const history = createHistoryCapability(store, ...);
 * const nodeCRUD = createCRUDCapability(store, "nodes", ...);
 * const selection = createSelectionCapability(store);
 *
 * // Compose into actions
 * export const actions = {
 *   // History with CRUD
 *   addNode: (node) => { history.pushHistory(); nodeCRUD.add(node); },
 *   undo: history.undo,
 *   redo: history.redo,
 *
 *   // Selection
 *   selectNode: selection.selectNode,
 *   clearSelection: selection.clearSelection,
 * };
 * ```
 */

// History pattern (undo/redo)
export {
  createHistoryCapability,
  createInitialHistoryState,
  type HistoryCapability,
  type HistoryOptions,
  type HistoryState,
} from "./history";

// CRUD pattern (create, read, update, delete)
export {
  createCRUDCapability,
  type CRUDCapability,
  type CRUDOptions,
  type Identifiable,
} from "./crud";

// Selection pattern
export {
  createSelectionCapability,
  createInitialSelectionState,
  type SelectionCapability,
  type SelectionOptions,
  type SelectionState,
} from "./selection";
