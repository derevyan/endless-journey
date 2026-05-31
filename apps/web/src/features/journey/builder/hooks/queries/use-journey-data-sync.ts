/**
 * useJourneyDataSync - Syncs journey nodes/edges to editor store
 *
 * This hook handles:
 * - Syncing visualization data changes to editor store
 * - Preserving user edits in edit mode
 */
import { useEffect, useRef } from "react";

import type { JourneyConfig, JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";

interface JourneyDataSyncConfig {
  journeyNodes: JourneyNode[];
  journeyEdges: JourneyEdge[];
  selectedJourneySlug: string | null;
  isEditMode: boolean;
  setCurrentData: (data: JourneyConfig, resetPendingChanges?: boolean) => void;
}

/**
 * Sync journey visualization data to editor store
 *
 * Features:
 * - Uses refs to prevent infinite loops
 * - Preserves user edits when in edit mode
 */
export function useJourneyDataSync(config: JourneyDataSyncConfig): void {
  const { journeyNodes, journeyEdges, selectedJourneySlug, isEditMode, setCurrentData } = config;

  // Refs to track previous state and prevent unnecessary syncs
  const prevJourneyNodesRef = useRef<string>("");
  const prevJourneyEdgesRef = useRef<string>("");
  const prevJourneySlugRef = useRef<string | null>(null);

  useEffect(() => {
    // Create comparison keys including visualization data
    const nodesKey = JSON.stringify(
      journeyNodes.map((n) => ({
        id: n.id,
        journeyVisited: n.data?.journeyVisited,
        journeyCurrent: n.data?.journeyCurrent,
        journeyDroppedOff: n.data?.journeyDroppedOff,
      }))
    );
    const edgesKey = JSON.stringify(
      journeyEdges.map((e) => ({
        id: e.id,
        animated: e.animated,
        style: e.style,
      }))
    );

    // Only sync if data has changed
    if (nodesKey === prevJourneyNodesRef.current && edgesKey === prevJourneyEdgesRef.current) {
      return;
    }

    // Skip if no nodes loaded
    if (journeyNodes.length === 0) {
      return;
    }

    // Build current API config
    const apiConfig: JourneyConfig = {
      nodes: journeyNodes as JourneyConfig["nodes"],
      edges: journeyEdges,
    };

    // Reset pending changes when journey changes (new journey selected)
    const journeyChanged = selectedJourneySlug !== prevJourneySlugRef.current;
    const shouldResetPendingChanges = journeyChanged || !isEditMode;

    setCurrentData(apiConfig, shouldResetPendingChanges);

    // Update refs
    prevJourneyNodesRef.current = nodesKey;
    prevJourneyEdgesRef.current = edgesKey;
    prevJourneySlugRef.current = selectedJourneySlug;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyNodes, journeyEdges, isEditMode, selectedJourneySlug]);
}
