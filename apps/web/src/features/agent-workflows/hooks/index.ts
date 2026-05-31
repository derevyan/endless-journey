/**
 * Agent Workflow Hooks
 *
 * TanStack Query hooks for agent workflow operations.
 * Uses createMutation for standardized error handling and cache invalidation.
 *
 * @module features/agent-workflows/hooks
 */

export { useAgentWorkflowKeyboardShortcuts } from "./use-agent-workflow-keyboard-shortcuts";
export {
  useToolDefinitions,
  useToolDefinitionsByCategory,
  useToolDefinitionsWithUtils,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type ToolDefinition,
  type ToolSource,
  type ToolCategory,
  type RequiredService,
  type UseToolDefinitionsResult,
} from "./use-tool-definitions";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentWorkflowKeys } from "@/shared/lib/query-keys";
import { workflowsApi, type CreateWorkflowInput, type UpdateWorkflowInput } from "@/shared/lib/api/workflows";
import { workflowVersionsApi } from "@/shared/lib/api/workflow-versions";
import { createMutation } from "@/shared/lib/create-mutation";
import type { SaveWorkflowVersionInput } from "@journey/schemas";

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * List all agent workflows for the organization
 */
export function useAgentWorkflows(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: agentWorkflowKeys.list(filters),
    queryFn: () => workflowsApi.list(filters),
  });
}

/**
 * Get a single agent workflow by key
 */
export function useAgentWorkflow(key: string | undefined) {
  return useQuery({
    queryKey: agentWorkflowKeys.detail(key ?? ""),
    queryFn: () => (key ? workflowsApi.get(key) : null),
    enabled: !!key,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Create a new agent workflow
 */
export const useCreateAgentWorkflow = createMutation({
  mutationFn: (input: CreateWorkflowInput) => workflowsApi.create(input),
  invalidateKeys: agentWorkflowKeys.all,
  errorMessage: "Failed to create workflow",
});

/**
 * Update an existing agent workflow
 * Note: Uses direct useMutation for setQueryData optimization (avoid refetch race condition)
 */
export function useUpdateAgentWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: UpdateWorkflowInput }) =>
      workflowsApi.update(key, input),
    onSuccess: (data) => {
      // Set data directly instead of invalidating to avoid refetch race condition
      // (refetch triggers React Flow's onNodesChange which sets isDirty)
      queryClient.setQueryData(agentWorkflowKeys.detail(data.key), data);
      // Only invalidate lists (for updated timestamps in list view)
      queryClient.invalidateQueries({ queryKey: agentWorkflowKeys.list() });
    },
  });
}

/**
 * Delete (archive) an agent workflow
 */
export const useDeleteAgentWorkflow = createMutation({
  mutationFn: (key: string) => workflowsApi.delete(key),
  invalidateKeys: agentWorkflowKeys.all,
  errorMessage: "Failed to delete workflow",
});

/**
 * Execute an agent workflow for testing
 * Note: No cache invalidation needed, results are handled by the test panel
 */
export function useExecuteAgentWorkflow() {
  return useMutation({
    mutationFn: ({
      key,
      message,
      conversationId,
      conversationHistory,
      mockLlm,
      startNodeId,
      mockContext,
    }: {
      key: string;
      message: string;
      conversationId?: string;
      conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
      /** Force mock LLM responses for testing. */
      mockLlm?: boolean;
      /** Optional node ID to start execution from (for testing specific parts) */
      startNodeId?: string;
      mockContext?: Record<string, unknown>;
    }) => workflowsApi.execute(key, { message, conversationId, conversationHistory, mockLlm, startNodeId, mockContext }),
  });
}

/**
 * Validate an agent workflow configuration
 * Note: No cache invalidation needed, validation results are ephemeral
 */
export function useValidateAgentWorkflow() {
  return useMutation({
    mutationFn: ({
      key,
      nodes,
      edges,
    }: {
      key: string;
      nodes: Parameters<typeof workflowsApi.validate>[1];
      edges: Parameters<typeof workflowsApi.validate>[2];
    }) => workflowsApi.validate(key, nodes, edges),
  });
}

// =============================================================================
// VERSION HOOKS
// =============================================================================

/**
 * Get all versions for an agent workflow
 */
export function useAgentWorkflowVersions(workflowKey: string | undefined) {
  return useQuery({
    queryKey: agentWorkflowKeys.versions(workflowKey ?? ""),
    queryFn: () => (workflowKey ? workflowVersionsApi.list(workflowKey) : []),
    enabled: !!workflowKey,
  });
}

/**
 * Save a new version of an agent workflow
 */
export const useSaveAgentWorkflowVersion = createMutation({
  mutationFn: ({ workflowKey, input }: { workflowKey: string; input: SaveWorkflowVersionInput }) =>
    workflowVersionsApi.save(workflowKey, input),
  invalidateKeys: (vars) => agentWorkflowKeys.versions(vars.workflowKey),
  errorMessage: "Failed to save version",
});

/**
 * Get a specific version of an agent workflow
 */
export function useAgentWorkflowVersion(workflowKey: string | undefined, versionId: string | undefined) {
  return useQuery({
    queryKey: agentWorkflowKeys.version(workflowKey ?? "", versionId ?? ""),
    queryFn: () =>
      workflowKey && versionId ? workflowVersionsApi.get(workflowKey, versionId) : null,
    enabled: !!workflowKey && !!versionId,
  });
}

/**
 * Delete a version of an agent workflow
 */
export const useDeleteAgentWorkflowVersion = createMutation({
  mutationFn: ({ workflowKey, versionId }: { workflowKey: string; versionId: string }) =>
    workflowVersionsApi.delete(workflowKey, versionId),
  invalidateKeys: (vars) => agentWorkflowKeys.versions(vars.workflowKey),
  errorMessage: "Failed to delete version",
});
