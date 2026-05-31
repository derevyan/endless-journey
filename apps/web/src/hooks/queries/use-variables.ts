/**
 * Variable Query Hooks
 *
 * TanStack Query hooks for managing global and journey variables.
 *
 * @module hooks/queries/use-variables
 */

import { useQuery } from "@tanstack/react-query";

import { apiClient, type GlobalVariable, type JourneyVariable } from "@/shared/lib/api";
import { createMutation } from "@/shared/lib/create-mutation";
import { variableKeys } from "@/shared/lib/query-keys";
import { authClient } from "@/shared/lib/auth-client";

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

/**
 * Fetch all global variables for the organization
 */
export function useGlobalVariables() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: variableKeys.global(),
    queryFn: () => apiClient.getGlobalVariables(),
    enabled: !!session,
  });
}

/**
 * Set a global variable (create or update)
 */
export const useSetGlobalVariable = createMutation({
  mutationFn: ({ key, value, description }: { key: string; value: unknown; description?: string }) =>
    apiClient.setGlobalVariable(key, value, description),
  invalidateKeys: variableKeys.global(),
  errorMessage: "Failed to save variable",
});

/**
 * Delete a global variable
 */
export const useDeleteGlobalVariable = createMutation({
  mutationFn: (key: string) => apiClient.deleteGlobalVariable(key),
  invalidateKeys: variableKeys.global(),
  errorMessage: "Failed to delete variable",
});

// =============================================================================
// JOURNEY VARIABLES
// =============================================================================

/**
 * Fetch all variables for a journey
 */
export function useJourneyVariables(journeyId: string | undefined) {
  return useQuery({
    queryKey: variableKeys.journey(journeyId || ""),
    queryFn: () => apiClient.getJourneyVariables(journeyId!),
    enabled: !!journeyId,
  });
}

/**
 * Set a journey variable (create or update)
 */
export const useSetJourneyVariable = createMutation({
  mutationFn: ({
    journeyId,
    key,
    value,
    description,
  }: {
    journeyId: string;
    key: string;
    value: unknown;
    description?: string;
  }) => apiClient.setJourneyVariable(journeyId, key, value, description),
  invalidateKeys: (vars) => variableKeys.journey(vars.journeyId),
  errorMessage: "Failed to save variable",
});

/**
 * Delete a journey variable
 */
export const useDeleteJourneyVariable = createMutation({
  mutationFn: ({ journeyId, key }: { journeyId: string; key: string }) =>
    apiClient.deleteJourneyVariable(journeyId, key),
  invalidateKeys: (vars) => variableKeys.journey(vars.journeyId),
  errorMessage: "Failed to delete variable",
});

// Re-export types for convenience
export type { GlobalVariable, JourneyVariable };
