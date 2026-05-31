/**
 * Media Gallery Hooks
 *
 * Hooks for fetching and managing journey media gallery.
 *
 * @module hooks/queries/use-media-gallery
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notify } from "@/shared/lib/ui/notify";
import { apiClient } from "@/shared/lib/api";
import { uploadKeys } from "@/shared/lib/query-keys";

/**
 * Hook to fetch media gallery for a specific journey
 * @param journeyId - The journey to fetch media for
 */
export function useMediaGallery(journeyId: string | undefined) {
  return useQuery({
    queryKey: uploadKeys.gallery(journeyId ?? ""),
    queryFn: () => (journeyId ? apiClient.getMediaGallery(journeyId) : Promise.resolve([])),
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!journeyId,
  });
}

/**
 * Hook to check if media is in use
 */
export function useCheckMediaUsage() {
  return useMutation({
    mutationFn: (mediaId: string) => apiClient.checkMediaUsage(mediaId),
  });
}

/**
 * Hook to delete media from gallery
 * Returns { success, inUse, usedIn } to allow UI to handle in-use case
 */
export function useDeleteMedia(journeyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mediaId, force = false }: { mediaId: string; force?: boolean }) => apiClient.deleteMedia(mediaId, force),
    onSuccess: (result) => {
      if (result.success && journeyId) {
        queryClient.invalidateQueries({ queryKey: uploadKeys.gallery(journeyId) });
        notify.success("Media deleted");
      }
      // Don't show toast for inUse case - let UI handle it
    },
    onError: (error) => {
      notify.error("Failed to delete media", {
        description: error.message,
      });
    },
  });
}
