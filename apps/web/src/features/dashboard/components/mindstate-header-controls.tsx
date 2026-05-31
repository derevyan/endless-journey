/**
 * MindState Header Controls
 *
 * Self-managing component that renders mindstate-specific controls in the dashboard header.
 * Mirrors the journey/agent header layout for consistency.
 *
 * @module features/dashboard/components/mindstate-header-controls
 */

import { useStore } from "@tanstack/react-store";
import { Eraser, History, Redo2, Rocket, RotateCcw, Settings, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";

import type { MindstateStatus } from "@journey/schemas";

import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { SaveVersionDialog, type SaveVersionOptions } from "@/shared/components/save-version-dialog";
import type { BuilderStatus } from "@/shared/components/status-selector";

import { mindstateHeaderActions, mindstateHeaderStore } from "@/features/dashboard/store/mindstate-header-store";
import { MindstateDefinitionSelector } from "@/features/mindstate/components/mindstate-definition-selector";
import { builderSelectors, builderStore } from "@/features/mindstate/stores/builder-store";

export function MindstateHeaderControls() {
  const {
    definitionKey,
    onDefinitionSelect,
    definitionStatus,
    onStatusChange,
    onSave,
    onDiscard,
    onUndo,
    onRedo,
    onClearPreview,
    onHistory,
    onSettings,
    isActive,
  } = useStore(mindstateHeaderStore);

  const isDirty = useStore(builderStore, builderSelectors.isDirty);
  const isSaving = useStore(builderStore, builderSelectors.isSaving);
  const isProcessing = useStore(builderStore, builderSelectors.isProcessing);
  const canUndo = useStore(builderStore, (s) => s.undoStack.length > 0);
  const canRedo = useStore(builderStore, (s) => s.redoStack.length > 0);
  const previewMessageCount = useStore(builderStore, (s) => s.preview.messages.length);
  const definitionCreatedAt = useStore(builderStore, (s) => s.definition?.createdAt);

  // Local state for save dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const isNewDefinition = !definitionCreatedAt;
  const currentStatus = definitionStatus ?? "draft";
  const isActiveStatus = currentStatus === "active";

  // Handle save button click
  const handleSaveClick = useCallback(() => {
    if (isNewDefinition) {
      // New definition - save directly without dialog
      onSave?.();
    } else {
      // Existing definition - show save dialog
      setShowSaveDialog(true);
    }
  }, [isNewDefinition, onSave]);

  // Handle save from dialog
  const handleSaveFromDialog = useCallback(async (options: SaveVersionOptions) => {
    // Call the save action
    onSave?.();
    setShowSaveDialog(false);

    // If status changed, update status after save
    if (options.newStatus && options.newStatus !== currentStatus && onStatusChange) {
      mindstateHeaderActions.setUpdatingStatus(true);
      try {
        await onStatusChange(options.newStatus as MindstateStatus);
      } finally {
        mindstateHeaderActions.setUpdatingStatus(false);
      }
    }
  }, [onSave, currentStatus, onStatusChange]);

  if (!isActive) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Definition Selector */}
        {definitionKey && onDefinitionSelect && (
          <>
            <MindstateDefinitionSelector
              selectedDefinitionKey={definitionKey}
              onDefinitionSelect={onDefinitionSelect}
            />
            <Separator orientation="vertical" className="mx-1 h-5" />
          </>
        )}

        {/* Undo/Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onUndo ?? undefined} disabled={!canUndo} className="h-7 w-7">
              <Undo2 className="h-3.5 w-3.5" />
              <span className="sr-only">Undo</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onRedo ?? undefined} disabled={!canRedo} className="h-7 w-7">
              <Redo2 className="h-3.5 w-3.5" />
              <span className="sr-only">Redo</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Save */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSaveClick}
              disabled={!isDirty || isSaving}
              className="h-7 w-7"
            >
              <Rocket className={cn("h-3.5 w-3.5", isDirty && "text-foreground")} />
              <span className="sr-only">Publish</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isSaving
              ? "Publishing..."
              : isDirty
                ? isActiveStatus
                  ? "Publish changes"
                  : "Save changes"
                : isActiveStatus
                  ? "No changes to publish"
                  : "No changes to save"}
          </TooltipContent>
        </Tooltip>

        {/* Discard */}
        {onDiscard && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDiscard}
                disabled={!isDirty}
                className={cn("h-7 w-7", isDirty && "text-foreground")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="sr-only">Discard</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Discard changes</TooltipContent>
          </Tooltip>
        )}

        {/* Clear Preview */}
        {onClearPreview && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearPreview}
                disabled={isProcessing || previewMessageCount === 0}
                className="h-7 w-7"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span className="sr-only">Clear chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear chat</TooltipContent>
          </Tooltip>
        )}

        {/* Version History */}
        {onHistory && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onHistory} className="h-7 w-7">
                <History className="h-3.5 w-3.5" />
                <span className="sr-only">Version history</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Version history</TooltipContent>
          </Tooltip>
        )}

        {/* Settings */}
        {onSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onSettings} className="h-7 w-7">
                <Settings className="h-3.5 w-3.5" />
                <span className="sr-only">Settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        )}

        {/* Unsaved indicator */}
        {isDirty && <span className="text-xs text-amber-600 dark:text-amber-400 px-2 font-medium">Unsaved</span>}

        {/* Save Version Dialog */}
        <SaveVersionDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={handleSaveFromDialog}
          currentStatus={(currentStatus as BuilderStatus) ?? "draft"}
          showStatusSelector={true}
          builderType="mindstate"
        />
      </div>
    </TooltipProvider>
  );
}
