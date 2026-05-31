/**
 * CRM Pipeline Query Hooks
 *
 * TanStack Query hooks for pipeline operations.
 * Uses createMutation for standardized error handling and cache invalidation.
 *
 * @module hooks/queries/crm/use-pipelines
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  crmPipelinesApi,
  type CreatePipelineInput,
  type UpdatePipelineInput,
} from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { crmKeys } from "@/shared/lib/query-keys";
import { createMutation } from "@/shared/lib/create-mutation";

/**
 * Fetch all pipelines
 */
export function useCrmPipelines() {
  return useQuery({
    queryKey: crmKeys.pipelines(),
    queryFn: () => crmPipelinesApi.getPipelines(),
  });
}

/**
 * Fetch a single pipeline
 */
export function useCrmPipeline(pipelineId: string | undefined) {
  return useQuery({
    queryKey: crmKeys.pipeline(pipelineId || ""),
    queryFn: () => crmPipelinesApi.getPipeline(pipelineId!),
    enabled: !!pipelineId,
  });
}

/**
 * Create a pipeline
 */
export const useCreateCrmPipeline = createMutation({
  mutationFn: (input: CreatePipelineInput) => crmPipelinesApi.createPipeline(input),
  invalidateKeys: crmKeys.pipelines(),
  errorMessage: "Failed to create pipeline",
});

/**
 * Update a pipeline
 */
export const useUpdateCrmPipeline = createMutation({
  mutationFn: ({ pipelineId, input }: { pipelineId: string; input: UpdatePipelineInput }) =>
    crmPipelinesApi.updatePipeline(pipelineId, input),
  invalidateKeys: (vars) => [crmKeys.pipelines(), crmKeys.pipeline(vars.pipelineId)],
  successMessage: "Pipeline updated",
  errorMessage: "Failed to update pipeline",
});

/**
 * Delete a pipeline
 */
export const useDeleteCrmPipeline = createMutation({
  mutationFn: (pipelineId: string) => crmPipelinesApi.deletePipeline(pipelineId),
  invalidateKeys: [crmKeys.pipelines(), crmKeys.stages()],
  errorMessage: "Failed to delete pipeline",
});

/**
 * Reorder pipelines
 * Note: Uses direct useMutation for onMutate optimistic updates (cancel queries)
 */
export function useReorderCrmPipelines() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pipelineIds: string[]) => crmPipelinesApi.reorderPipelines(pipelineIds),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: crmKeys.pipelines() });
    },
    onError: (error: Error) => {
      notify.error("Failed to reorder pipelines", { description: error.message });
      queryClient.invalidateQueries({ queryKey: crmKeys.pipelines() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.pipelines() });
    },
  });
}

/**
 * Set a pipeline as default
 */
export const useSetDefaultPipeline = createMutation({
  mutationFn: (pipelineId: string) => crmPipelinesApi.setDefaultPipeline(pipelineId),
  invalidateKeys: crmKeys.pipelines(),
  successMessage: "Default pipeline updated",
  errorMessage: "Failed to set default pipeline",
});
