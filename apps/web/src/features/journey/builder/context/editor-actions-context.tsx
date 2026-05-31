/**
 * Editor Actions Context
 *
 * Provides dependency-injected actions to all editor components, replacing direct
 * store imports and enabling:
 * - Component isolation and testability
 * - Mock actions for Storybook and unit tests
 * - Cleaner interfaces between layers
 *
 * The default implementation wires to store-actions.ts functions, but consumers
 * can override with mock implementations for testing.
 *
 * @module features/journey/builder/context/editor-actions-context
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { saveManagerActions } from "@/stores/save-manager-store";
import { notify } from "@/shared/lib/ui/notify";
import {
  deleteEdgeWithSync,
  deleteNodeWithSync,
  setButtonTargetNode,
  updateEdgeWithSync,
  updateNodeWithSync,
} from "@/stores/store-actions";
import { journeyNodesActions } from "@/stores/journey-nodes-store";
import { uiActions } from "@/stores/ui-store";

/**
 * Editor Actions Context Interface
 *
 * Provides all actions needed by node editors and related components.
 * Each action mirrors its corresponding store-actions.ts function.
 */
export interface EditorActionsContextValue {
  // Node operations
  /** Update a node's data and sync related state (e.g., timer edge labels) */
  updateNode: (id: string, updates: Partial<JourneyNode>) => void;
  /** Delete a node and auto-clear UI selection via event bus */
  deleteNode: (id: string) => void;

  // Edge operations
  /** Update an edge's data */
  updateEdge: (id: string, updates: Partial<JourneyEdge>) => void;
  /** Delete an edge (handles stored, managed, and virtual edges) */
  deleteEdge: (id: string) => void;
  /**
   * Delete an edge directly without side effects (raw deletion).
   * Use when you're managing button/form state yourself and don't want
   * the sync version to conflict with form state updates.
   */
  deleteEdgeRaw: (id: string) => void;

  // Button operations
  /** Set or clear a button's target node (syncs managed edge automatically) */
  setButtonTarget: (nodeId: string, buttonId: string, targetNodeId?: string) => void;

  // UI operations
  /** Mark journey as having pending unsaved changes */
  setPendingChanges: (pending: boolean) => void;
  /** Clear current selection (node or edge) */
  clearSelection: () => void;

  // Auto-save operations
  /**
   * Clear selection with auto-save support.
   * If an editor is open, validates and saves first.
   * Returns true if selection was cleared, false if blocked by validation.
   */
  clearSelectionWithAutoSave: () => Promise<boolean>;
  /**
   * Select a node with auto-save support.
   * If an editor is open, saves changes first before switching.
   * Returns true if switched, false if blocked by validation.
   */
  selectNodeWithAutoSave: (node: JourneyNode) => Promise<boolean>;

  // Notifications
  /** Toast notification utilities */
  notify: {
    success: (message: string, options?: { description?: string }) => void;
    error: (message: string, options?: { description?: string }) => void;
    warning: (message: string, options?: { description?: string }) => void;
    info: (message: string, options?: { description?: string }) => void;
  };
}

/**
 * Default actions implementation using store-actions.ts functions.
 * This is what production code uses when no overrides are provided.
 *
 * Note: deleteEdgeRaw is a wrapper function to avoid module initialization
 * order issues in tests (journeyNodesActions may not be defined at module load time).
 *
 * Note: clearSelectionWithAutoSave is a no-op in the default
 * implementation because they require ref state managed by the provider.
 * The provider overrides these with real implementations.
 */
const defaultActions: EditorActionsContextValue = {
  // Node operations
  updateNode: updateNodeWithSync,
  deleteNode: deleteNodeWithSync,

  // Edge operations
  updateEdge: updateEdgeWithSync,
  deleteEdge: deleteEdgeWithSync,
  // Wrapper to avoid eager evaluation during module init (fixes test circular deps)
  deleteEdgeRaw: (id: string) => journeyNodesActions.deleteEdge(id),

  // Button operations
  setButtonTarget: setButtonTargetNode,

  // UI operations
  setPendingChanges: uiActions.setPendingChanges,
  clearSelection: uiActions.clearSelection,

  // Auto-save operations (no-ops in default, provider overrides with real implementation)
  clearSelectionWithAutoSave: async () => {
    uiActions.clearSelection();
    return true;
  },
  selectNodeWithAutoSave: async (node: JourneyNode) => {
    uiActions.setSelectedNode(node);
    uiActions.setSelectedEdge(null);
    return true;
  },

  // Notifications
  notify,
};

const EditorActionsContext = createContext<EditorActionsContextValue>(defaultActions);

/**
 * Props for EditorActionsProvider.
 */
export interface EditorActionsProviderProps {
  children: ReactNode;
  /** Optional action overrides for testing/Storybook */
  overrides?: Partial<EditorActionsContextValue>;
}

/**
 * Editor Actions Provider
 *
 * Wraps the editor tree and provides injectable actions to all descendants.
 * Delegates to the shared auto-save registry for cross-builder consistency.
 *
 * Usage:
 * ```tsx
 * // Production - uses default store actions
 * <EditorActionsProvider>
 *   <JourneyCanvas />
 * </EditorActionsProvider>
 *
 * // Testing - provide mock actions
 * <EditorActionsProvider overrides={{ deleteNode: mockDeleteNode }}>
 *   <MyComponent />
 * </EditorActionsProvider>
 * ```
 */
export function EditorActionsProvider({ children, overrides }: EditorActionsProviderProps) {
  // Clear selection with auto-save support
  // Flushes active editor via save manager, then clears selection
  const clearSelectionWithAutoSave = useCallback(async (): Promise<boolean> => {
    const success = await saveManagerActions.flushActiveEditor();
    if (!success) {
      // Validation failed, don't clear selection
      return false;
    }

    // Clear selection
    uiActions.clearSelection();
    return true;
  }, []);

  // Select node with auto-save support
  // Saves current editor before switching to new node
  const selectNodeWithAutoSave = useCallback(async (node: JourneyNode): Promise<boolean> => {
    const success = await saveManagerActions.flushActiveEditor();
    if (!success) {
      // Validation failed, stay on current node
      return false;
    }

    // Switch to new node
    uiActions.setSelectedNode(node);
    uiActions.setSelectedEdge(null);
    return true;
  }, []);

  // Merge default actions with any overrides and our auto-save implementations
  const value = useMemo<EditorActionsContextValue>(() => {
    const baseActions = overrides
      ? {
          ...defaultActions,
          ...overrides,
          // Merge nested notify object properly
          notify: {
            ...defaultActions.notify,
            ...overrides.notify,
          },
        }
      : defaultActions;

    // Always override auto-save methods with our real implementations
    return {
      ...baseActions,
      clearSelectionWithAutoSave: overrides?.clearSelectionWithAutoSave ?? clearSelectionWithAutoSave,
      selectNodeWithAutoSave: overrides?.selectNodeWithAutoSave ?? selectNodeWithAutoSave,
    };
  }, [overrides, clearSelectionWithAutoSave, selectNodeWithAutoSave]);

  return <EditorActionsContext.Provider value={value}>{children}</EditorActionsContext.Provider>;
}

/**
 * Hook to consume editor actions from context.
 *
 * Unlike useCanvasContext, this always returns a value (the default implementation)
 * so components can use it without being wrapped in the provider - making them
 * more portable. In production, actions wire to stores. In tests, wrap with
 * provider + overrides to mock behavior.
 *
 * Note: Named differently from `useEditorActions` hook (in hooks/) which is a
 * direct wrapper around store actions. This context-based approach enables
 * dependency injection for testing and component isolation.
 *
 * @example
 * ```tsx
 * function MyNodeEditor({ nodeId }: { nodeId: string }) {
 *   const { updateNode, deleteNode, notify } = useEditorActionsContext();
 *
 *   const handleSave = (data) => {
 *     updateNode(nodeId, { data });
 *     notify.success("Saved!");
 *   };
 *
 *   const handleDelete = () => {
 *     deleteNode(nodeId);
 *   };
 *
 *   return <EditorBase onSave={handleSave} onDelete={handleDelete} ... />;
 * }
 * ```
 */
export function useEditorActionsContext(): EditorActionsContextValue {
  return useContext(EditorActionsContext);
}
