/**
 * EditorBase Component
 *
 * Self-managing Panel shell for all node editors.
 * Provides consistent header with close button, scrollable content area,
 * and optional footer with delete button.
 *
 * Auto-save pattern:
 * - Changes are auto-saved when closing the panel (X button or canvas click)
 * - If validation fails, panel stays open and shows error
 * - Footer with Delete only shown in edit mode
 *
 * Self-manages:
 * - readOnly mode (derived from isEditMode store)
 * - close action (clears selection via context)
 * - delete action (removes node via context)
 *
 * Uses EditorActionsContext for dependency injection, enabling:
 * - Component isolation and testability
 * - Mock actions for Storybook and unit tests
 */

import { useCallback, useState } from "react";

import { useEditorActionsContext } from "@/features/journey/builder/context";
import { useEditorMode } from "@/features/journey/builder/hooks/selectors/editor-selectors";
import { Button } from "@/shared/components/ui/button";
import { appConfig } from "@/shared/lib/app-config";
import { cn } from "@/shared/lib/utils";
import { Panel } from "@xyflow/react";
import { Loader2, Save, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";

interface EditorBaseProps {
  /** Editor panel title */
  title: string;
  /** Node ID for delete action */
  nodeId: string;
  /** Editor content */
  children: ReactNode;
  /**
   * Auto-save handler called on close. If returns false, panel stays open.
   * Always called when present (idempotent) - validation blocks close if it fails.
   */
  onAutoSaveClose?: () => Promise<boolean>;
  /** Explicit save handler for Save button. If provided, shows Save button in footer. */
  onSave?: () => Promise<boolean>;
  /** Whether save is in progress (for loading state) */
  isSaving?: boolean;
  /** Whether form has unsaved changes (enables Save button when true) */
  isDirty?: boolean;
  /** Optional close override (default: clears selection) */
  onClose?: () => void;
  /** Optional delete override (default: deletes node and clears selection) */
  onDelete?: (() => void) | null;
  /** Optional readOnly override (default: derived from isEditMode) */
  readOnly?: boolean;
  /** Cancel handler to discard changes and close (if provided, shows Cancel button when dirty) */
  onCancel?: () => void;
  /** Optional test ID for e2e testing (default: "node-editor") */
  testId?: string;
}

export function EditorBase({
  title,
  nodeId,
  children,
  onAutoSaveClose,
  onSave,
  isSaving = false,
  isDirty = false,
  onClose,
  onDelete,
  readOnly,
  onCancel,
  testId = "node-editor",
}: EditorBaseProps) {
  const [isClosing, setIsClosing] = useState(false);

  // Derive readOnly from store if not explicitly provided
  const { isEditMode } = useEditorMode();
  const effectiveReadOnly = readOnly ?? !isEditMode;

  // Get injected actions from context (enables mocking in tests)
  const { deleteNode, clearSelection } = useEditorActionsContext();

  // Note: Auto-save handler registration is now handled by form hooks directly
  // (e.g., useNodeEditorForm calls saveManagerActions.registerEditor with the nodeId)
  // This enables proper ownership tracking and prevents race conditions

  // Close handler with auto-save
  // Always call handler if registered - it's idempotent (no-op when not dirty)
  const handleClose = useCallback(async () => {
    // Always call auto-save handler if registered and not read-only
    if (onAutoSaveClose && !effectiveReadOnly) {
      setIsClosing(true);
      try {
        const success = await onAutoSaveClose();
        if (!success) {
          // Validation failed, stay open
          setIsClosing(false);
          return;
        }
      } catch {
        // Error during save, stay open
        setIsClosing(false);
        return;
      }
    }

    // Proceed with close
    if (onClose) {
      onClose();
    } else {
      clearSelection();
    }
  }, [onAutoSaveClose, effectiveReadOnly, onClose, clearSelection]);

  // Default delete handler: delete node and clear selection
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete();
    } else {
      deleteNode(nodeId);
      // Selection is auto-cleared via event bus subscription in ui-store
    }
  }, [onDelete, nodeId, deleteNode]);

  // Explicit save handler for Save button
  const handleSave = useCallback(async () => {
    if (onSave) {
      await onSave();
    }
  }, [onSave]);

  // Determine if delete should be shown (not provided as null)
  const showDelete = onDelete !== null;
  // Show cancel only when dirty and handler is provided
  const showCancel = isDirty && onCancel;
  // Show footer if Delete, Cancel, or Save button should be visible
  const showFooter = (showDelete || showCancel || onSave) && !effectiveReadOnly;

  // Margin right is always 1rem - the ReactFlow container already accounts for sidebar width
  // when sidebar is open, so Panel position="top-right" naturally positions at the container edge
  const marginRight = "1rem";
  // Add top margin to clear the dashboard header area
  const marginTop = "1rem";
  // Max height accounts for: header (3.5rem) + top margin (1rem) + bottom margin (1rem) = 5.5rem
  const maxHeight = "calc(100vh - 5.5rem)";

  return (
    <Panel
      position="top-right"
      className={cn("bg-card rounded-lg shadow-md border flex flex-col z-100", appConfig.editor.width)}
      style={{ marginRight, marginTop, maxHeight }}
      data-testid={testId}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b shrink-0 rounded-t-lg">
        <h3 className="font-semibold text-sm capitalize" data-testid="node-editor-heading">
          {title}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose} disabled={isClosing}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content - grows with content, scrolls only when at max height */}
      <div className="min-h-0 scrollbar-ghost p-4 space-y-4">{children}</div>

      {/* Footer - shown when Delete, Cancel, or Save button is available */}
      {showFooter && (
        <div className="p-4 pt-3 border-t shrink-0 flex items-center justify-between bg-card rounded-b-lg">
          {/* Delete button (left side) */}
          {showDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={isClosing || isSaving}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          ) : (
            <div /> // Spacer when no delete button
          )}

          {/* Right side: Cancel + Save buttons */}
          <div className="flex items-center gap-2">
            {/* Cancel button - resets form */}
            {showCancel && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 min-w-[90px]"
                onClick={onCancel}
                disabled={isClosing || isSaving}
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
            )}

            {/* Save button */}
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 min-w-[90px]"
                onClick={handleSave}
                disabled={isClosing || isSaving || !isDirty}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1.5" />
                    Save
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
