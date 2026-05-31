/**
 * useSessionFileUpload Hook
 *
 * Load session JSON files and start playback.
 * Handles validation, navigation, and playback initialization.
 *
 * @module features/journey/session-player/hooks/use-session-file-upload
 */

import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { createLogger, serializeError } from "@journey/logger";

import { apiClient } from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { uiActions } from "@/stores/ui-store";
import { simulatorActions } from "@/features/journey/simulator/store";
import { clearReplayCache } from "@/features/journey/simulator/lib";
import {
  sessionExportToEnhancedJourney,
  validateSessionJson,
} from "../lib";

const log = createLogger("use-session-file-upload");

export interface UseSessionFileUploadReturn {
  loadSessionFile: (file: File) => Promise<void>;
}

/**
 * Hook for loading and playing back session JSON files
 *
 * Handles:
 * 1. File type validation (.json only)
 * 2. File size checking (warn if > 5MB)
 * 3. JSON parsing and Zod validation
 * 4. Journey existence check
 * 5. Navigation to journey page
 * 6. Conversion to playback format
 * 7. Playback initialization
 *
 * @returns Function to load a session file
 */
export function useSessionFileUpload(): UseSessionFileUploadReturn {
  const navigate = useNavigate();

  const loadSessionFile = useCallback(
    async (file: File) => {
      // 1. Validate file type
      if (!file.name.endsWith(".json")) {
        notify.error("Invalid file type", {
          description: "Please select a .json file",
        });
        return;
      }

      // 2. Check file size (warn if too large)
      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > 5) {
        notify.warning("Large file", {
          description: `This file is ${fileSizeInMB.toFixed(1)}MB and may take time to load`,
        });
      }

      try {
        // 3. Read file content
        log.debug({ fileName: file.name, fileSize: file.size }, "upload:reading");
        const jsonString = await file.text();

        // 4. Validate JSON structure with Zod
        log.debug({ fileName: file.name }, "upload:validating");
        const validationResult = validateSessionJson(jsonString);

        if (!validationResult.success) {
          log.warn(
            { fileName: file.name, error: validationResult.error },
            "upload:validationFailed"
          );
          notify.error("Invalid session file", {
            description: validationResult.error,
          });
          return;
        }

        const sessionData = validationResult.data;

        // 5. Check if journey exists in workspace
        log.debug(
          { journeyId: sessionData.journey.id, journeySlug: sessionData.journey.slug },
          "upload:checkingJourney"
        );

        let journeyExists = false;
        try {
          const journey = await apiClient.getJourneyById(
            sessionData.journey.id
          );
          journeyExists = !!journey;
        } catch {
          journeyExists = false;
        }

        if (!journeyExists) {
          log.warn(
            { journeySlug: sessionData.journey.slug },
            "upload:journeyNotFound"
          );
          notify.error("Journey not found", {
            description: `Journey "${sessionData.journey.name}" doesn't exist in your workspace. Please create or import the journey first.`,
          });
          return;
        }

        // 6. Navigate to journey page
        log.debug(
          { journeySlug: sessionData.journey.slug },
          "upload:navigating"
        );
        try {
          await navigate({
            to: "/journeys/$journeySlug",
            params: { journeySlug: sessionData.journey.slug },
          });
        } catch (navError) {
          log.error(
            { err: serializeError(navError), journeySlug: sessionData.journey.slug },
            "upload:navigationFailed"
          );
          notify.error("Navigation failed", {
            description: "Could not navigate to the journey page",
          });
          return;
        }

        // 7. Convert to playback format
        const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

        // 8. Initialize playback
        log.debug(
          {
            sessionId: sessionData.session.id,
            interactions: sessionData.interactions.length,
          },
          "upload:initializingPlayback"
        );

        // Clear any existing replay cache
        clearReplayCache();

        // Enter simulator mode
        uiActions.setMode("simulator");

        // Start playback
        simulatorActions.startPlayback({
          session: enhancedJourney,
          totalInteractions: sessionData.interactions.length,
          impersonatedUser: {
            id: sessionData.user.id,
            name: sessionData.user.displayName,
          },
        });

        log.info(
          {
            sessionId: sessionData.session.id,
            userId: sessionData.user.id,
            interactions: sessionData.interactions.length,
          },
          "upload:sessionLoaded"
        );

        notify.success("Session loaded", {
          description: `Playing back ${sessionData.user.displayName}'s session (${sessionData.interactions.length} interactions)`,
        });
      } catch (error) {
        log.error(
          { err: serializeError(error), fileName: file.name },
          "upload:error"
        );

        notify.error("Failed to load session", {
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    },
    [navigate]
  );

  return { loadSessionFile };
}
