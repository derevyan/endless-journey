/**
 * Journey Config Hook
 *
 * Fetches a specific journey configuration by ID.
 * Uses the API to respect user-journey permissions.
 * Returns full journey record including mindstateConfig.
 *
 * Moved to shared hooks to break circular dependency (nodes -> builder).
 *
 * Note: Positions are preserved as stored in database.
 * Use the Auto Layout button in edit mode to re-layout nodes.
 *
 * @module hooks/queries/use-journey-config
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api";
import { addHandlePositions } from "@/features/journey/builder/lib/layout";
import { journeyKeys } from "@/shared/lib/query-keys";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

export function useJourneyConfig(journeyId: string | null) {
  return useQuery({
    queryKey: journeyKeys.detail(journeyId || ""),
    queryFn: async () => {
      if (!journeyId) return null;
      const record = await apiClient.getJourneyFullRecord(journeyId);
      // Preserve stored positions, just add React Flow handle positions
      const nodes = addHandlePositions(record.configuration.nodes as JourneyNode[]);
      return {
        nodes,
        edges: record.configuration.edges,
        config: record,
      };
    },
    enabled: !!journeyId,
  });
}
