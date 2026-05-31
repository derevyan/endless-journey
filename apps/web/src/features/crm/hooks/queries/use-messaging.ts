/**
 * CRM Messaging Query Hooks
 *
 * TanStack Query hooks for direct messaging operations.
 *
 * @module hooks/queries/crm/use-messaging
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  crmMessagesApi,
  type SendMessageInput,
} from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { crmKeys } from "@/shared/lib/query-keys";

/**
 * Fetch client message history
 */
export function useCrmClientMessages(clientId: string | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: crmKeys.clientMessages(clientId || ""),
    queryFn: () => crmMessagesApi.getMessages(clientId!, limit, offset),
    enabled: !!clientId,
  });
}

/**
 * Send a direct message to a client
 */
export function useSendCrmMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, input }: { clientId: string; input: SendMessageInput }) =>
      crmMessagesApi.sendMessage(clientId, input),
    onSuccess: (result, { clientId }) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: crmKeys.clientMessages(clientId) });
        queryClient.invalidateQueries({ queryKey: crmKeys.clientTimeline(clientId) });
        notify.success("Message sent");
      } else {
        notify.error("Failed to send message", { description: result.error });
      }
    },
    onError: (error) => {
      notify.error("Failed to send message", { description: error.message });
    },
  });
}
