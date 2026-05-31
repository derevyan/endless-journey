/**
 * Mindstate Definition Mutations
 *
 * API mutation hooks for creating, updating, deleting, and previewing mindstate definitions.
 * Uses the createMutation helper for standardized error handling and cache invalidation.
 *
 * @module features/mindstate/hooks/mutations/use-mindstate-mutations
 */

import { createMutation } from "@/shared/lib/create-mutation";
import { mindstateDefinitionsApi } from "@/shared/lib/api/mindstate";
import { mindstateKeys } from "@/shared/lib/query-keys";
import type {
  CreateMindstateDefinitionInput,
  UpdateMindstateDefinitionInput,
  MindstateDefinition,
} from "@journey/schemas";
import type {
  PreviewAnalysisInput,
  PreviewAnalysisResult,
} from "@/shared/lib/api/mindstate";

// Re-export for convenience
export type { PreviewAnalysisInput, PreviewAnalysisResult };

/**
 * Create a new mindstate definition
 */
export const useCreateDefinition = createMutation({
  mutationFn: (input: CreateMindstateDefinitionInput): Promise<MindstateDefinition> =>
    mindstateDefinitionsApi.create(input),
  invalidateKeys: () => mindstateKeys.definitions(),
  successMessage: "Definition created",
  errorMessage: "Failed to create definition",
});

/**
 * Update an existing mindstate definition
 */
export const useUpdateDefinition = createMutation({
  mutationFn: ({ key, input }: { key: string; input: UpdateMindstateDefinitionInput }) =>
    mindstateDefinitionsApi.update(key, input),
  invalidateKeys: (vars: { key: string; input: UpdateMindstateDefinitionInput }) => [
    mindstateKeys.definitions(),
    mindstateKeys.definition(vars.key),
  ],
  successMessage: "Definition saved",
  errorMessage: "Failed to save definition",
});

/**
 * Delete a mindstate definition
 */
export const useDeleteDefinition = createMutation({
  mutationFn: (key: string) => mindstateDefinitionsApi.delete(key),
  invalidateKeys: () => mindstateKeys.definitions(),
  errorMessage: "Failed to delete definition",
});

/**
 * Preview analyze - test the mindstate pipeline without persisting
 */
export const usePreviewAnalyze = createMutation({
  mutationFn: ({ key, input }: { key: string; input: PreviewAnalysisInput }): Promise<PreviewAnalysisResult> =>
    mindstateDefinitionsApi.previewAnalyze(key, input),
  // No cache invalidation - preview doesn't affect persisted data
  errorMessage: "Analysis failed",
});
