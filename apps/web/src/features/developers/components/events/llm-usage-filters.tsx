/**
 * LLM Usage Filters Component
 *
 * Collapsible filter panel for LLM usage logs.
 * Includes timeline, services, models, and providers filters.
 *
 * @module components/developers/events/llm-usage-filters
 */

import { ChevronRight } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Label } from "@/shared/components/ui/label";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TIMELINE_OPTIONS, type Timeline } from "@/shared/lib/utils/date-utils";

import { getLlmServiceLabel } from "@journey/schemas";

// =============================================================================
// TYPES
// =============================================================================

export interface LlmUsageFiltersProps {
  selectedServices: string[];
  onServicesChange: (services: string[]) => void;
  selectedModels: string[];
  onModelsChange: (models: string[]) => void;
  selectedProviders: string[];
  onProvidersChange: (providers: string[]) => void;
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
  // Available options from the stats endpoint
  availableServices?: string[];
  availableModels?: string[];
  availableProviders?: string[];
  // Counts for display
  serviceCounts?: Record<string, number>;
  modelCounts?: Record<string, number>;
  providerCounts?: Record<string, number>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LlmUsageFilters({
  selectedServices,
  onServicesChange,
  selectedModels,
  onModelsChange,
  selectedProviders,
  onProvidersChange,
  timeline,
  onTimelineChange,
  availableServices = [],
  availableModels = [],
  availableProviders = [],
  serviceCounts = {},
  modelCounts = {},
  providerCounts = {},
}: LlmUsageFiltersProps) {
  function toggleService(service: string) {
    if (selectedServices.includes(service)) {
      onServicesChange(selectedServices.filter((s) => s !== service));
    } else {
      onServicesChange([...selectedServices, service]);
    }
  }

  function toggleModel(model: string) {
    if (selectedModels.includes(model)) {
      onModelsChange(selectedModels.filter((m) => m !== model));
    } else {
      onModelsChange([...selectedModels, model]);
    }
  }

  function toggleProvider(provider: string) {
    if (selectedProviders.includes(provider)) {
      onProvidersChange(selectedProviders.filter((p) => p !== provider));
    } else {
      onProvidersChange([...selectedProviders, provider]);
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

          {/* Services Filter */}
          {availableServices.length > 0 && (
            <Collapsible defaultOpen className="group/filter">
              <CollapsibleTrigger asChild>
                <Button className="flex w-full h-7 items-center justify-start gap-1.5 px-2" variant="ghost" size="sm">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/filter:rotate-90" />
                  <span className="text-xs font-medium">Service</span>
                  {selectedServices.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {selectedServices.length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-1 pt-0.5 pb-1">
                <div className="flex flex-col">
                  {availableServices.map((service) => (
                    <div key={service} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/50 rounded">
                      <Checkbox
                        checked={selectedServices.includes(service)}
                        onCheckedChange={() => toggleService(service)}
                        id={`service-${service}`}
                        className="h-3.5 w-3.5"
                      />
                      <Label className="flex flex-1 cursor-pointer items-center justify-between text-xs" htmlFor={`service-${service}`}>
                        <span>{getLlmServiceLabel(service)}</span>
                        <span className="text-muted-foreground">{serviceCounts[service] ?? 0}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Models Filter */}
          {availableModels.length > 0 && (
            <Collapsible defaultOpen className="group/filter">
              <CollapsibleTrigger asChild>
                <Button className="flex w-full h-7 items-center justify-start gap-1.5 px-2" variant="ghost" size="sm">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/filter:rotate-90" />
                  <span className="text-xs font-medium">Model</span>
                  {selectedModels.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {selectedModels.length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-1 pt-0.5 pb-1">
                <div className="flex flex-col">
                  {availableModels.map((model) => (
                    <div key={model} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/50 rounded">
                      <Checkbox
                        checked={selectedModels.includes(model)}
                        onCheckedChange={() => toggleModel(model)}
                        id={`model-${model}`}
                        className="h-3.5 w-3.5"
                      />
                      <Label className="flex flex-1 cursor-pointer items-center justify-between text-xs" htmlFor={`model-${model}`}>
                        <span className="font-mono">{model}</span>
                        <span className="text-muted-foreground">{modelCounts[model] ?? 0}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Providers Filter */}
          {availableProviders.length > 0 && (
            <Collapsible defaultOpen className="group/filter">
              <CollapsibleTrigger asChild>
                <Button className="flex w-full h-7 items-center justify-start gap-1.5 px-2" variant="ghost" size="sm">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/filter:rotate-90" />
                  <span className="text-xs font-medium">Provider</span>
                  {selectedProviders.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {selectedProviders.length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-1 pt-0.5 pb-1">
                <div className="flex flex-col">
                  {availableProviders.map((provider) => (
                    <div key={provider} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/50 rounded">
                      <Checkbox
                        checked={selectedProviders.includes(provider)}
                        onCheckedChange={() => toggleProvider(provider)}
                        id={`provider-${provider}`}
                        className="h-3.5 w-3.5"
                      />
                      <Label className="flex flex-1 cursor-pointer items-center justify-between text-xs" htmlFor={`provider-${provider}`}>
                        <span>{provider}</span>
                        <span className="text-muted-foreground">{providerCounts[provider] ?? 0}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
