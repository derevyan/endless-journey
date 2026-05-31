/**
 * Mindstate Definitions Query Hook
 *
 * Fetches all mindstate definitions for the organization.
 */
import { useQuery } from "@tanstack/react-query";
import { mindstateKeys } from "@/shared/lib/query-keys";
import { mindstateDefinitionsApi } from "@/shared/lib/api/mindstate";

export function useMindstateDefinitions() {
  return useQuery({
    queryKey: mindstateKeys.definitions(),
    queryFn: () => mindstateDefinitionsApi.list(),
  });
}
