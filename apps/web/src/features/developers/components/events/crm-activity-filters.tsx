/**
 * CRM Activity Filters Component
 *
 * Collapsible filter panel for CRM activity logs.
 * Includes timeline and activity type filters.
 *
 * @module components/developers/events/crm-activity-filters
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

import { getCrmActivityTypes } from "@journey/schemas";

// =============================================================================
// TYPES
// =============================================================================

export interface CrmActivityFiltersProps {
  selectedActivityTypes: string[];
  onActivityTypesChange: (types: string[]) => void;
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
  activityTypeCounts?: Record<string, number>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CrmActivityFilters({
  selectedActivityTypes,
  onActivityTypesChange,
  timeline,
  onTimelineChange,
  activityTypeCounts = {},
}: CrmActivityFiltersProps) {
  const activityTypeOptions = useMemo(() => getCrmActivityTypes(), []);

  function toggleActivityType(type: string) {
    if (selectedActivityTypes.includes(type)) {
      onActivityTypesChange(selectedActivityTypes.filter((t) => t !== type));
    } else {
      onActivityTypesChange([...selectedActivityTypes, type]);
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

          {/* Activity Type Filter */}
          <Collapsible defaultOpen className="group/filter">
            <CollapsibleTrigger asChild>
              <Button className="flex w-full h-7 items-center justify-start gap-1.5 px-2" variant="ghost" size="sm">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/filter:rotate-90" />
                <span className="text-xs font-medium">Activity Type</span>
                {selectedActivityTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {selectedActivityTypes.length}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-1 pt-0.5 pb-1">
              <div className="flex flex-col">
                {activityTypeOptions.map((activityType) => (
                  <div key={activityType.value} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/50 rounded">
                    <Checkbox
                      checked={selectedActivityTypes.includes(activityType.value)}
                      onCheckedChange={() => toggleActivityType(activityType.value)}
                      id={`activity-type-${activityType.value}`}
                      className="h-3.5 w-3.5"
                    />
                    <Label className="flex flex-1 cursor-pointer items-center justify-between text-xs" htmlFor={`activity-type-${activityType.value}`}>
                      <span>{activityType.label}</span>
                      <span className="text-muted-foreground">{activityTypeCounts[activityType.value] ?? 0}</span>
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
