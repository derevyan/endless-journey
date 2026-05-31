/**
 * Editor Sections Context
 *
 * Provides shared props to editor section components (MediaSection, TimerSection, etc.),
 * eliminating repetitive prop drilling of form, nodeId, and readOnly.
 *
 * Pattern: Context Provider for Shared Props
 *
 * Before: Each section receives 5 props (form, nodeId, open, onOpenChange, readOnly)
 * After: Each section receives 2 props (open, onOpenChange), rest from context
 *
 * @module features/nodes/journey/editors/editor-sections-context
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { NodeEditorFormApi } from "../forms/form-types";

// ============================================================================
// Types
// ============================================================================

export interface EditorSectionsContextValue {
  /** The TanStack Form instance for the current node */
  form: NodeEditorFormApi;
  /** The ID of the node being edited */
  nodeId: string;
  /** Whether the editor is in read-only mode */
  readOnly: boolean;
}

// ============================================================================
// Context
// ============================================================================

const EditorSectionsContext = createContext<EditorSectionsContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface EditorSectionsProviderProps extends EditorSectionsContextValue {
  children: ReactNode;
}

/**
 * Provider component that supplies shared props to editor section components.
 *
 * Wrap all editor sections with this provider to eliminate prop drilling.
 *
 * @example
 * ```tsx
 * <EditorSectionsProvider form={form} nodeId={node.id} readOnly={readOnly}>
 *   <MediaSection open={mediaOpen} onOpenChange={setMediaOpen} />
 *   <TimerSection open={timerOpen} onOpenChange={setTimerOpen} />
 * </EditorSectionsProvider>
 * ```
 */
export function EditorSectionsProvider({ children, form, nodeId, readOnly }: EditorSectionsProviderProps) {
  const value = useMemo<EditorSectionsContextValue>(
    () => ({ form, nodeId, readOnly }),
    [form, nodeId, readOnly]
  );

  return <EditorSectionsContext.Provider value={value}>{children}</EditorSectionsContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access editor sections context.
 *
 * Must be used within an EditorSectionsProvider.
 *
 * @example
 * ```tsx
 * function TimerSection({ open, onOpenChange }) {
 *   const { form, nodeId, readOnly } = useEditorSectionsContext();
 *   // ... use form, nodeId, readOnly
 * }
 * ```
 *
 * @throws Error if used outside EditorSectionsProvider
 */
export function useEditorSectionsContext(): EditorSectionsContextValue {
  const context = useContext(EditorSectionsContext);

  if (!context) {
    throw new Error("useEditorSectionsContext must be used within an EditorSectionsProvider");
  }

  return context;
}
