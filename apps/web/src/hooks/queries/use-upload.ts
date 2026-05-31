/**
 * Upload Mutation Hook
 *
 * TanStack Query mutation for uploading media files.
 *
 * @module hooks/queries/use-upload
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type UploadResponse } from "@/shared/lib/api";
import { uploadKeys } from "@/shared/lib/query-keys";

interface UploadParams {
  file: File;
  journeyId: string;
}

/**
 * Hook to upload a media file to a specific journey
 *
 * @example
 * import { createLogger, serializeError } from "@journey/logger";
 * const log = createLogger("upload");
 *
 * const { mutate: upload, isPending } = useUpload();
 * upload({ file, journeyId }, {
 *   onSuccess: (data) => log.info({ url: data.url }, "upload:success"),
 *   onError: (err) => log.error({ err: serializeError(err) }, "upload:failed"),
 * });
 */
export function useUpload() {
  const queryClient = useQueryClient();

  return useMutation<UploadResponse, Error, UploadParams>({
    mutationFn: ({ file, journeyId }) => apiClient.uploadFile(file, journeyId),
    onSuccess: (_, { journeyId }) => {
      // Invalidate gallery for this journey to include the new upload
      queryClient.invalidateQueries({ queryKey: uploadKeys.gallery(journeyId) });
    },
  });
}

