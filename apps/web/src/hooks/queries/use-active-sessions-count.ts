/**
 * Active Sessions Count Query Hook
 *
 * Fetches the count of active sessions for a journey.
 * Used by DeactivationDialog to show how many sessions will be affected.
 *
 * @module hooks/queries/use-active-sessions-count
 */

import { useQuery } from "@tanstack/react-query";
import { journeysApi } from "@/shared/lib/api/journeys";
import { journeyKeys } from "@/shared/lib/query-keys";

/**
 * Fetch active sessions count for a journey
 *
 * @param journeyId - The journey ID to get count for
 * @param enabled - Whether to fetch (set to true when dialog opens)
 */
export function useActiveSessionsCount(journeyId: string | null, enabled: boolean = false) {
  return useQuery({
    queryKey: journeyKeys.activeSessionsCount(journeyId || ""),
    queryFn: () => journeysApi.getActiveSessionsCount(journeyId!),
    enabled: !!journeyId && enabled,
    staleTime: 10_000, // Consider fresh for 10 seconds
  });
}
