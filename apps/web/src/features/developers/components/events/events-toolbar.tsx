/**
 * Events Toolbar Component
 *
 * Search, refresh, live toggle, and actions for event logs.
 *
 * @module components/developers/events/events-toolbar
 */

import { ChevronDown, ChevronUp, Filter, RefreshCw, Search } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import type { CrmActivityFiltersProps } from "./crm-activity-filters";
import type { EventsFiltersProps } from "./events-filters";
import type { LlmUsageFiltersProps } from "./llm-usage-filters";
import { MobileFilterDrawer } from "./mobile-filter-drawer";

// =============================================================================
// TYPES
// =============================================================================

export interface EventsToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isLive: boolean;
  onLiveToggle: () => void;
  onToggleFilters: () => void;
  isRefreshing?: boolean;
  expandMessages: boolean;
  onExpandMessagesToggle: () => void;
  hideLiveToggle?: boolean;
  hideExpandToggle?: boolean;
  activeTab: "journey" | "crm" | "llm";
  journeyFilterProps?: EventsFiltersProps;
  crmFilterProps?: CrmActivityFiltersProps;
  llmFilterProps?: LlmUsageFiltersProps;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EventsToolbar({
  searchValue,
  onSearchChange,
  onRefresh,
  isLive,
  onLiveToggle,
  onToggleFilters,
  isRefreshing,
  expandMessages,
  onExpandMessagesToggle,
  hideLiveToggle,
  hideExpandToggle,
  activeTab,
  journeyFilterProps,
  crmFilterProps,
  llmFilterProps,
}: EventsToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border/20 bg-transparent p-3 px-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onToggleFilters} className="hidden shrink-0 lg:flex" variant="outline" size="icon">
              <Filter className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Toggle Filters</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <MobileFilterDrawer activeTab={activeTab} journeyFilterProps={journeyFilterProps} crmFilterProps={crmFilterProps} llmFilterProps={llmFilterProps} />

      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search events..." className="pl-10" />
      </div>

      <div className="flex-1" />

      {!hideExpandToggle && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onExpandMessagesToggle} className="shrink-0" variant="outline" size="icon">
                {expandMessages ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{expandMessages ? "Collapse Messages" : "Expand Messages"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onRefresh} className="shrink-0" variant="outline" size="icon">
              <RefreshCw className={cn("size-4 text-muted-foreground", isRefreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Refresh</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {!hideLiveToggle && (
        <Button
          onClick={onLiveToggle}
          variant={isLive ? "secondary" : "outline"}
          size="sm"
          className={cn("shrink-0 gap-2 px-3 transition-all", isLive && "bg-green-500/15 text-green-600 hover:bg-green-500/25")}
        >
          <span className="relative flex h-2 w-2">
            {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", isLive ? "bg-green-500" : "bg-muted-foreground")} />
          </span>
          <span className="text-xs font-medium">Live</span>
        </Button>
      )}
    </div>
  );
}
