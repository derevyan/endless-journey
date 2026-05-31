/**
 * Events Filters Component
 *
 * Collapsible filter panel for journey event logs.
 * Includes timeline, category-grouped event types, and level filters.
 *
 * @module components/developers/events/events-filters
 */

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Label } from "@/shared/components/ui/label";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TIMELINE_OPTIONS, type Timeline } from "@/shared/lib/utils/date-utils";

import { getEventMetadata, getEventTypesByCategory, getLogLevels, type GroupedEventTypes } from "./event-helpers";

// =============================================================================
// TYPES
// =============================================================================

export interface EventsFiltersProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  selectedLevels: string[];
  onLevelsChange: (levels: string[]) => void;
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
  eventTypeCounts?: Record<string, number>;
  levelCounts?: Record<string, number>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EventsFilters({
  selectedTypes,
  onTypesChange,
  selectedLevels,
  onLevelsChange,
  timeline,
  onTimelineChange,
  eventTypeCounts = {},
  levelCounts = {},
}: EventsFiltersProps) {
  const groupedTypes = useMemo(() => getEventTypesByCategory(), []);
  const levelOptions = useMemo(() => getLogLevels(), []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [type, count] of Object.entries(eventTypeCounts)) {
      const meta = getEventMetadata(type);
      if (meta) {
        counts[meta.category] = (counts[meta.category] || 0) + count;
      }
    }
    return counts;
  }, [eventTypeCounts]);

  function toggleType(type: string) {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  }

  function toggleLevel(level: string) {
    if (selectedLevels.includes(level)) {
      onLevelsChange(selectedLevels.filter((l) => l !== level));
    } else {
      onLevelsChange([...selectedLevels, level]);
    }
  }

  function toggleCategory(category: GroupedEventTypes) {
    const categoryTypes = category.types.map((t) => t.type);
    const allSelected = categoryTypes.every((t) => selectedTypes.includes(t));

    if (allSelected) {
      onTypesChange(selectedTypes.filter((t) => !categoryTypes.includes(t)));
    } else {
      const newTypes = [...new Set([...selectedTypes, ...categoryTypes])];
      onTypesChange(newTypes);
    }
  }

  return (
    <div className="flex h-full flex-col gap-1 md:max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between px-3 py-1">
        <h2 className="text-sm font-medium">Filters</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-1">
          {/* Timeline Filter */}
          <Collapsible defaultOpen className="group/filter">
            <CollapsibleTrigger asChild>
              <Button className="flex w-full h-7 items-center justify-start gap-1.5 px-2" variant="ghost" size="sm">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/filter:rotate-90" />
                <span className="text-xs font-medium">Timeline</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-0.5 pb-1.5">
              <Select value={timeline} onValueChange={(e) => onTimelineChange(e as Timeline)}>
                <SelectTrigger className="h-7 w-full text-xs">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TIMELINE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          {/* Categories Filter */}
          <Collapsible defaultOpen className="group/filter">
            <CollapsibleTrigger asChild>
              <Button className="flex w-full h-7 items-center justify-start gap-1.5 px-2" variant="ghost" size="sm">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/filter:rotate-90" />
                <span className="text-xs font-medium">Categories</span>
                {selectedTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {selectedTypes.length}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0 px-1 pt-0.5 pb-1">
              {groupedTypes.map((category) => {
                const categoryTypes = category.types.map((t) => t.type);
                const selectedInCategory = categoryTypes.filter((t) => selectedTypes.includes(t)).length;
                const allSelected = selectedInCategory === categoryTypes.length;
                const someSelected = selectedInCategory > 0 && !allSelected;

                return (
                  <Collapsible key={category.category} className="group/category">
                    <div className="flex items-center gap-1.5 rounded hover:bg-muted/50 px-1.5 py-0.5">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={() => toggleCategory(category)}
                        id={`category-${category.category}`}
                        className="h-3.5 w-3.5"
                      />
                      <CollapsibleTrigger asChild>
                        <button className="flex flex-1 items-center justify-between gap-1 text-left">
                          <span className="text-xs">{category.label}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{categoryCounts[category.category] ?? 0}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]/category:rotate-90" />
                          </div>
                        </button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="pl-6 space-y-0">
                      {category.types.map((eventType) => (
                        <div key={eventType.type} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/30 rounded">
                          <Checkbox
                            checked={selectedTypes.includes(eventType.type)}
                            onCheckedChange={() => toggleType(eventType.type)}
                            id={`type-${eventType.type}`}
                            className="h-3.5 w-3.5"
                          />
                          <Label className="flex flex-1 cursor-pointer items-center justify-between text-xs" htmlFor={`type-${eventType.type}`}>
                            <span className="text-muted-foreground">{eventType.label}</span>
                            <span className="text-xs text-muted-foreground">{eventTypeCounts[eventType.type] ?? 0}</span>
                          </Label>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Level Filter */}
          <Collapsible defaultOpen className="group/filter">
            <CollapsibleTrigger asChild>
              <Button className="flex w-full h-7 items-center justify-start gap-1.5 px-2" variant="ghost" size="sm">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/filter:rotate-90" />
                <span className="text-xs font-medium">Level</span>
                {selectedLevels.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {selectedLevels.length}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-1 pt-0.5 pb-1">
              <div className="flex flex-col">
                {levelOptions.map((level) => (
                  <div key={level.value} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/50 rounded">
                    <Checkbox
                      checked={selectedLevels.includes(level.value)}
                      onCheckedChange={() => toggleLevel(level.value)}
                      id={`level-${level.value}`}
                      className="h-3.5 w-3.5"
                    />
                    <Label className="flex flex-1 cursor-pointer items-center justify-between text-xs" htmlFor={`level-${level.value}`}>
                      <span>{level.label}</span>
                      <span className="text-muted-foreground">{levelCounts[level.value] ?? 0}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
