/**
 * Save Version Dialog
 *
 * Shared dialog for saving a new version snapshot with optional notes.
 * Includes status selector for changing status during save.
 * Used by Journey Builder, Agent Workflows, and Mindstate.
 *
 * @module shared/components/save-version-dialog
 */

import type { DeactivationMode } from "@journey/schemas";
import { type Tag, TagInput } from "emblor";
import { CheckCircle2, Circle, Play, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

import { DeactivationOptionsSelector } from "./deactivation-options-selector";
import { type BuilderStatus, StatusSelector, getStatusButtonIcon, getStatusButtonText } from "./status-selector";

// =============================================================================
// TYPES
// =============================================================================

export interface SaveVersionOptions {
  notes?: string;
  newStatus?: BuilderStatus;
  deactivationMode?: DeactivationMode;
  customLabels?: string[];
  setProduction?: boolean;
}

interface SaveVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (options: SaveVersionOptions) => void;

  /** Show "Set as Production" checkbox (for prompts) - legacy mode */
  showProductionToggle?: boolean;

  // Status selector props
  /** Current status of the item being saved */
  currentStatus?: BuilderStatus;
  /** Show status selector (enables status change during save) */
  showStatusSelector?: boolean;
  /** Number of active sessions (for deactivation warning) */
  activeSessionCount?: number;
  /** Builder type for context-specific behavior */
  builderType?: "journey" | "workflow" | "mindstate";
}

// =============================================================================
// TAG INPUT STYLES
// =============================================================================

const TAG_INPUT_STYLES = {
  inlineTagsContainer:
    "border-input rounded-md bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring outline-none focus-within:ring-[3px] focus-within:ring-ring/50 p-1 gap-1",
  input: "w-full min-w-[80px] shadow-none px-2 h-7 text-xs",
  tag: {
    body: "h-7 relative bg-background border border-input hover:bg-background rounded-md font-medium text-xs ps-2 pe-7",
    closeButton:
      "absolute -inset-y-px -end-px p-0 rounded-e-md flex size-7 transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-muted-foreground/80 hover:text-foreground",
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function toTags(strings: string[]): Tag[] {
  return strings.filter((text) => text.trim() !== "").map((text) => ({ id: `label-${text}`, text }));
}

function toStrings(tags: Tag[]): string[] {
  return tags.map((tag) => tag.text.toLowerCase()).filter((text) => text.trim() !== "");
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SaveVersionDialog({
  open,
  onOpenChange,
  onSave,
  showProductionToggle,
  currentStatus,
  showStatusSelector,
  activeSessionCount = 0,
  builderType,
}: SaveVersionDialogProps) {
  const [notes, setNotes] = useState("");
  const [setProduction, setSetProduction] = useState(true);
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);

  // Status state
  // Default to "active" since this is typically opened from "Publish" button
  const [selectedStatus, setSelectedStatus] = useState<BuilderStatus>("active");
  const [deactivationMode, setDeactivationMode] = useState<DeactivationMode>("pause");

  // Reset ALL state when dialog opens (not when it closes)
  // This prevents the collapse animation from triggering during dialog close
  useEffect(() => {
    if (open) {
      setNotes("");
      setSetProduction(true);
      setCustomLabels([]);
      setActiveTagIndex(null);
      // Default to "active" since user typically wants to publish
      setSelectedStatus("active");
      setDeactivationMode("pause");
    }
  }, [open]);

  // Determine if we're deactivating (changing from active to something else)
  const isDeactivating = currentStatus === "active" && selectedStatus !== "active";
  const showDeactivationOptions = isDeactivating && activeSessionCount > 0 && builderType === "journey";
  const showActivationWarning = currentStatus !== "active" && selectedStatus === "active";

  // Delayed unmount for smooth collapse animation
  // Track which content type to render (stays in DOM during collapse animation)
  const [renderedContentType, setRenderedContentType] = useState<"activation" | "deactivation" | null>(null);

  const currentContentType = showActivationWarning ? "activation" : showDeactivationOptions ? "deactivation" : null;
  const isContentVisible = currentContentType !== null;

  useEffect(() => {
    if (currentContentType) {
      // Show immediately when content should appear
      setRenderedContentType(currentContentType);
    } else {
      // Delay unmount to allow collapse animation to complete
      const timer = setTimeout(() => setRenderedContentType(null), 500);
      return () => clearTimeout(timer);
    }
  }, [currentContentType]);

  // Clear rendered content after dialog close animation completes
  // This prevents stale content from appearing when dialog reopens
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => setRenderedContentType(null), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Get dynamic button text and icon
  const ButtonIcon = showStatusSelector ? getStatusButtonIcon(selectedStatus) : null;
  const buttonText = showStatusSelector ? getStatusButtonText(selectedStatus) : "Publish Version";

  const handleCustomLabelsChange = (newTags: Tag[]) => {
    setCustomLabels(toStrings(newTags));
  };

  const handleSave = () => {
    const options: SaveVersionOptions = {
      notes: notes || undefined,
      customLabels: customLabels.length > 0 ? customLabels : undefined,
    };

    // Add status if using status selector
    if (showStatusSelector) {
      options.newStatus = selectedStatus;
      if (showDeactivationOptions) {
        options.deactivationMode = deactivationMode;
      }
    }

    // Legacy: production toggle for prompts
    if (showProductionToggle) {
      options.setProduction = setProduction;
    }

    onSave(options);
    onOpenChange(false);
    // State resets when dialog opens next time (see open effect above)
  };

  const handleCancel = () => {
    onOpenChange(false);
    // State resets when dialog opens next time (see open effect above)
  };

  // Get dialog title based on mode
  const dialogTitle = showStatusSelector ? (selectedStatus === "active" ? "Publish Version" : "Save Version") : "Publish Version";

  const dialogDescription = showStatusSelector
    ? selectedStatus === "active"
      ? "Publish a new version to your live item."
      : "Create a new version with your current changes."
    : "Create a new version with your current changes.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md transition-all duration-500 ease-in-out">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Notes textarea */}
          <div className="space-y-2">
            <Label htmlFor="release-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Release Notes
            </Label>
            <Textarea
              id="release-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about what changed..."
              className="resize-none"
            />
          </div>

          {/* Status Selector Section */}
          {showStatusSelector && (
            <div>
              <StatusSelector value={selectedStatus} onChange={setSelectedStatus} />

              {/* Conditional Content Wrapper - smooth expand/collapse with delayed unmount */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-500 ease-in-out overflow-hidden",
                  isContentVisible ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  {/* Activation warning - rendered based on delayed state */}
                  {renderedContentType === "activation" && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 mt-1">
                      <Play className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">This will make your changes live immediately.</span>
                    </div>
                  )}

                  {/* Deactivation warning and mode selector - rendered based on delayed state */}
                  {renderedContentType === "deactivation" && (
                    <div className="space-y-4 pt-1">
                      <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <Users className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          {activeSessionCount} active {activeSessionCount === 1 ? "session" : "sessions"} will be affected
                        </span>
                      </div>

                      {/* Deactivation mode options */}
                      <DeactivationOptionsSelector value={deactivationMode} onChange={setDeactivationMode} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Legacy: Production toggle (for prompts) */}
          {showProductionToggle && (
            <div className="space-y-6 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setSetProduction(!setProduction)}
                className="flex items-center gap-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {setProduction ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4" />}
                Set as Production
              </button>

              {/* Custom Labels */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Version Tags</Label>
                <TagInput
                  tags={toTags(customLabels)}
                  setTags={handleCustomLabelsChange}
                  placeholder="Add tags..."
                  activeTagIndex={activeTagIndex}
                  setActiveTagIndex={setActiveTagIndex}
                  styleClasses={{
                    ...TAG_INPUT_STYLES,
                    inlineTagsContainer: cn(TAG_INPUT_STYLES.inlineTagsContainer, "min-h-10"),
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant={deactivationMode === "terminate" && showDeactivationOptions ? "destructive" : "default"}>
            {ButtonIcon && <ButtonIcon className="h-4 w-4 mr-2" />}
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
