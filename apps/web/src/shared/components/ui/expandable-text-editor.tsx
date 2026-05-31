/**
 * ExpandableTextEditor Component
 *
 * A wrapper that adds fullscreen expansion capability to any text input.
 * Shows an expand button in the bottom-right corner when content overflows,
 * opening a fullscreen dialog for easier viewing/editing.
 *
 * Features:
 * - Read-only mode: View content + copy to clipboard
 * - Edit mode: Edit content with Save/Cancel actions
 * - Optional TemplateTextarea integration for template variable autocomplete
 * - Optional FormattingToolbar for Telegram-style formatting
 * - Optional Markdown syntax highlighting with shiki (live preview as you type)
 *
 * @module shared/components/ui/expandable-text-editor
 */

import { Check, Copy, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { FormattingToolbar, handleFormattingShortcut } from "@/features/nodes/journey/editors/sections/formatting-toolbar";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { MonacoMarkdownEditor, type MonacoMarkdownEditorRef } from "@/shared/components/ui/monaco";
import { TemplateProvider, useTemplateContext, type TemplateContextValue } from "@/shared/components/ui/template-context";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { Textarea } from "@/shared/components/ui/textarea";
import { notify } from "@/shared/lib/ui/notify";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum character count to show the expand button */
const MIN_CHARS_FOR_EXPAND = 100;

// =============================================================================
// TYPES
// =============================================================================

export interface ExpandableTextEditorProps {
  /** Current text value */
  value: string;

  /** Called when content changes (only in edit mode, on Save) */
  onChange?: (value: string) => void;

  /** Allow editing in fullscreen mode. If false, shows read-only view with Copy button */
  editable?: boolean;

  /** Title for the fullscreen dialog */
  title?: string;

  /** Children to render as the inline editor (the textarea being wrapped) */
  children: ReactNode;

  /** Custom class for the wrapper container */
  className?: string;

  /** Disable expand functionality */
  disabled?: boolean;

  /** Placeholder text shown in fullscreen edit mode when empty */
  placeholder?: string;

  /** Callback when dialog opens/closes */
  onOpenChange?: (open: boolean) => void;

  /** Minimum character count to show expand button (default: 100) */
  minCharsForExpand?: number;

  /** Enable TemplateTextarea in fullscreen for template variable autocomplete.
   * Requires component to be inside a TemplateProvider. */
  enableTemplates?: boolean;

  /** Show Telegram HTML formatting toolbar in fullscreen edit mode */
  showFormattingToolbar?: boolean;

  /** Enable markdown syntax highlighting in the textarea.
   * Uses shiki for live syntax coloring of markdown elements. */
  enableMarkdownHighlight?: boolean;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to optionally access template context.
 * Returns null if not inside a TemplateProvider (instead of throwing).
 */
function useOptionalTemplateContext(): TemplateContextValue | null {
  try {
    return useTemplateContext();
  } catch {
    return null;
  }
}

// =============================================================================
// INTERNAL COMPONENTS
// =============================================================================

interface ExpandButtonProps {
  onClick: () => void;
  visible: boolean;
}

function ExpandButton({ onClick, visible }: ExpandButtonProps) {
  if (!visible) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute bottom-2 right-3 h-6 w-6 opacity-50 z-10"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      title="Expand to fullscreen"
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </Button>
  );
}

interface FullscreenDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  editable: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  enableTemplates?: boolean;
  showFormattingToolbar?: boolean;
  enableMarkdownHighlight?: boolean;
  templateContext: TemplateContextValue | null;
}

function FullscreenDialog({
  open,
  onClose,
  title,
  value,
  editable,
  onChange,
  placeholder,
  enableTemplates,
  showFormattingToolbar,
  enableMarkdownHighlight,
  templateContext,
}: FullscreenDialogProps) {
  const [draftValue, setDraftValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const monacoRef = useRef<MonacoMarkdownEditorRef>(null);

  // Can we actually use templates? Need both prop enabled AND context available
  const canUseTemplates = enableTemplates && templateContext !== null;

  // Reset draft when dialog opens
  useEffect(() => {
    if (open) {
      setDraftValue(value);
      // Focus editor in edit mode (Monaco or textarea depending on mode)
      if (editable) {
        setTimeout(() => {
          if (enableMarkdownHighlight) {
            monacoRef.current?.focus();
          } else {
            textareaRef.current?.focus();
          }
        }, 100);
      }
    }
  }, [open, value, editable, enableMarkdownHighlight]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editable ? draftValue : value);
    notify.success("Copied to clipboard");
  }, [editable, draftValue, value]);

  const handleSave = useCallback(() => {
    onChange?.(draftValue);
    onClose();
  }, [draftValue, onChange, onClose]);

  const handleCancel = useCallback(() => {
    setDraftValue(value); // Reset to original
    onClose();
  }, [value, onClose]);

  const handleDraftChange = useCallback((newValue: string) => {
    setDraftValue(newValue);
  }, []);

  // Dialog keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && editable) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleCancel, handleSave, editable]
  );

  // Handle formatting shortcuts in textarea
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showFormattingToolbar && editable) {
        handleFormattingShortcut(e, draftValue, handleDraftChange);
      }
    },
    [showFormattingToolbar, editable, draftValue, handleDraftChange]
  );

  // Render the editable content based on enabled features
  const renderEditableContent = () => {
    // Common classes for all textarea variants in fullscreen mode
    const textareaClass = "h-full text-sm";
    const wrapperClass = "flex-1 min-h-0"; // min-h-0 prevents flex overflow

    // Markdown highlighting with Monaco
    // Wrap in div to stop keyboard event propagation - Radix Dialog intercepts Space/Enter for accessibility
    if (enableMarkdownHighlight) {
      return (
        <div onKeyDown={(e) => e.stopPropagation()} className={wrapperClass}>
          <MonacoMarkdownEditor
            ref={monacoRef}
            value={draftValue}
            onChange={handleDraftChange}
            placeholder={placeholder}
            minHeight={400}
            rounded
            fillContainer
          />
        </div>
      );
    }

    // Templates only (no markdown highlighting)
    if (canUseTemplates) {
      return (
        <TemplateProvider nodes={templateContext.nodes} edges={templateContext.edges} journeyId={templateContext.journeyId} nodeId={templateContext.nodeId}>
          <TemplateTextarea
            textareaRef={textareaRef}
            value={draftValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleDraftChange(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={placeholder}
            wrapperClassName={wrapperClass}
            className={textareaClass}
          />
        </TemplateProvider>
      );
    }

    // Plain textarea (no features)
    return (
      <Textarea
        ref={textareaRef}
        value={draftValue}
        onChange={(e) => handleDraftChange(e.target.value)}
        onKeyDown={handleTextareaKeyDown}
        placeholder={placeholder}
        className={cn(textareaClass, "font-mono shadow-none resize-none", wrapperClass)}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="w-[60vw]! h-[80vh]! max-w-none! sm:max-w-none! flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {editable && showFormattingToolbar && !enableMarkdownHighlight && <FormattingToolbar textareaRef={textareaRef} value={draftValue} onChange={handleDraftChange} />}

        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Copy button - top right of content area */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7 opacity-50 z-10"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>

          {editable ? (
            renderEditableContent()
          ) : (
            <pre className="flex-1 overflow-auto text-sm font-mono leading-relaxed whitespace-pre-wrap p-4 pr-10 bg-muted/30 rounded-md">
              {value || <span className="text-muted-foreground italic">No content</span>}
            </pre>
          )}
        </div>

        {editable && (
          <DialogFooter className="flex-row justify-end gap-2 pt-4 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ExpandableTextEditor({
  value,
  onChange,
  editable = false,
  title = "Edit Content",
  children,
  className,
  disabled = false,
  placeholder,
  onOpenChange,
  minCharsForExpand,
  enableTemplates = false,
  showFormattingToolbar = false,
  enableMarkdownHighlight = true,
}: ExpandableTextEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Try to get template context for passing to fullscreen dialog
  const templateContext = useOptionalTemplateContext();

  // Show expand button when content exceeds character threshold
  const showExpandButton = value.length >= (minCharsForExpand ?? MIN_CHARS_FOR_EXPAND);

  const handleOpenDialog = useCallback(() => {
    if (disabled) return;
    setDialogOpen(true);
    onOpenChange?.(true);
  }, [disabled, onOpenChange]);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <div className={cn("relative", className)}>
      {children}

      <ExpandButton onClick={handleOpenDialog} visible={showExpandButton && !disabled} />

      <FullscreenDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        title={title}
        value={value}
        editable={editable}
        onChange={onChange}
        placeholder={placeholder}
        enableTemplates={enableTemplates}
        showFormattingToolbar={showFormattingToolbar}
        enableMarkdownHighlight={enableMarkdownHighlight}
        templateContext={templateContext}
      />
    </div>
  );
}
