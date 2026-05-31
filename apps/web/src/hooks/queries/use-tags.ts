/**
 * Tags Query Hooks
 *
 * TanStack Query hooks for managing organization-wide tags.
 * Tags are stored in client_tags table and follow users across all journeys.
 *
 * @module hooks/queries/use-tags
 */

import { useQuery } from "@tanstack/react-query";

import { apiClient, type GlobalTag } from "@/shared/lib/api";
import { createMutation } from "@/shared/lib/create-mutation";
import { tagKeys } from "@/shared/lib/query-keys";
import { authClient } from "@/shared/lib/auth-client";

// =============================================================================
// TAGS
// =============================================================================

/**
 * Fetch all tags for the organization
 */
export function useTags() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: tagKeys.global(),
    queryFn: () => apiClient.getTags(),
    enabled: !!session,
  });
}

/**
 * Add a tag
 */
export const useAddTag = createMutation({
  mutationFn: ({ tag, description, color }: { tag: string; description?: string; color?: string }) =>
    apiClient.addTag(tag, description, color),
  invalidateKeys: tagKeys.global(),
  errorMessage: "Failed to add tag",
});

/**
 * Update a tag
 */
export const useUpdateTag = createMutation({
  mutationFn: ({ tag, description, color }: { tag: string; description?: string; color?: string }) =>
    apiClient.updateTag(tag, description, color),
  invalidateKeys: tagKeys.global(),
  errorMessage: "Failed to update tag",
});

/**
 * Remove a tag
 */
export const useRemoveTag = createMutation({
  mutationFn: (tag: string) => apiClient.removeTag(tag),
  invalidateKeys: tagKeys.global(),
  errorMessage: "Failed to remove tag",
});

// Re-export types for convenience
export type { GlobalTag };
