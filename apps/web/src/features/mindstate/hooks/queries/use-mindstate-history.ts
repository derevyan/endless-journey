/**
 * Mindstate History Query Hook
 *
 * Fetches analysis history for a client's mindstate.
 */
import { useQuery } from "@tanstack/react-query";
import { mindstateKeys } from "@/shared/lib/query-keys";
import { mindstateClientsApi } from "@/shared/lib/api/mindstate";

export function useMindstateHistory(clientId: string, key: string, limit = 50) {
  return useQuery({
    queryKey: mindstateKeys.history(clientId, key),
    queryFn: () => mindstateClientsApi.getHistory(clientId, key, limit),
    enabled: !!clientId && !!key,
  });
}
