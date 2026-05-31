/**
 * Client Mindstates Query Hook
 *
 * Fetches all mindstates for a specific client.
 */
import { useQuery } from "@tanstack/react-query";
import { mindstateKeys } from "@/shared/lib/query-keys";
import { mindstateClientsApi } from "@/shared/lib/api/mindstate";

export function useClientMindstates(clientId: string) {
  return useQuery({
    queryKey: mindstateKeys.client(clientId),
    queryFn: () => mindstateClientsApi.list(clientId),
    enabled: !!clientId,
  });
}
