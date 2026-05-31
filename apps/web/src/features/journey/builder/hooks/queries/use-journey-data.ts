/**
 * useJourneyData - Composite hook for journey data and navigation
 *
 * This hook composes:
 * - URL selection state (via useJourneySelection)
 * - Nodes/edges from journey-nodes-store
 * - Available journeys from manifest
 * - Visualization loading state
 *
 * For URL state only, use useJourneySelection directly.
 * For store data only, use useStore with journey-nodes-store directly.
 */
import { useStore } from "@tanstack/react-store";
import { useCallback, useMemo } from "react";

import { customJourneyStore } from "@/features/journey/builder/store/custom-journey-store";
import { journeyNodesStore } from "@/stores/journey-nodes-store";
import { useJourneySelection } from "@/features/journey/hooks/navigation/use-journey-selection";
import { useJourneyListManifest } from "@/hooks/queries";
import { useJourneyVisualization } from "@/features/journey/builder/hooks/use-journey-visualization";

export function useJourneyData() {
  // URL selection state (source of truth, uses slug)
  const { selectedJourneySlug, selectJourney } = useJourneySelection();

  // Get nodes/edges from store (plugins are embedded in node.data.plugins)
  const nodes = useStore(journeyNodesStore, (state) => state.nodes);
  const edges = useStore(journeyNodesStore, (state) => state.edges);

  // Get custom journeys
  const customJourneys = useStore(customJourneyStore, (state) => state.customJourneys);

  // Fetch available journeys from manifest
  const journeyManifestQuery = useJourneyListManifest();

  const baseJourneys = useMemo(() => journeyManifestQuery.data ?? [], [journeyManifestQuery.data]);

  // Merge custom journeys with base journeys from manifest
  const availableJourneys = useMemo(() => {
    const customJourneyMeta = Object.entries(customJourneys).map(([id, data]) => {
      const content = data.journey;
      // Find if this custom journey exists in the API-fetched journeys (for status, defaultPipelineId, mindstateConfig)
      const apiJourney = baseJourneys.find((j) => j.id === id || j.slug === id);
      return {
        id,
        slug: id, // Use id as slug for custom journeys
        name: content?.name || id,
        description: content?.description || "Custom journey",
        status: apiJourney?.status || "draft", // Use API status if available, default to draft
        defaultPipelineId: apiJourney?.defaultPipelineId ?? null, // Use API defaultPipelineId if available
        mindstateConfig: apiJourney?.mindstateConfig ?? null, // Use API mindstateConfig if available
        transferAllowlist: apiJourney?.transferAllowlist ?? null, // Use API transferAllowlist if available
      };
    });
    return [...baseJourneys.filter((j) => !customJourneys[j.slug]), ...customJourneyMeta];
  }, [baseJourneys, customJourneys]);

  const selectedJourneyMeta = availableJourneys.find((j) => j.slug === selectedJourneySlug);
  const isCustomSelected = !!customJourneys[selectedJourneySlug ?? ""];

  // Get journey loading state
  const { loading, error } = useJourneyVisualization(selectedJourneySlug, customJourneys);

  // Navigation handler (URL update)
  const onJourneySelect = useCallback(
    (journeySlug: string) => {
      selectJourney(journeySlug);
    },
    [selectJourney]
  );

  return {
    // Data from URL search params (source of truth for selection)
    selectedJourneySlug,

    // Data from stores
    nodes,
    edges,

    // Computed data
    availableJourneys,
    selectedJourneyMeta,
    isCustomSelected,

    // Loading/error state
    loading,
    error,

    // Actions
    onJourneySelect,
  };
}
