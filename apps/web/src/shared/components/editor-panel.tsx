/**
 * Editor Panel Component
 *
 * Shared panel shell for node/config editors in both journey builder
 * and workflow builder. Provides consistent layout:
 * - Header with title and close button (X icon)
 * - Scrollable content area
 * - Optional footer with Delete button (only shown in edit mode with onDelete)
 *
 * Auto-save pattern:
 * - Changes are auto-saved when closing the panel (X button or canvas click)
 * - If validation fails, panel stays open and shows error
 *
 * @module shared/components/editor-panel
 */

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { Panel } from "@xyflow/react";
import { X, Trash2, Loader2, Save } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { PanelSurface } from "@/shared/components/ui/panel-surface";
import { appConfig } from "@/shared/lib/app-config";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface EditorPanelProps {
  /** Panel title */
  title: string;
  /** Panel content */
  children: ReactNode;
  /**
   * Auto-save handler called on close. If returns false, panel stays open.
   * Used for validation - close is blocked until validation passes.
   */
  onAutoSaveClose?: () => Promise<boolean>;
  /** Explicit save handler - shows Save button when provided */
  onSave?: () => Promise<boolean>;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Whether form has unsaved changes (enables auto-save on close) */
  isDirty?: boolean;
  /** Whether form can be saved (additional validation beyond isDirty) */
  canSave?: boolean;
  /** Close/Cancel handler */
  onClose: () => void;
  /** Delete handler - shows Delete button when provided and not readOnly */
  onDelete?: () => void;
  /** Cancel handler to discard changes (if provided, shows Cancel button when dirty) */
  onCancel?: () => void;
  /** Read-only mode - hides edit actions */
  readOnly?: boolean;
  /** Optional test ID for e2e testing */
  testId?: string;
}

const EDITOR_PANEL_MAX_HEIGHT = "calc(100vh - 5.5rem)";
const EDITOR_PANEL_MARGIN = "1rem";

// =============================================================================
// COMPONENT
// =============================================================================

interface EditorPanelShellProps extends EditorPanelProps {
  className?: string;
  style?: CSSProperties;
}

export function EditorPanelShell({
  title,
  children,
  onAutoSaveClose,
  onSave,
  isSaving = false,
  isDirty = false,
  canSave = true,
  onClose,
  onDelete,
  onCancel,
  readOnly = false,
  testId = "editor-panel",
  className,
  style,
}: EditorPanelShellProps) {
  const [isClosing, setIsClosing] = useState(false);

  // Explicit save handler for Save button
  const handleSave = useCallback(async () => {
    if (onSave) {
      await onSave();
    }
  }, [onSave]);

  // Close handler with auto-save
  // IMPORTANT: Always call validateAndSave if provided - don't rely on isDirty
  // isDirty may be stale due to React state timing issues
  const handleClose = useCallback(async () => {
    if (onAutoSaveClose && !readOnly) {
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
    onClose();
  }, [onAutoSaveClose, readOnly, onClose]);

  return (
    <PanelSurface
      className={cn("flex flex-col z-[60]", className)}
      style={style}
      data-testid={testId}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b shrink-0 rounded-t-lg">
        <h3 className="font-semibold text-sm capitalize" data-testid="editor-panel-heading">
          {title}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleClose}
          disabled={isClosing}
          data-testid="editor-panel-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content - grows with content, scrolls only when at max height */}
      <div className="min-h-0 overflow-y-auto p-4 space-y-4 flex-1">{children}</div>

      {/* Footer - shown when Delete, Cancel, or Save button is available */}
      {!readOnly && (onDelete || onCancel || onSave) && (
        <div className="p-4 pt-3 border-t shrink-0 flex items-center justify-between bg-card rounded-b-lg">
          {/* Delete button (left side) */}
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
              disabled={isClosing || isSaving}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          ) : (
            <div /> /* Spacer when no delete button */
          )}

          {/* Right side: Cancel + Save buttons */}
          <div className="flex items-center gap-2">
            {/* Cancel button - resets form */}
            {isDirty && onCancel && (
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
                disabled={isClosing || isSaving || !isDirty || !canSave}
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
    </PanelSurface>
  );
}

export function EditorPanel(props: EditorPanelProps) {
  // Margin right is always 1rem - ReactFlow container already accounts for sidebar width
  const marginRight = EDITOR_PANEL_MARGIN;
  // Add top margin to clear the dashboard header area
  const marginTop = EDITOR_PANEL_MARGIN;
  // Max height accounts for: header (3.5rem) + top margin (1rem) + bottom margin (1rem) = 5.5rem
  const maxHeight = EDITOR_PANEL_MAX_HEIGHT;

  return (
    <Panel position="top-right" className="p-0" style={{ marginRight, marginTop, maxHeight }}>
      <EditorPanelShell {...props} className={appConfig.editor.width} style={{ maxHeight }} />
    </Panel>
  );
}

export function EditorPanelOverlay(props: EditorPanelProps) {
  const maxHeight = EDITOR_PANEL_MAX_HEIGHT;

  const handleBackdropClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      // Close panel only if clicking on the backdrop itself, not the panel
      if (e.target === e.currentTarget) {
        // Use same auto-save logic as X button
        if (props.onAutoSaveClose && !props.readOnly) {
          const success = await props.onAutoSaveClose();
          if (!success) {
            // Validation failed, stay open
            return;
          }
        }
        props.onClose();
      }
    },
    [props]
  );

  return (
    <div
      className="absolute inset-0 z-40"
      onClick={handleBackdropClick}
      data-testid="editor-panel-backdrop"
    >
      <div className="absolute right-4 top-4 z-[55]" style={{ maxHeight }}>
        <EditorPanelShell {...props} className={appConfig.editor.width} style={{ maxHeight }} />
      </div>
    </div>
  );
}
