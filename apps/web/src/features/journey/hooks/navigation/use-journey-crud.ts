import { customJourneyActions, customJourneyStore } from "@/features/journey/builder/store/custom-journey-store";
import { journeysApi } from "@/shared/lib/api/journeys";
import { journeyKeys } from "@/shared/lib/query-keys";
import { notify } from "@/shared/lib/ui/notify";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useCallback } from "react";
import { createLogger, serializeError } from "@journey/logger";
import type { JourneyConfig } from "@journey/schemas";

const log = createLogger("use-journey-crud");

/**
 * Simple 3-node starter template for new journeys.
 * Uses inline content (no $content: references) for immediate display.
 */
function createStarterTemplate(now: string): JourneyConfig {
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        position: { x: 450, y: 0 },
        data: {
          type: "start",
          schemaVersion: 1,
          label: "Start",
          content: "Welcome! This is the beginning of your journey.",
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: "1.0.0",
          status: "draft",
        },
      },
      {
        id: "message-1",
        type: "custom",
        position: { x: 450, y: 320 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "First Message",
          content: "This is your first message to users.",
          responseType: "auto",
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: "1.0.0",
          status: "draft",
        },
      },
      {
        id: "end",
        type: "custom",
        position: { x: 450, y: 640 },
        data: {
          type: "end",
          schemaVersion: 1,
          label: "End",
          content: "Journey complete. Thank you!",
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: "1.0.0",
          status: "draft",
        },
      },
    ],
    edges: [
      {
        id: "edge-start-msg1",
        source: "start",
        target: "message-1",
        edgeType: "default",
      },
      {
        id: "edge-msg1-end",
        source: "message-1",
        target: "end",
        edgeType: "default",
      },
    ],
  };
}

interface UseJourneyCRUDParams {
  availableJourneys: Array<{ id: string; slug: string; name: string; description?: string }>;
  clearJourney?: () => void;
  onCancelCreateJourney: () => void;
}

export function useJourneyCRUD({ availableJourneys, clearJourney, onCancelCreateJourney }: UseJourneyCRUDParams) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customJourneys = useStore(customJourneyStore, (state) => state.customJourneys);

  const handleCreateJourney = useCallback(
    async (newJourneyName: string, newJourneyDescription: string, defaultPipelineId?: string | null) => {
      const now = new Date().toISOString();
      const starterTemplate = createStarterTemplate(now);

      try {
        // Create journey on server to get a real UUID (enables save button)
        const journey = await journeysApi.createJourney({
          name: newJourneyName || "New Journey",
          description: newJourneyDescription || "3-step starter",
          configuration: starterTemplate,
          defaultPipelineId: defaultPipelineId ?? undefined,
        });

        log.info({ journeyId: journey.id, slug: journey.slug }, "useJourneyCRUD:createJourney:success");

        // Refetch journey list BEFORE navigation so provider sees the new journey
        // Using refetchQueries + await prevents race condition where auto-select
        // redirects to first journey because new slug isn't in stale list
        await queryClient.refetchQueries({ queryKey: journeyKeys.list() });

        // Navigate to the new journey (has UUID now, so save button will work)
        navigate({
          to: "/journeys/$journeySlug",
          params: { journeySlug: journey.slug || journey.id },
          search: {},
        });

        onCancelCreateJourney();
        clearJourney?.();
      } catch (error) {
        log.error({ err: serializeError(error) }, "useJourneyCRUD:createJourney:failed");
        notify.error("Failed to create journey", {
          description: "Please try again or check your connection.",
        });
      }
    },
    [navigate, queryClient, clearJourney, onCancelCreateJourney]
  );

  const handleDeleteJourney = useCallback(
    async (selectedJourneySlug: string, journeyId?: string) => {
      if (!selectedJourneySlug) return;

      try {
        // Delete from server if we have an ID
        if (journeyId) {
          await journeysApi.deleteJourney(journeyId);
          log.info({ journeyId, slug: selectedJourneySlug }, "useJourneyCRUD:deleteJourney:success");
          // Notification handled by JOURNEY_DELETED event via WebSocket
        }

        // Clean up local store if journey exists there
        if (customJourneys[selectedJourneySlug]) {
          customJourneyActions.deleteJourney(selectedJourneySlug);
        }

        // Invalidate journey list cache (use correct query key)
        queryClient.invalidateQueries({ queryKey: journeyKeys.list() });

        const nextJourneys = availableJourneys.filter((f) => f.slug !== selectedJourneySlug);
        const fallback = nextJourneys[0];

        if (fallback) {
          // Navigate to fallback journey using path params
          navigate({
            to: "/journeys/$journeySlug",
            params: { journeySlug: fallback.slug },
            search: {},
          });
        } else {
          // No journeys left, go to index
          navigate({
            to: "/journeys",
            search: {},
          });
        }
        clearJourney?.();
      } catch (error) {
        log.error({ err: serializeError(error), journeyId, slug: selectedJourneySlug }, "useJourneyCRUD:deleteJourney:failed");
        notify.error("Failed to delete journey", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      }
    },
    [navigate, queryClient, customJourneys, availableJourneys, clearJourney]
  );

  return {
    handleCreateJourney,
    handleDeleteJourney,
  };
}
