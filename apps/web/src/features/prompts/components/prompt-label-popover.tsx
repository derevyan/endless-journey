/**
 * Prompt Label Popover
 *
 * Popover for managing version labels.
 * - "production" - user-settable, marks the version to use in production
 * - "latest" - system-only, auto-assigned to newest version (not editable)
 * - Custom labels - any other user-defined labels
 *
 * @module features/prompts/components/prompt-label-popover
 */

import { memo, useCallback, useState } from "react";

import { type Tag, TagInput } from "emblor";
import { Check, Loader2, Tag as TagIcon } from "lucide-react";

import { LabelBadge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";

// =============================================================================
// TYPES
// =============================================================================

interface PromptLabelPopoverProps {
  versionId: string;
  currentLabels: string[];
  onUpdateLabels: (labels: string[]) => Promise<void>;
  disabled?: boolean;
}

// Only "production" is user-settable. "latest" is automatic.
const PROTECTED_LABELS = ["production"];

// Tag input styles matching the node editor pattern
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

// Convert string array to Tag array for emblor
function toTags(strings: string[]): Tag[] {
  return strings.filter((text) => text.trim() !== "").map((text) => ({ id: `label-${text}`, text }));
}

// Convert Tag array back to string array
function toStrings(tags: Tag[]): string[] {
  return tags.map((tag) => tag.text.toLowerCase()).filter((text) => text.trim() !== "");
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PromptLabelPopover = memo(function PromptLabelPopover({
  versionId: _versionId,
  currentLabels,
  onUpdateLabels,
  disabled,
}: PromptLabelPopoverProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<string[]>(currentLabels);
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Separate protected and custom labels
  const customLabels = labels.filter((l) => !PROTECTED_LABELS.includes(l) && l !== "latest");

  const handleOpen = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setLabels(currentLabels);
    }
    setOpen(isOpen);
  }, [currentLabels]);

  const handleCustomLabelsChange = useCallback((newTags: Tag[]) => {
    const newCustomLabels = toStrings(newTags);
    // Preserve protected labels that are set, add new custom labels
    const protectedSet = labels.filter((l) => PROTECTED_LABELS.includes(l) || l === "latest");
    setLabels([...protectedSet, ...newCustomLabels]);
  }, [labels]);

  const handleToggleProtected = useCallback((label: string) => {
    if (labels.includes(label)) {
      setLabels(labels.filter((l) => l !== label));
    } else {
      setLabels([...labels, label]);
    }
  }, [labels]);

  const handleSave = useCallback(async () => {
    setIsUpdating(true);
    try {
      await onUpdateLabels(labels);
      setOpen(false);
    } finally {
      setIsUpdating(false);
    }
  }, [labels, onUpdateLabels]);

  const hasChanges =
    labels.length !== currentLabels.length ||
    labels.some((l) => !currentLabels.includes(l)) ||
    currentLabels.some((l) => !labels.includes(l));

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled}>
          <TagIcon className="size-3" />
          Labels
          {currentLabels.length > 0 && (
            <span className="text-muted-foreground">({currentLabels.length})</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Version Labels</p>
            <p className="text-xs text-muted-foreground">
              Assign labels like "production" to this version.
            </p>
          </div>

          {/* Protected Labels */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Standard labels:</p>
            <div className="flex flex-wrap gap-2">
              {PROTECTED_LABELS.map((label) => {
                const isActive = labels.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => handleToggleProtected(label)}
                    className="flex items-center gap-1"
                  >
                    <LabelBadge
                      label={label}
                      className={isActive ? "" : "opacity-40"}
                    />
                    {isActive && <Check className="size-3 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Labels - using TagInput like node editor */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Custom labels:</p>
            <TagInput
              tags={toTags(customLabels)}
              setTags={handleCustomLabelsChange}
              placeholder="Type label and press Enter..."
              activeTagIndex={activeTagIndex}
              setActiveTagIndex={setActiveTagIndex}
              styleClasses={TAG_INPUT_STYLES}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="size-3 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
