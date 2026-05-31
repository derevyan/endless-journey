/**
 * CRM Stage Query Hooks
 *
 * TanStack Query hooks for pipeline stage operations.
 * Uses createMutation for standardized error handling and cache invalidation.
 *
 * @module hooks/queries/crm/use-stages
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  crmStagesApi,
  type CreateStageInput,
  type UpdateStageInput,
} from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { crmKeys } from "@/shared/lib/query-keys";
import { createMutation } from "@/shared/lib/create-mutation";

/**
 * Fetch all pipeline stages
 */
export function useCrmStages(pipelineId?: string) {
  return useQuery({
    queryKey: crmKeys.stages(pipelineId),
    queryFn: () => crmStagesApi.getStages(pipelineId),
  });
}

/**
 * Create a pipeline stage
 */
export const useCreateCrmStage = createMutation({
  mutationFn: (input: CreateStageInput) => crmStagesApi.createStage(input),
  invalidateKeys: crmKeys.stages(),
  errorMessage: "Failed to create stage",
});

/**
 * Update a pipeline stage
 */
export const useUpdateCrmStage = createMutation({
  mutationFn: ({ stageId, input }: { stageId: string; input: UpdateStageInput }) =>
    crmStagesApi.updateStage(stageId, input),
  invalidateKeys: crmKeys.stages(),
  successMessage: "Stage updated",
  errorMessage: "Failed to update stage",
});

/**
 * Delete a pipeline stage
 */
export const useDeleteCrmStage = createMutation({
  mutationFn: (stageId: string) => crmStagesApi.deleteStage(stageId),
  invalidateKeys: [crmKeys.stages(), crmKeys.clients()],
  errorMessage: "Failed to delete stage",
});

/**
 * Reorder pipeline stages with optimistic updates
 * Note: Uses direct useMutation for onMutate optimistic updates (cancel queries)
 */
export function useReorderCrmStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pipelineId, stageIds }: { pipelineId: string; stageIds: string[] }) =>
      crmStagesApi.reorderStages(pipelineId, stageIds),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: crmKeys.stages() });
    },
    onError: (error: Error) => {
      notify.error("Failed to reorder stages", { description: error.message });
      queryClient.invalidateQueries({ queryKey: crmKeys.stages() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.stages() });
    },
  });
}
