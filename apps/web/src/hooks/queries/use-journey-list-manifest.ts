/**
 * Journey List Manifest Hook
 *
 * Fetches the list of journeys accessible to the current authenticated user.
 * Uses the API to respect user-journey permissions.
 *
 * Moved to shared hooks to break circular dependency (nodes -> builder).
 *
 * @module hooks/queries/use-journey-list-manifest
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api";
import { journeyKeys } from "@/shared/lib/query-keys";
import { authClient } from "@/shared/lib/auth-client";

export function useJourneyListManifest() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: journeyKeys.list(),
    queryFn: () => apiClient.getJourneys(),
    enabled: !!session,
  });
}
