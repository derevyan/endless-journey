/**
 * useJourneyVisualization - Journey visualization and state management
 *
 * This hook manages the visual representation of a journey on the canvas,
 * including node/edge loading and layout.
 */
import { useJourneyConfig } from "@/hooks/queries";
import type { CustomJourneyData } from "@/features/journey/builder/store/custom-journey-store";
import { addHandlePositions } from "../lib/layout";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { createLogger } from "@journey/logger";
import { useEffect, useMemo, useState } from "react";
import { normalizeEdges } from "../lib/journey-visualization-utils";

export interface UseJourneyVisualizationResult {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  loading: boolean;
  error: Error | null;
}

export function useJourneyVisualization(
  journeyId: string | null,
  customJourneys?: Record<string, CustomJourneyData>
): UseJourneyVisualizationResult {
  const [nodes, setNodes] = useState<JourneyNode[]>([]);
  const [edges, setEdges] = useState<JourneyEdge[]>([]);
  const log = useMemo(() => createLogger("use-journey-visualization", { journeyId }), [journeyId]);

  // Use query hooks for data fetching
  const custom = journeyId ? customJourneys?.[journeyId] : undefined;
  const journeyConfigQuery = useJourneyConfig(custom ? null : journeyId);

  // Determine loading and error states
  const loading = custom ? false : journeyConfigQuery.isLoading;
  const error = custom ? null : journeyConfigQuery.error;

  // Initialize nodes/edges from query or custom data
  // Note: Positions are preserved as stored - use Auto Layout button to re-layout
  useEffect(() => {
    if (custom) {
      const content = custom.journey;
      if (!content) return;
      const normalizedEdges = normalizeEdges(content.edges);
      // Preserve stored positions, just add React Flow handle positions
      const nodesWithHandles = addHandlePositions(content.nodes);
      setNodes(nodesWithHandles);
      setEdges(normalizedEdges);
      log.info(
        { journeyId, nodes: nodesWithHandles.length, edges: normalizedEdges.length },
        "useJourneyVisualization:customLoaded"
      );
    } else if (journeyConfigQuery.data) {
      const normalizedEdges = normalizeEdges(journeyConfigQuery.data.edges);
      setNodes(journeyConfigQuery.data.nodes);
      setEdges(normalizedEdges);
      log.info(
        {
          journeyId,
          nodes: journeyConfigQuery.data.nodes.length,
          edges: normalizedEdges.length,
        },
        "useJourneyVisualization:dataLoaded"
      );
    }
  }, [custom, journeyConfigQuery.data, log, journeyId]);

  return {
    nodes,
    edges,
    loading,
    error,
  };
}
