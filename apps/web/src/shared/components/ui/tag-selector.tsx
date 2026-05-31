/**
 * Tag Selector Component
 *
 * A reusable tag selection component with search and multi/single select modes.
 *
 * @module components/ui/tag-selector
 */

import { Check, Plus, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { TagBadge } from "@/shared/components/ui/badges";
import { cn } from "@/shared/lib/utils";

export interface TagSelectorProps {
  /** Available tags to select from */
  availableTags: string[];
  /** Currently selected tags */
  selectedTags?: string[];
  /** Callback when tags are selected/deselected (for multi-select mode) */
  onTagsChange?: (tags: string[]) => void;
  /** Callback when a single tag is selected (for single-select mode) */
  onTagSelect?: (tag: string) => void;
  /** Tag color map for visual styling */
  tagColorMap?: Record<string, string>;
  /** Allow creating new tags not in the list */
  allowCreate?: boolean;
  /** Callback when a new tag is created */
  onTagCreate?: (tag: string) => void;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Multi-select mode (checkbox style) or single-select (click to add) */
  mode?: "multi" | "single";
  /** Disabled state */
  disabled?: boolean;
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Popover alignment */
  align?: "start" | "center" | "end";
  /** Custom class for popover content */
  className?: string;
}

export function TagSelector({
  availableTags,
  selectedTags = [],
  onTagsChange,
  onTagSelect,
  tagColorMap = {},
  allowCreate = false,
  onTagCreate,
  searchPlaceholder = "Search tags...",
  emptyMessage = "No tags found",
  mode = "multi",
  disabled = false,
  trigger,
  align = "start",
  className,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filter tags based on search
  const filteredTags = availableTags.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search term is a new tag (not in available tags)
  const isNewTag =
    allowCreate &&
    search.trim() &&
    !availableTags.some((t) => t.toLowerCase() === search.toLowerCase().trim());

  // Handle tag toggle for multi-select mode
  const handleToggle = (tag: string) => {
    if (mode === "multi" && onTagsChange) {
      const newTags = selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag];
      onTagsChange(newTags);
    } else if (mode === "single" && onTagSelect) {
      onTagSelect(tag);
      setOpen(false);
      setSearch("");
    }
  };

  // Handle creating new tag
  const handleCreate = () => {
    const newTag = search.trim();
    if (!newTag) return;

    if (onTagCreate) {
      onTagCreate(newTag);
    } else if (onTagSelect) {
      onTagSelect(newTag);
    }
    setOpen(false);
    setSearch("");
  };

  // Handle open change
  const handleOpenChange = (newOpen: boolean) => {
    if (disabled) return;
    setOpen(newOpen);
    if (!newOpen) {
      setSearch("");
    }
  };

  // Default trigger button
  const defaultTrigger = (
    <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5">
      <Plus className="size-3.5" />
      Add Tag
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger || defaultTrigger}</PopoverTrigger>
      <PopoverContent className={cn("w-64 p-2", className)} align={align}>
        {/* Search Input */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && isNewTag) {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
        </div>

        {/* Tags List */}
        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-0.5">
            {/* Create new tag option */}
            {isNewTag && (
              <button
                type="button"
                onClick={handleCreate}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Plus className="size-3.5 text-primary" />
                <span>Create &quot;{search.trim()}&quot;</span>
              </button>
            )}

            {/* Existing tags */}
            {filteredTags.length === 0 && !isNewTag ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                const color = tagColorMap[tag];

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggle(tag)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      "hover:bg-accent",
                      isSelected && mode === "multi" && "bg-accent/50"
                    )}
                  >
                    {mode === "multi" && (
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                    )}
                    <TagBadge tag={tag} color={color} className="text-xs" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
