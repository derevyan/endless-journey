/**
 * Mutation Factory
 *
 * Creates standardized TanStack Query mutations with consistent error handling
 * and cache invalidation patterns.
 *
 * @module lib/create-mutation
 */

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { notify } from "@/shared/lib/ui/notify";

interface CreateMutationOptions<TData, TVariables> {
  /** The mutation function to execute */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query keys to invalidate on success. Can be a single key, array of keys, or a function that receives variables */
  invalidateKeys?:
    | QueryKey
    | QueryKey[]
    | ((variables: TVariables) => QueryKey | QueryKey[]);
  /** Error message to display in toast notification */
  errorMessage: string;
  /** Success message to display (optional) */
  successMessage?: string;
  /** Custom onSuccess callback (runs after cache invalidation) */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Custom onError callback (runs after toast notification) */
  onError?: (error: Error, variables: TVariables) => void;
}

/**
 * Creates a mutation hook with standardized error handling and cache invalidation.
 *
 * @example
 * ```ts
 * // Simple usage with static invalidation
 * export const useAddTag = createMutation({
 *   mutationFn: (data: { tag: string }) => apiClient.addGlobalTag(data.tag),
 *   invalidateKeys: tagKeys.global(),
 *   errorMessage: "Failed to add tag",
 * });
 *
 * // With dynamic invalidation based on variables
 * export const useAddJourneyTag = createMutation({
 *   mutationFn: (data: { journeyId: string; tag: string }) =>
 *     apiClient.addJourneyTag(data.journeyId, data.tag),
 *   invalidateKeys: (vars) => tagKeys.journey(vars.journeyId),
 *   errorMessage: "Failed to add tag",
 * });
 *
 * // With success message
 * export const useDeleteVariable = createMutation({
 *   mutationFn: (key: string) => apiClient.deleteGlobalVariable(key),
 *   invalidateKeys: variableKeys.global(),
 *   errorMessage: "Failed to delete variable",
 *   successMessage: "Variable deleted",
 * });
 * ```
 */
export function createMutation<TData, TVariables>({
  mutationFn,
  invalidateKeys,
  errorMessage,
  successMessage,
  onSuccess: customOnSuccess,
  onError: customOnError,
}: CreateMutationOptions<TData, TVariables>) {
  return function useMutationHook() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn,
      onSuccess: (data, variables) => {
        // Invalidate cache
        if (invalidateKeys) {
          const keys =
            typeof invalidateKeys === "function"
              ? invalidateKeys(variables)
              : invalidateKeys;

          const keyArray = Array.isArray(keys[0]) ? (keys as QueryKey[]) : [keys as QueryKey];

          keyArray.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }

        // Show success toast if provided
        if (successMessage) {
          notify.success(successMessage);
        }

        // Call custom callback
        customOnSuccess?.(data, variables);
      },
      onError: (error: Error, variables) => {
        notify.error(errorMessage, { description: error.message });
        customOnError?.(error, variables);
      },
    });
  };
}

/**
 * Type helper for extracting mutation variables from a mutation hook
 */
export type MutationVariables<T> = T extends () => { mutate: (vars: infer V) => void }
  ? V
  : never;
