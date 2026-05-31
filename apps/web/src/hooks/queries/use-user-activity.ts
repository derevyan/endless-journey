import { useQuery } from "@tanstack/react-query";

import { apiClient, type UserActivityEntry } from "@/shared/lib/api";
import { filterActivityEvents } from "@/shared/lib/activity-filters";

export function useUserActivity(userId: string | undefined, limit = 200) {
  return useQuery<UserActivityEntry[]>({
    queryKey: ["user-activity", userId, limit],
    queryFn: () => apiClient.getTelegramUserActivity(userId!, limit),
    enabled: !!userId,
    select: filterActivityEvents,
  });
}
