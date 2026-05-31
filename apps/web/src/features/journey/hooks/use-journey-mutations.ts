/**
 * Journey Mutations Hook
 *
 * TanStack Query mutations for journey CRUD operations.
 * Uses createMutation for standardized error handling and cache invalidation.
 *
 * @module features/journey/hooks/use-journey-mutations
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { journeysApi } from "@/shared/lib/api/journeys";
import { createMutation } from "@/shared/lib/create-mutation";
import { journeyKeys } from "@/shared/lib/query-keys";
import type { DeactivationMode, JourneyConfig, JourneyStatus } from "@journey/schemas";

// =============================================================================
// STARTER TEMPLATE
// =============================================================================

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

// =============================================================================
// CREATE MUTATION
// =============================================================================

interface CreateJourneyInput {
  name: string;
  description?: string;
  defaultPipelineId?: string | null;
}

/**
 * Create a new journey with starter template
 */
export const useCreateJourney = createMutation({
  mutationFn: async (input: CreateJourneyInput) => {
    const now = new Date().toISOString();
    const starterTemplate = createStarterTemplate(now);

    return journeysApi.createJourney({
      name: input.name || "New Journey",
      description: input.description || "3-step starter",
      configuration: starterTemplate,
      defaultPipelineId: input.defaultPipelineId ?? undefined,
    });
  },
  invalidateKeys: journeyKeys.list(),
  errorMessage: "Failed to create journey",
});

// =============================================================================
// UPDATE STATUS MUTATION
// =============================================================================

interface UpdateJourneyStatusInput {
  id: string;
  status: JourneyStatus;
  deactivationMode?: DeactivationMode;
}

/**
 * Update journey status
 * Handles deactivation mode when changing from active to inactive/archived
 */
export const useUpdateJourneyStatus = createMutation({
  mutationFn: async (input: UpdateJourneyStatusInput) => {
    return journeysApi.updateJourney(input.id, {
      status: input.status,
      deactivationMode: input.deactivationMode,
    });
  },
  invalidateKeys: journeyKeys.list(),
  errorMessage: "Failed to update journey status",
});

// =============================================================================
// DELETE MUTATION
// =============================================================================

/**
 * Delete a journey
 */
export const useDeleteJourney = createMutation({
  mutationFn: (id: string) => journeysApi.deleteJourney(id),
  invalidateKeys: journeyKeys.list(),
  errorMessage: "Failed to delete journey",
});

// =============================================================================
// COMPOSITE HOOK
// =============================================================================

/**
 * Hook that provides create journey with auto-navigation
 */
export function useCreateJourneyWithNavigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateJourneyInput) => {
      const now = new Date().toISOString();
      const starterTemplate = createStarterTemplate(now);

      return journeysApi.createJourney({
        name: input.name || "New Journey",
        description: input.description || "3-step starter",
        configuration: starterTemplate,
        defaultPipelineId: input.defaultPipelineId ?? undefined,
      });
    },
    onSuccess: async (journey) => {
      // Refetch journey list before navigation
      await queryClient.refetchQueries({ queryKey: journeyKeys.list() });

      // Navigate to the new journey
      navigate({
        to: "/journeys/$journeySlug",
        params: { journeySlug: journey.slug || journey.id },
        search: {},
      });
    },
  });
}
