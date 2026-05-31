/**
 * Mindstate Definition Hook
 *
 * TanStack Query hook for fetching a single mindstate definition.
 */

import { useQuery } from "@tanstack/react-query";
import { mindstateKeys } from "@/shared/lib/query-keys";
import { mindstateDefinitionsApi } from "@/shared/lib/api/mindstate";

/**
 * Hook for fetching a single mindstate definition by key or ID
 */
export function useMindstateDefinition(keyOrId: string | undefined) {
  return useQuery({
    queryKey: keyOrId ? mindstateKeys.definition(keyOrId) : ["mindstate", "definition", "disabled"],
    queryFn: () => mindstateDefinitionsApi.get(keyOrId!),
    enabled: !!keyOrId,
  });
}
