/**
 * useSessionExport Hook
 *
 * Export a session to JSON file for sharing and offline replay.
 * Works with both live simulator sessions and playback sessions.
 *
 * @module features/journey/session-player/hooks/use-session-export
 */

import { useCallback } from "react";
import { useStore } from "@tanstack/react-store";

import { createLogger, serializeError } from "@journey/logger";
import { InteractionEventTypeValues, type InteractionEvent } from "@journey/schemas";
import type { SessionExport } from "@journey/schemas";

import { apiClient } from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { downloadJson } from "@/shared/lib/utils";
import { simulatorStore } from "@/features/journey/simulator/store";
import { sanitizeFileName } from "../lib";

const log = createLogger("use-session-export");

// Valid interaction event types for SessionExport
const validInteractionTypes = new Set(InteractionEventTypeValues);

export interface UseSessionExportReturn {
  exportSession: () => Promise<void>;
  canExport: boolean;
}

/**
 * Hook for exporting sessions to JSON files
 *
 * Fetches current session data from simulator store and downloads
 * it as a JSON file for sharing and offline replay.
 *
 * Works with both live sessions and playback sessions.
 *
 * @returns Export function and capability status
 */
export function useSessionExport(): UseSessionExportReturn {
  const session = useStore(simulatorStore, (s) => s.session);
  const eventLog = useStore(simulatorStore, (s) => s.eventLog);
  const playback = useStore(simulatorStore, (s) => s.playback);
  const simulatorMode = useStore(simulatorStore, (s) => s.mode);

  const exportSession = useCallback(async () => {
    if (!session) {
      log.warn({}, "export:noSession");
      notify.error("No session to export");
      return;
    }

    try {
      // Fetch journey info for name and slug
      const journeyRecord = await apiClient.getJourneyFullRecord(session.journeyId);

      if (!journeyRecord) {
        throw new Error("Journey not found");
      }

      // Get user info (from playback impersonation or session context)
      const userName = playback?.impersonatedUser?.name || "Unknown User";
      const userId = playback?.impersonatedUser?.id || session.userId;
      // Platform user ID: use platformUserId if available, fallback to userId
      const platformUserId = session.platformUserId || userId;

      // Construct SessionExport object
      const sessionExport: SessionExport = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),

        journey: {
          id: journeyRecord.id,
          slug: journeyRecord.slug || journeyRecord.id,
          name: journeyRecord.name,
        },

        user: {
          id: userId,
          platformUserId,
          displayName: userName,
          // Note: firstName, lastName, username are null in simulator mode
          // They come from the database in impersonate mode via convertSessionDetailToExport()
          firstName: null,
          lastName: null,
          username: null,
        },

        session: {
          id: session.sessionId,
          status: session.status,
          currentNodeId: session.currentNodeId,
          context: session.context,
          tags: session.tags,
          nodeOutputs: session.nodeOutputs,
          startedAt: session.startedAt,
          updatedAt: session.updatedAt,
          completedAt: session.completedAt,
        },

        // Filter interactions to only include valid InteractionEventTypes
        // (exclude lifecycle, workflow, and system events that aren't journey execution events)
        interactions: eventLog.filter(
          (event) => validInteractionTypes.has(event.type as InteractionEvent["type"])
        ),

        // Include journey definition for self-contained offline replay
        journeyDefinition: journeyRecord.configuration,

        // Include simulator context for simulator exports
        // Note: Real session context (organizationId, channelId) is only available
        // when exporting from database (impersonate mode via use-user-impersonation)
        ...(simulatorMode === "simulator" ? {
          sessionContext: {
            organizationId: "00000000-0000-0000-0000-000000000000",
            channelId: null,
            mode: "simulation" as const,
            platform: "simulator" as const,
            channelName: undefined,
          },
        } : {}),
      };

      // Generate filename
      const timestamp = new Date().toISOString().split("T")[0];
      const sanitizedName = sanitizeFileName(userName);
      const journeySlug = journeyRecord.slug || journeyRecord.id;
      const filename = `${journeySlug}-${sanitizedName}-${timestamp}.json`;

      // Download the file
      downloadJson(sessionExport, filename);

      log.info(
        {
          sessionId: session.sessionId,
          journeyId: journeyRecord.id,
          interactions: eventLog.length,
        },
        "export:sessionExported"
      );

      notify.success("Session exported", {
        description: `Downloaded as ${filename}`,
      });
    } catch (error) {
      log.error(
        { err: serializeError(error), sessionId: session.sessionId },
        "export:failed"
      );

      notify.error("Failed to export session", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }, [session, eventLog, playback, simulatorMode]);

  return {
    exportSession,
    canExport: !!session,
  };
}
