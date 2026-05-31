import { useStore } from "@tanstack/react-store";
import React, { useEffect } from "react";

import { createLogger } from "@journey/logger";
import type { JourneySlug } from "@journey/schemas";

import {
  useEditorActions,
  useJourneyVisualization,
  useJourneyListManifest,
  useJourneyDataSync,
} from "@/features/journey/builder";
import { useEditorMode } from "@/features/journey/builder/hooks/selectors/editor-selectors";
import { useJourneySelection } from "@/features/journey/hooks/navigation/use-journey-selection";
import { customJourneyStore } from "@/features/journey/builder/store/custom-journey-store";
import { UnsavedChangesDialog } from "@/shared/components/common/unsaved-changes-dialog";
import { useUnsavedChangesProtection } from "@/shared/hooks";
import { uiSelectors, uiStore } from "@/stores/ui-store";

const log = createLogger("journey-data-provider");

/**
 * JourneyDataProvider - Orchestrates journey data loading and store syncing
 *
 * This provider composes several hooks:
 * - useJourneySelection: URL state management (uses slugs)
 * - useJourneyVisualization: Journey data loading
 * - useJourneyDataSync: Sync nodes/edges to editor store
 *
 * Selection state is read from URL search params (source of truth).
 * Uses slugs for URL-friendly routing.
 */
export function JourneyDataProvider({ children }: { children: React.ReactNode }) {
  // URL selection state (uses slug)
  const { selectedJourneySlug, selectJourney } = useJourneySelection();

  // Navigation protection for unsaved changes
  const hasPendingChanges = useStore(uiStore, uiSelectors.hasPendingChanges);
  const { status: blockerStatus, proceed, reset } = useUnsavedChangesProtection({ isDirty: hasPendingChanges });

  // Custom journeys from store
  const customJourneys = useStore(customJourneyStore, (state) => state.customJourneys);

  // Fetch available journeys from manifest
  const journeyManifestQuery = useJourneyListManifest();

  const baseJourneys = React.useMemo(() => journeyManifestQuery.data ?? [], [journeyManifestQuery.data]);

  // Merge custom journeys with base journeys from manifest
  const availableJourneys = React.useMemo(() => {
    const customJourneyMeta = Object.entries(customJourneys).map(([id, data]) => {
      const content = data.journey;
      return {
        id,
        slug: id, // Use id as slug for custom journeys
        name: content?.name || id,
        description: content?.description || "Custom journey",
      };
    });
    return [...baseJourneys.filter((j) => !customJourneys[j.slug]), ...customJourneyMeta];
  }, [baseJourneys, customJourneys]);

  // Auto-select first journey if none selected or selection is invalid
  useEffect(() => {
    if (availableJourneys.length === 0) return;

    // Check if current selection is valid (by slug)
    const isValidSelection = selectedJourneySlug && availableJourneys.some((j) => j.slug === selectedJourneySlug);

    if (!isValidSelection) {
      // Select the first available journey by slug
      const firstJourney = availableJourneys[0];
      log.info({ selectedJourneySlug, firstJourneySlug: firstJourney.slug }, "provider:autoSelectFirstJourney");
      selectJourney(firstJourney.slug);
    }
  }, [availableJourneys, selectedJourneySlug, selectJourney]);

  // Load journey visualization data (API accepts slug or ID)
  const { nodes: journeyNodes, edges: journeyEdges } = useJourneyVisualization(
    selectedJourneySlug,
    customJourneys
  );

  // Editor state and actions
  const { isEditMode } = useEditorMode();
  const { setCurrentData, setJourneySlug, setJourneyUuid } = useEditorActions();

  // Look up UUID from baseJourneys (API) by slug (for database operations)
  // We use baseJourneys instead of availableJourneys because:
  // - availableJourneys merges custom journeys which have id === slug (no UUID)
  // - baseJourneys always has the real UUID from the database
  const selectedJourneyUuid = React.useMemo(() => {
    if (!selectedJourneySlug) return null;
    const dbJourney = baseJourneys.find((j) => j.slug === selectedJourneySlug);
    // Return the database UUID (id field from API)
    // For custom journeys not in baseJourneys, this will be undefined/null
    return dbJourney?.id ?? null;
  }, [baseJourneys, selectedJourneySlug]);

  // Sync journey slug to editor store (for version management)
  useEffect(() => {
    // Cast from URL string to JourneySlug (URL slugs are validated when set)
    setJourneySlug(selectedJourneySlug as JourneySlug | null);
  }, [selectedJourneySlug, setJourneySlug]);

  // Sync journey UUID to editor store (for API operations like media)
  useEffect(() => {
    setJourneyUuid(selectedJourneyUuid);
  }, [selectedJourneyUuid, setJourneyUuid]);

  // Sync nodes/edges to editor store (with version loading)
  useJourneyDataSync({
    journeyNodes,
    journeyEdges,
    selectedJourneySlug,
    isEditMode,
    setCurrentData,
  });

  return (
    <>
      {children}
      <UnsavedChangesDialog
        open={blockerStatus === "blocked"}
        onProceed={proceed}
        onCancel={reset}
        title="Unsaved Changes"
        description="You have unsaved changes to this journey. If you leave now, your changes will be lost."
      />
    </>
  );
}
