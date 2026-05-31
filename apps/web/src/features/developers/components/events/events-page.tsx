/**
 * Events Page Component
 *
 * Main page layout for event logs with filters sidebar and table.
 * Supports Journey (interactions), CRM (activity log), and LLM (usage) tabs.
 *
 * @module components/developers/events/events-page
 */

import { Brain, Route as RouteIcon, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Route } from "@/routes/_dashboard.developers.events";

import { PageHeader } from "@/features/dashboard/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

import type { EnrichedEvent } from "@journey/schemas";

import { getTimelineRange, type Timeline } from "@/shared/lib/utils/date-utils";

import { useCrmActivityLog, useEvents, useLlmUsage, useLlmUsageStats, type CrmActivity, type LlmUsageEvent } from "@/hooks/queries/use-events";
import { useEventStream } from "@/shared/hooks";
import { CrmActivityDetailSheet } from "./crm-activity-detail-sheet";
import { CrmActivityFilters } from "./crm-activity-filters";
import { CrmActivityTable } from "./crm-activity-table";
import { EventDetailSheet } from "./event-detail-sheet";
import { getEventMetadata } from "./event-helpers";
import { EventsFilters } from "./events-filters";
import { EventsTable } from "./events-table";
import { EventsToolbar } from "./events-toolbar";
import { LlmUsageDetailSheet } from "./llm-usage-detail-sheet";
import { LlmUsageFilters } from "./llm-usage-filters";
import { LlmUsageTable } from "./llm-usage-table";

// =============================================================================
// COMPONENT
// =============================================================================

type EventTab = "journey" | "crm" | "llm";

export function EventsPage() {
  // Tab state from URL - use Route.useNavigate() for type-safe search params
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = (search.tab || "journey") as EventTab;

  // Journey filter state
  const [showFilters, setShowFilters] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<Timeline>("24hours");
  const [isLive, setIsLive] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [expandMessages, setExpandMessages] = useState(false);

  // CRM activity filter and pagination state
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([]);
  const [crmPageSize, setCrmPageSize] = useState(20);
  const [crmPageIndex, setCrmPageIndex] = useState(0);

  // LLM usage filter and pagination state
  const [selectedLlmServices, setSelectedLlmServices] = useState<string[]>([]);
  const [selectedLlmModels, setSelectedLlmModels] = useState<string[]>([]);
  const [selectedLlmProviders, setSelectedLlmProviders] = useState<string[]>([]);
  const [llmPageSize, setLlmPageSize] = useState(20);
  const [llmPageIndex, setLlmPageIndex] = useState(0);

  // Event detail panel state
  const [selectedEvent, setSelectedEvent] = useState<EnrichedEvent | null>(null);
  const [selectedCrmActivity, setSelectedCrmActivity] = useState<CrmActivity | null>(null);
  const [selectedLlmEvent, setSelectedLlmEvent] = useState<LlmUsageEvent | null>(null);

  // Refresh trigger - incrementing this forces date range recalculation
  const [_refreshTrigger, setRefreshTrigger] = useState(0);
  // Refresh state with minimum visible duration for spin animation
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate date range from timeline (recalculates on timeline change or refresh)
  const dateRange = getTimelineRange(timeline);
  const { startDate, endDate } = dateRange;

  // Memoize options object to prevent query key changes on every render
  const eventsOptions = useMemo(
    () => ({
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      startDate,
      endDate,
      limit: 100,
    }),
    [selectedTypes, startDate, endDate]
  );

  // Fetch journey events
  const { data: eventsData, isLoading: isEventsLoading, isFetching: _isEventsFetching } = useEvents(eventsOptions);

  // Fetch CRM activity
  const crmActivityOptions = useMemo(
    () => ({
      types: selectedActivityTypes.length > 0 ? selectedActivityTypes : undefined,
      startDate,
      endDate,
      limit: 100,
    }),
    [selectedActivityTypes, startDate, endDate]
  );
  const { data: crmActivityData, isLoading: isCrmLoading, isFetching: _isCrmFetching } = useCrmActivityLog(crmActivityOptions);

  // Fetch LLM usage events
  const llmUsageOptions = useMemo(
    () => ({
      services: selectedLlmServices.length > 0 ? selectedLlmServices : undefined,
      models: selectedLlmModels.length > 0 ? selectedLlmModels : undefined,
      providers: selectedLlmProviders.length > 0 ? selectedLlmProviders : undefined,
      startDate,
      endDate,
      limit: 100,
    }),
    [selectedLlmServices, selectedLlmModels, selectedLlmProviders, startDate, endDate]
  );
  const { data: llmUsageData, isLoading: isLlmLoading, isFetching: _isLlmFetching } = useLlmUsage(llmUsageOptions);

  // Fetch LLM usage stats for filter options
  const { data: llmStatsData } = useLlmUsageStats();

  // SSE streaming for live events
  const { events: streamedEvents } = useEventStream(isLive);

  // Combine streamed events and fetched events, deduplicating by ID (DB is source of truth)
  const allEvents = useMemo(() => {
    const dbEventIds = new Set(eventsData?.events.map((e) => e.id) || []);
    const uniqueStreamedEvents = streamedEvents.filter((e) => !dbEventIds.has(e.id));
    return [...uniqueStreamedEvents, ...(eventsData?.events || [])];
  }, [streamedEvents, eventsData]);

  // Calculate counts for filters
  const eventTypeCounts = useMemo(() => {
    return allEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
  }, [allEvents]);

  const levelCounts = useMemo(() => {
    return allEvents.reduce<Record<string, number>>((acc, event) => {
      const meta = getEventMetadata(event.type);
      const level = meta?.level;
      if (!level) return acc;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
  }, [allEvents]);

  // Calculate CRM activity type counts
  const activityTypeCounts = useMemo(() => {
    return (crmActivityData?.activities || []).reduce<Record<string, number>>((acc, activity) => {
      acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
      return acc;
    }, {});
  }, [crmActivityData]);

  // Calculate LLM usage counts
  const llmServiceCounts = useMemo(() => {
    return (llmUsageData?.events || []).reduce<Record<string, number>>((acc, event) => {
      acc[event.service] = (acc[event.service] || 0) + 1;
      return acc;
    }, {});
  }, [llmUsageData]);

  const llmModelCounts = useMemo(() => {
    return (llmUsageData?.events || []).reduce<Record<string, number>>((acc, event) => {
      acc[event.model] = (acc[event.model] || 0) + 1;
      return acc;
    }, {});
  }, [llmUsageData]);

  const llmProviderCounts = useMemo(() => {
    return (llmUsageData?.events || []).reduce<Record<string, number>>((acc, event) => {
      acc[event.provider] = (acc[event.provider] || 0) + 1;
      return acc;
    }, {});
  }, [llmUsageData]);

  // Filter events by level
  const visibleEvents = useMemo(() => {
    let filtered = allEvents;

    // Filter by level
    if (selectedLevels.length > 0) {
      filtered = filtered.filter((event) => {
        const meta = getEventMetadata(event.type);
        return meta?.level ? selectedLevels.includes(meta.level) : false;
      });
    }

    return filtered;
  }, [allEvents, selectedLevels]);

  // Handlers
  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    setPageIndex(0);
  }, []);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    // Increment trigger to recalculate date range with fresh "now" time
    setRefreshTrigger((prev) => prev + 1);
    // Minimum 500ms visible duration for the spin animation
    setTimeout(() => setIsRefreshing(false), 500);
  }, [isRefreshing]);

  const handleLiveToggle = useCallback(() => {
    setIsLive((prev) => {
      const newValue = !prev;
      // When enabling live mode, refresh to catch any missed events
      if (newValue) {
        setRefreshTrigger((t) => t + 1);
      }
      return newValue;
    });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const handlePageChange = useCallback((index: number) => {
    setPageIndex(index);
  }, []);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(visibleEvents.length / pageSize) - 1);
    setPageIndex((prev) => Math.min(prev, maxPage));
  }, [visibleEvents.length, pageSize]);

  // Handle event click
  const handleEventClick = useCallback((event: EnrichedEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // Handle CRM activity click
  const handleCrmActivityClick = useCallback((activity: CrmActivity) => {
    setSelectedCrmActivity(activity);
  }, []);

  const handleCloseCrmDetail = useCallback(() => {
    setSelectedCrmActivity(null);
  }, []);

  // Handle LLM event click
  const handleLlmEventClick = useCallback((event: LlmUsageEvent) => {
    setSelectedLlmEvent(event);
  }, []);

  const handleCloseLlmDetail = useCallback(() => {
    setSelectedLlmEvent(null);
  }, []);

  // Journey filter props
  const journeyFilterProps = {
    selectedTypes,
    onTypesChange: setSelectedTypes,
    selectedLevels,
    onLevelsChange: setSelectedLevels,
    timeline,
    onTimelineChange: setTimeline,
    eventTypeCounts,
    levelCounts,
  };

  // CRM filter props
  const crmFilterProps = {
    selectedActivityTypes,
    onActivityTypesChange: setSelectedActivityTypes,
    timeline,
    onTimelineChange: setTimeline,
    activityTypeCounts,
  };

  // LLM filter props
  const llmFilterProps = {
    selectedServices: selectedLlmServices,
    onServicesChange: setSelectedLlmServices,
    selectedModels: selectedLlmModels,
    onModelsChange: setSelectedLlmModels,
    selectedProviders: selectedLlmProviders,
    onProvidersChange: setSelectedLlmProviders,
    timeline,
    onTimelineChange: setTimeline,
    availableServices: llmStatsData?.filters.services || [],
    availableModels: llmStatsData?.filters.models || [],
    availableProviders: llmStatsData?.filters.providers || [],
    serviceCounts: llmServiceCounts,
    modelCounts: llmModelCounts,
    providerCounts: llmProviderCounts,
  };

  // Handle tab change - persist to URL and reset search/pagination
  const handleTabChange = useCallback((tab: string) => {
    navigate({
      search: { tab: tab as "journey" | "crm" | "llm" },
      replace: true,
    });
    setSearchValue("");
    setPageIndex(0);
    setCrmPageIndex(0);
    setLlmPageIndex(0);
  }, [navigate]);

  // CRM pagination handlers
  const handleCrmPageChange = useCallback((index: number) => {
    setCrmPageIndex(index);
  }, []);

  const handleCrmPageSizeChange = useCallback((size: number) => {
    setCrmPageSize(size);
    setCrmPageIndex(0);
  }, []);

  // LLM pagination handlers
  const handleLlmPageChange = useCallback((index: number) => {
    setLlmPageIndex(index);
  }, []);

  const handleLlmPageSizeChange = useCallback((size: number) => {
    setLlmPageSize(size);
    setLlmPageIndex(0);
  }, []);

  return (
    <div className="flex h-full flex-1 flex-col p-4">
      <PageHeader title="Events & Logs" description="Track, analyze, and act on application behaviors efficiently." />

      {/* Tab Switcher */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="journey" className="gap-2">
            <RouteIcon className="h-4 w-4" />
            Journey
          </TabsTrigger>
          <TabsTrigger value="crm" className="gap-2">
            <Users className="h-4 w-4" />
            CRM
          </TabsTrigger>
          <TabsTrigger value="llm" className="gap-2">
            <Brain className="h-4 w-4" />
            LLM
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content Area */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Filters Sidebar */}
        {showFilters && (
          <div className="hidden w-[240px] shrink-0 lg:block">
            {activeTab === "journey" && <EventsFilters {...journeyFilterProps} />}
            {activeTab === "crm" && <CrmActivityFilters {...crmFilterProps} />}
            {activeTab === "llm" && <LlmUsageFilters {...llmFilterProps} />}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Journey Tab Content */}
          {activeTab === "journey" && (
            <>
              <EventsToolbar
                searchValue={searchValue}
                onSearchChange={handleSearchChange}
                onRefresh={handleRefresh}
                isLive={isLive}
                onLiveToggle={handleLiveToggle}
                onToggleFilters={toggleFilters}
                isRefreshing={isRefreshing}
                expandMessages={expandMessages}
                onExpandMessagesToggle={() => setExpandMessages((prev) => !prev)}
                activeTab={activeTab}
                journeyFilterProps={journeyFilterProps}
              />
              <div className="flex-1 overflow-auto">
                <EventsTable
                  events={visibleEvents}
                  searchValue={searchValue}
                  isLoading={isEventsLoading}
                  pageSize={pageSize}
                  pageIndex={pageIndex}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  expandMessages={expandMessages}
                  onEventClick={handleEventClick}
                  selectedEventId={selectedEvent?.id}
                />
              </div>
            </>
          )}

          {/* CRM Tab Content */}
          {activeTab === "crm" && (
            <>
              <EventsToolbar
                searchValue={searchValue}
                onSearchChange={handleSearchChange}
                onRefresh={handleRefresh}
                isLive={false}
                onLiveToggle={handleLiveToggle}
                onToggleFilters={toggleFilters}
                isRefreshing={isRefreshing}
                expandMessages={false}
                onExpandMessagesToggle={() => {}}
                hideLiveToggle
                hideExpandToggle
                activeTab={activeTab}
                crmFilterProps={crmFilterProps}
              />
              <div className="flex-1 overflow-auto">
                <CrmActivityTable
                  activities={crmActivityData?.activities || []}
                  searchValue={searchValue}
                  isLoading={isCrmLoading}
                  pageSize={crmPageSize}
                  pageIndex={crmPageIndex}
                  onPageChange={handleCrmPageChange}
                  onPageSizeChange={handleCrmPageSizeChange}
                  onActivityClick={handleCrmActivityClick}
                  selectedActivityId={selectedCrmActivity?.id}
                />
              </div>
            </>
          )}

          {/* LLM Tab Content */}
          {activeTab === "llm" && (
            <>
              <EventsToolbar
                searchValue={searchValue}
                onSearchChange={handleSearchChange}
                onRefresh={handleRefresh}
                isLive={false}
                onLiveToggle={handleLiveToggle}
                onToggleFilters={toggleFilters}
                isRefreshing={isRefreshing}
                expandMessages={false}
                onExpandMessagesToggle={() => {}}
                hideLiveToggle
                hideExpandToggle
                activeTab={activeTab}
                llmFilterProps={llmFilterProps}
              />
              <div className="flex-1 overflow-auto">
                <LlmUsageTable
                  events={llmUsageData?.events || []}
                  searchValue={searchValue}
                  isLoading={isLlmLoading}
                  pageSize={llmPageSize}
                  pageIndex={llmPageIndex}
                  onPageChange={handleLlmPageChange}
                  onPageSizeChange={handleLlmPageSizeChange}
                  onEventClick={handleLlmEventClick}
                  selectedEventId={selectedLlmEvent?.id}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Event Detail Sheet - only for Journey tab */}
      {activeTab === "journey" && (
        <EventDetailSheet
          event={selectedEvent}
          open={!!selectedEvent}
          onClose={handleCloseDetail}
        />
      )}

      {/* CRM Activity Detail Sheet - only for CRM tab */}
      {activeTab === "crm" && (
        <CrmActivityDetailSheet
          activity={selectedCrmActivity}
          open={!!selectedCrmActivity}
          onClose={handleCloseCrmDetail}
        />
      )}

      {/* LLM Usage Detail Sheet - only for LLM tab */}
      {activeTab === "llm" && (
        <LlmUsageDetailSheet
          event={selectedLlmEvent}
          open={!!selectedLlmEvent}
          onClose={handleCloseLlmDetail}
        />
      )}
    </div>
  );
}
