/**
 * Events Query Hooks
 *
 * TanStack Query hooks for fetching event logs.
 *
 * @module hooks/queries/use-events
 */

import { useQuery } from "@tanstack/react-query";

import {
  eventsApi,
  type EventsQueryOptions,
  type EventsResponse,
  type EventStatsResponse,
  type EventTypesResponse,
  type CrmActivityQueryOptions,
  type CrmActivityResponse,
  type LlmUsageQueryOptions,
} from "@/shared/lib/api";
import { eventKeys } from "@/shared/lib/query-keys";
import { authClient } from "@/shared/lib/auth-client";

// Re-export types for convenience
export type { EventsQueryOptions, EventsResponse, EventStatsResponse, EventTypesResponse, CrmActivityQueryOptions, CrmActivityResponse };
export type { EventTypeInfo, CrmActivity, LlmUsageQueryOptions, LlmUsageResponse, LlmUsageStatsResponse, LlmUsageEvent } from "@/shared/lib/api";

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to fetch events with filters
 */
export function useEvents(options: EventsQueryOptions = {}) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: eventKeys.list({
      types: options.types,
      startDate: options.startDate,
      endDate: options.endDate,
    }),
    queryFn: () => eventsApi.getEvents(options),
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!session,
  });
}

/**
 * Hook to fetch event statistics
 */
export function useEventStats() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: eventKeys.stats(),
    queryFn: eventsApi.getEventStats,
    refetchInterval: 60000, // Refetch every minute
    enabled: !!session,
  });
}

/**
 * Hook to fetch available event types
 */
export function useEventTypes() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: eventKeys.types(),
    queryFn: eventsApi.getEventTypes,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: !!session,
  });
}

/**
 * Hook to fetch CRM activity log
 */
export function useCrmActivityLog(options: CrmActivityQueryOptions = {}) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: eventKeys.crmActivity({
      types: options.types,
      startDate: options.startDate,
      endDate: options.endDate,
    }),
    queryFn: () => eventsApi.getCrmActivityLog(options),
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!session,
  });
}

/**
 * Hook to fetch LLM usage events
 */
export function useLlmUsage(options: LlmUsageQueryOptions = {}) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: eventKeys.llmUsage({
      services: options.services,
      models: options.models,
      providers: options.providers,
      startDate: options.startDate,
      endDate: options.endDate,
    }),
    queryFn: () => eventsApi.getLlmUsage(options),
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!session,
  });
}

/**
 * Hook to fetch LLM usage statistics
 */
export function useLlmUsageStats() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: eventKeys.llmUsageStats(),
    queryFn: eventsApi.getLlmUsageStats,
    refetchInterval: 60000, // Refetch every minute
    enabled: !!session,
  });
}
