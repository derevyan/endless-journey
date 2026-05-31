/**
 * Channel Query Hooks
 *
 * TanStack Query hooks for messaging channel management (Telegram/WhatsApp channels).
 *
 * @module hooks/queries/use-channels
 */

import { useQuery } from "@tanstack/react-query";

import { apiClient, type Channel } from "@/shared/lib/api";
import { createMutation } from "@/shared/lib/create-mutation";
import { channelKeys } from "@/shared/lib/query-keys";
import { authClient } from "@/shared/lib/auth-client";

/**
 * Fetch all channels for the current user
 */
export function useChannels() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: channelKeys.list(),
    queryFn: () => apiClient.getChannels(),
    enabled: !!session,
  });
}

/**
 * Create a new channel
 */
export const useCreateChannel = createMutation({
  mutationFn: (botToken: string) => apiClient.createChannel(botToken),
  invalidateKeys: channelKeys.all,
  errorMessage: "Failed to create channel",
});

/**
 * Update a channel
 */
export const useUpdateChannel = createMutation({
  mutationFn: ({
    channelId,
    data,
  }: {
    channelId: string;
    data: { defaultJourneyId?: string | null; isActive?: boolean; botName?: string };
  }) => apiClient.updateChannel(channelId, data),
  invalidateKeys: channelKeys.all,
  errorMessage: "Failed to update channel",
});

/**
 * Delete a channel
 */
export const useDeleteChannel = createMutation({
  mutationFn: (channelId: string) => apiClient.deleteChannel(channelId),
  invalidateKeys: channelKeys.all,
  errorMessage: "Failed to delete channel",
});

/**
 * Re-register webhook for a channel
 */
export const useRefreshChannelWebhook = createMutation({
  mutationFn: (channelId: string) => apiClient.reregisterChannelWebhook(channelId),
  invalidateKeys: channelKeys.all,
  errorMessage: "Failed to refresh webhook",
});

// Re-export Channel type for convenience
export type { Channel };
