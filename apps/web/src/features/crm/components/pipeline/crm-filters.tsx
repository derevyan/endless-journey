/**
 * CRM Filter Toolbar
 *
 * Separate filter buttons for each filter type with individual popovers.
 *
 * @module components/crm/pipeline/crm-filter-toolbar
 */

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { TagBadge } from "@/shared/components/ui/badges";
import { TAG_COLOR_MAP } from "@/shared/lib/app-config";
import { cn } from "@/shared/lib/utils";
import type { PipelineStage } from "@/shared/lib/api";
import type { DateRange } from "react-day-picker";

// =============================================================================
// TYPES
// =============================================================================

export interface CrmFilters {
  stageIds: string[];
  tags: string[];
  platforms: string[];
  dateRange?: DateRange;
}

interface CrmFilterToolbarProps {
  filters: CrmFilters;
  onFiltersChange: (filters: CrmFilters) => void;
  stages: PipelineStage[];
  availableTags: string[];
  availablePlatforms: string[];
  tagColorMap?: Record<string, string>;
  disabled?: boolean;
}

// =============================================================================
// DATE RANGE FILTER
// =============================================================================

interface DateRangeFilterProps {
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  disabled?: boolean;
}

function DateRangeFilter({ dateRange, onDateRangeChange, disabled }: DateRangeFilterProps) {
  // Format date range for display
  const formatRange = () => {
    if (!dateRange?.from) return "Date";
    const from = dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!dateRange.to || dateRange.from.toDateString() === dateRange.to.toDateString()) return from;
    const to = dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${from} - ${to}`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={dateRange?.from ? "secondary" : "outline"} size="sm" disabled={disabled}>
          {formatRange()}
          <ChevronDown className="ml-1 size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar mode="range" selected={dateRange} onSelect={onDateRangeChange} defaultMonth={dateRange?.from} />
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CrmFilterToolbar({
  filters,
  onFiltersChange,
  stages,
  availableTags,
  availablePlatforms: _availablePlatforms,
  tagColorMap = {},
  disabled = false,
}: CrmFilterToolbarProps) {
  const [stageOpen, setStageOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  // Count active filters
  const activeFilterCount = filters.stageIds.length + filters.tags.length + filters.platforms.length + (filters.dateRange?.from ? 1 : 0);

  // Handle stage toggle
  const toggleStage = (stageId: string) => {
    const newStageIds = filters.stageIds.includes(stageId) ? filters.stageIds.filter((id) => id !== stageId) : [...filters.stageIds, stageId];
    onFiltersChange({ ...filters, stageIds: newStageIds });
  };

  // Handle tag toggle
  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    onFiltersChange({ ...filters, dateRange: range });
  };

  // Clear all filters
  const clearAll = () => {
    onFiltersChange({
      stageIds: [],
      tags: [],
      platforms: [],
      dateRange: undefined,
    });
  };

  // Filter tags based on search
  const filteredTags = availableTags.filter((tag) => tag.toLowerCase().includes(tagSearch.toLowerCase()));

  // Determine which filters should be disabled (no data available)
  const stagesDisabled = disabled || stages.length === 0;
  const tagsDisabled = disabled || availableTags.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Stage Filter - always visible */}
      <Popover open={stageOpen} onOpenChange={stagesDisabled ? undefined : setStageOpen}>
        <PopoverTrigger asChild>
          <Button variant={filters.stageIds.length > 0 ? "secondary" : "outline"} size="sm" disabled={stagesDisabled}>
            Stage
            <ChevronDown className="ml-1 size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Pipeline Stages</Label>
            <div className="space-y-2">
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-center space-x-2">
                  <Checkbox id={`stage-${stage.id}`} checked={filters.stageIds.includes(stage.id)} onCheckedChange={() => toggleStage(stage.id)} />
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ backgroundColor: stage.color || "#6b7280" }} />
                    <label htmlFor={`stage-${stage.id}`} className="cursor-pointer text-sm leading-none">
                      {stage.name}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Tags Filter - always visible */}
      <Popover
        open={tagsOpen}
        onOpenChange={
          tagsDisabled
            ? undefined
            : (open) => {
                setTagsOpen(open);
                if (!open) setTagSearch("");
              }
        }
      >
        <PopoverTrigger asChild>
          <Button variant={filters.tags.length > 0 ? "secondary" : "outline"} size="sm" disabled={tagsDisabled}>
            Tags
            <ChevronDown className="ml-1 size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Tags</Label>
            <Input placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} className="h-8 text-xs" />
            <ScrollArea className="h-64">
              <div className="pr-4">
                {filteredTags.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">No tags found</p>
                ) : (
                  filteredTags.map((tag) => {
                    const color = tagColorMap[tag];
                    return (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox id={`tag-${tag}`} checked={filters.tags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
                        <label htmlFor={`tag-${tag}`} className="flex-1 cursor-pointer">
                          <TagBadge tag={tag} color={color} className="text-xs" />
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {/* Platform Filter - commented for now as we have only one p[latform integrated. Uncomment it later */}
      {/* <Popover open={platformOpen} onOpenChange={platformsDisabled ? undefined : setPlatformOpen}>
        <PopoverTrigger asChild>
          <Button variant={filters.platforms.length > 0 ? "secondary" : "outline"} size="sm" disabled={platformsDisabled}>
            Platform
            <ChevronDown className="ml-1 size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Platforms</Label>
            <div className="space-y-2">
              {availablePlatforms.map((platform) => (
                <div key={platform} className="flex items-center space-x-2">
                  <Checkbox id={`platform-${platform}`} checked={filters.platforms.includes(platform)} onCheckedChange={() => togglePlatform(platform)} />
                  <label htmlFor={`platform-${platform}`} className="cursor-pointer text-sm capitalize leading-none">
                    {platform}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover> */}

      {/* Date Range Filter */}
      <DateRangeFilter dateRange={filters.dateRange} onDateRangeChange={handleDateRangeChange} disabled={disabled} />

      {/* Clear All */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
          Clear all ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// ACTIVE FILTERS DISPLAY
// =============================================================================

interface ActiveFiltersBadgesProps {
  filters: CrmFilters;
  onFiltersChange: (filters: CrmFilters) => void;
  stages: PipelineStage[];
  tagColorMap?: Record<string, string>;
}

export function ActiveFiltersBadges({ filters, onFiltersChange, stages, tagColorMap = {} }: ActiveFiltersBadgesProps) {
  const hasActiveFilters = filters.stageIds.length > 0 || filters.tags.length > 0 || filters.platforms.length > 0 || filters.dateRange?.from;

  if (!hasActiveFilters) return null;

  const formatDateRange = () => {
    if (!filters.dateRange?.from) return "";
    const from = filters.dateRange.from.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!filters.dateRange.to) return from;
    const to = filters.dateRange.to.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${from} - ${to}`;
  };

  const removeStage = (stageId: string) => {
    onFiltersChange({
      ...filters,
      stageIds: filters.stageIds.filter((id) => id !== stageId),
    });
  };

  const removeTag = (tag: string) => {
    onFiltersChange({
      ...filters,
      tags: filters.tags.filter((t) => t !== tag),
    });
  };

  const removePlatform = (platform: string) => {
    onFiltersChange({
      ...filters,
      platforms: filters.platforms.filter((p) => p !== platform),
    });
  };

  const removeDate = () => {
    onFiltersChange({ ...filters, dateRange: undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Stage badges */}
      {filters.stageIds.map((stageId) => {
        const stage = stages.find((s) => s.id === stageId);
        if (!stage) return null;
        return (
          <Badge key={stageId} variant="secondary" className="gap-1">
            <div className="size-2 rounded-full" style={{ backgroundColor: stage.color || "#6b7280" }} />
            {stage.name}
            <X className="size-3 cursor-pointer" onClick={() => removeStage(stageId)} />
          </Badge>
        );
      })}

      {/* Tag badges */}
      {filters.tags.map((tag) => {
        const color = tagColorMap[tag];
        const dotColor = color && TAG_COLOR_MAP[color] ? TAG_COLOR_MAP[color] : "bg-slate-500";
        return (
          <Badge key={tag} variant="secondary" className="gap-1.5 font-mono">
            <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
            {tag}
            <X className="size-3 cursor-pointer" onClick={() => removeTag(tag)} />
          </Badge>
        );
      })}

      {/* Platform badges */}
      {filters.platforms.map((platform) => (
        <Badge key={platform} variant="secondary" className="gap-1 capitalize">
          {platform}
          <X className="size-3 cursor-pointer" onClick={() => removePlatform(platform)} />
        </Badge>
      ))}

      {/* Date range badge */}
      {filters.dateRange?.from && (
        <Badge variant="secondary" className="gap-1">
          {formatDateRange()}
          <X className="size-3 cursor-pointer" onClick={removeDate} />
        </Badge>
      )}
    </div>
  );
}
