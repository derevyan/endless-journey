/**
 * useJourneySelection - Hook for URL-based journey/session selection
 *
 * Responsibilities:
 * - Read journey slug from URL path params (source of truth)
 * - Read session from URL search params
 * - Provide navigation actions to update URL state
 *
 * URL pattern: /journeys/:journeySlug?session=filename
 *
 * This hook is focused only on URL state management.
 * For journey data (nodes, edges), use useJourneyData or direct store access.
 *
 * NOTE: This hook should only be used within the journeys route context.
 */
import { useNavigate, useMatch } from "@tanstack/react-router";
import { useCallback } from "react";

export interface JourneySelectionState {
  /** Currently selected journey slug from URL path (null if none selected) */
  selectedJourneySlug: string | null;
  /** Currently selected session file from URL search (null if none) */
  selectedSession: string | null;
}

export interface JourneySelectionActions {
  /** Navigate to a different journey by slug (clears session) */
  selectJourney: (journeySlug: string) => void;
  /** Navigate to a specific session within current journey */
  selectSession: (sessionFile: string | null) => void;
}

export function useJourneySelection(): JourneySelectionState & JourneySelectionActions {
  const navigate = useNavigate();

  // Try to match the $journeySlug route to get path param
  // Returns undefined if we're on the index route (/journeys with no slug)
  const slugMatch = useMatch({
    from: "/_dashboard/journeys/$journeySlug",
    shouldThrow: false,
  });

  // Get journey from path param (if on slug route)
  const selectedJourneySlug = slugMatch?.params?.journeySlug ?? null;

  // Get session from search params (session stays as query param)
  const selectedSession = (slugMatch?.search as { session?: string } | undefined)?.session ?? null;

  // Navigation handlers - update URL path/search params
  const selectJourney = useCallback(
    (journeySlug: string) => {
      navigate({
        to: "/journeys/$journeySlug",
        params: { journeySlug },
        search: {}, // Clear session when changing journey
      });
    },
    [navigate]
  );

  const selectSession = useCallback(
    (sessionFile: string | null) => {
      if (!selectedJourneySlug) return; // Can't set session without a journey

      navigate({
        to: "/journeys/$journeySlug",
        params: { journeySlug: selectedJourneySlug },
        search: sessionFile ? { session: sessionFile } : {},
      });
    },
    [navigate, selectedJourneySlug]
  );

  return {
    selectedJourneySlug,
    selectedSession,
    selectJourney,
    selectSession,
  };
}

