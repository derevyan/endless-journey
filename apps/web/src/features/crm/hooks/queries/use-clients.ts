/**
 * CRM Client Query Hooks
 *
 * TanStack Query hooks for client operations including tags.
 * Uses createMutation for standardized error handling and cache invalidation.
 *
 * @module hooks/queries/crm/use-clients
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";

import {
  crmClientsApi,
  crmClientTagsApi,
  type ClientFilters,
} from "@/shared/lib/api";
import { crmKeys } from "@/shared/lib/query-keys";
import { createMutation } from "@/shared/lib/create-mutation";

/**
 * Fetch clients with CRM data
 */
export function useCrmClients(filters: ClientFilters = {}, limit = 50, offset = 0) {
  return useQuery({
    queryKey: crmKeys.clients(filters),
    queryFn: () => crmClientsApi.getClients(filters, limit, offset),
    placeholderData: keepPreviousData, // Keep showing old data while fetching new
  });
}

/**
 * Fetch a single client profile
 */
export function useCrmClient(clientId: string | undefined) {
  return useQuery({
    queryKey: crmKeys.client(clientId || ""),
    queryFn: () => crmClientsApi.getClient(clientId!),
    enabled: !!clientId,
  });
}

/**
 * Update a client's stage (silent - no success message for kanban drag)
 */
export const useUpdateClientStage = createMutation({
  mutationFn: ({ clientId, stageId }: { clientId: string; stageId: string | null }) =>
    crmClientsApi.updateClientStage(clientId, stageId),
  invalidateKeys: (vars) => [crmKeys.clients(), crmKeys.client(vars.clientId)],
  errorMessage: "Failed to update stage",
});

/**
 * Update a client's custom fields
 */
export const useUpdateClientFields = createMutation({
  mutationFn: ({ clientId, fields }: { clientId: string; fields: Record<string, unknown> }) =>
    crmClientsApi.updateClientFields(clientId, fields),
  invalidateKeys: (vars) => crmKeys.client(vars.clientId),
  successMessage: "Fields updated",
  errorMessage: "Failed to update fields",
});

/**
 * Fetch client activity timeline
 */
export function useCrmClientTimeline(clientId: string | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: crmKeys.clientTimeline(clientId || ""),
    queryFn: () => crmClientsApi.getClientTimeline(clientId!, limit, offset),
    enabled: !!clientId,
  });
}

// =============================================================================
// CLIENT TAGS
// =============================================================================

/**
 * Add a tag to a client
 */
export const useAddClientTag = createMutation({
  mutationFn: ({ clientId, tag }: { clientId: string; tag: string }) =>
    crmClientTagsApi.addTag(clientId, tag),
  invalidateKeys: (vars) => [crmKeys.client(vars.clientId), crmKeys.clients()],
  successMessage: "Tag added",
  errorMessage: "Failed to add tag",
});

/**
 * Remove a tag from a client
 */
export const useRemoveClientTag = createMutation({
  mutationFn: ({ clientId, tag }: { clientId: string; tag: string }) =>
    crmClientTagsApi.removeTag(clientId, tag),
  invalidateKeys: (vars) => [crmKeys.client(vars.clientId), crmKeys.clients()],
  successMessage: "Tag removed",
  errorMessage: "Failed to remove tag",
});
