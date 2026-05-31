/**
 * Prompts Hooks
 *
 * TanStack Query hooks for prompt repository operations.
 * Uses createMutation for standardized error handling and cache invalidation.
 *
 * @module features/prompts/hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { promptKeys } from "@/shared/lib/query-keys";
import {
  promptsApi,
  promptVersionsApi,
  promptCompileApi,
  type CreatePromptInput,
  type UpdatePromptInput,
  type CreateVersionInput,
  type UpdateLabelsInput,
  type CompilePromptInput,
  type PromptFilters,
} from "@/shared/lib/api";
import { createMutation } from "@/shared/lib/create-mutation";

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * List all prompts with optional filters
 */
export function usePrompts(filters?: PromptFilters) {
  return useQuery({
    queryKey: promptKeys.list(filters),
    queryFn: () => promptsApi.list(filters),
  });
}

/**
 * Get a single prompt by name
 */
export function usePrompt(name: string | undefined) {
  return useQuery({
    queryKey: promptKeys.detail(name ?? ""),
    queryFn: () => (name ? promptsApi.get(name) : null),
    enabled: !!name,
  });
}

/**
 * List all versions for a prompt
 */
export function usePromptVersions(promptName: string | undefined) {
  return useQuery({
    queryKey: promptKeys.versions(promptName ?? ""),
    queryFn: () => (promptName ? promptVersionsApi.list(promptName) : []),
    enabled: !!promptName,
  });
}

/**
 * Get a specific version of a prompt
 */
export function usePromptVersion(promptName: string | undefined, versionId: string | undefined) {
  return useQuery({
    queryKey: promptKeys.version(promptName ?? "", versionId ?? ""),
    queryFn: () =>
      promptName && versionId ? promptVersionsApi.get(promptName, versionId) : null,
    enabled: !!promptName && !!versionId,
  });
}

/**
 * Get variables used in a prompt
 */
export function usePromptVariables(
  promptName: string | undefined,
  options?: { label?: string; versionId?: string }
) {
  return useQuery({
    queryKey: promptKeys.variables(promptName ?? "", options?.versionId),
    queryFn: () => (promptName ? promptCompileApi.getVariables(promptName, options) : null),
    enabled: !!promptName,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Create a new prompt with initial version
 */
export const useCreatePrompt = createMutation({
  mutationFn: (input: CreatePromptInput) => promptsApi.create(input),
  invalidateKeys: promptKeys.all,
  errorMessage: "Failed to create prompt",
});

/**
 * Update prompt metadata (description, tags)
 */
export const useUpdatePrompt = createMutation({
  mutationFn: ({ name, input }: { name: string; input: UpdatePromptInput }) =>
    promptsApi.update(name, input),
  invalidateKeys: (vars) => [promptKeys.detail(vars.name), promptKeys.list()],
  errorMessage: "Failed to update prompt",
});

/**
 * Delete (soft) a prompt
 */
export const useDeletePrompt = createMutation({
  mutationFn: (name: string) => promptsApi.delete(name),
  invalidateKeys: promptKeys.all,
  errorMessage: "Failed to delete prompt",
  successMessage: "Prompt deleted",
});

/**
 * Create a new version of a prompt
 */
export const useCreatePromptVersion = createMutation({
  mutationFn: ({ promptName, input }: { promptName: string; input: CreateVersionInput }) =>
    promptVersionsApi.create(promptName, input),
  invalidateKeys: (vars) => [
    promptKeys.versions(vars.promptName),
    promptKeys.detail(vars.promptName),
    promptKeys.variables(vars.promptName),
  ],
  errorMessage: "Failed to create version",
  // Note: No successMessage - callers show their own notification ("New version saved")
});

/**
 * Update version labels (production, latest, etc.)
 */
export function useUpdatePromptLabels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      promptName,
      versionId,
      input,
    }: {
      promptName: string;
      versionId: string;
      input: UpdateLabelsInput;
    }) => promptVersionsApi.updateLabels(promptName, versionId, input),
    onSuccess: (_data, variables) => {
      // Invalidate all version queries for this prompt (labels may have moved)
      queryClient.invalidateQueries({ queryKey: promptKeys.versions(variables.promptName) });
      // Also invalidate detail (it includes productionVersion/latestVersion)
      queryClient.invalidateQueries({ queryKey: promptKeys.detail(variables.promptName) });
    },
  });
}

/**
 * Delete a version of a prompt
 */
export const useDeletePromptVersion = createMutation({
  mutationFn: ({ promptName, versionId }: { promptName: string; versionId: string }) =>
    promptVersionsApi.delete(promptName, versionId),
  invalidateKeys: (vars) => promptKeys.versions(vars.promptName),
  errorMessage: "Failed to delete version",
  successMessage: "Version deleted",
});

// =============================================================================
// COMPILE/PLAYGROUND HOOKS
// =============================================================================

/**
 * Compile a prompt with variables (for playground)
 */
export function useCompilePrompt() {
  return useMutation({
    mutationFn: ({ promptName, input }: { promptName: string; input: CompilePromptInput }) =>
      promptCompileApi.compile(promptName, input),
  });
}

/**
 * Get compiled prompt content (without running LLM)
 */
export function useCompiledPrompt(promptName: string | undefined, label = "production") {
  return useQuery({
    queryKey: [...promptKeys.detail(promptName ?? ""), "compiled", label],
    queryFn: () => (promptName ? promptCompileApi.getCompiled(promptName, label) : null),
    enabled: !!promptName,
  });
}
