/**
 * useUserImpersonation Hook
 *
 * Orchestrates the entire user impersonation workflow:
 * 1. Fetch user's sessions
 * 2. Show session selection dialog (always, for single or multiple sessions)
 * 3. Convert SessionDetail to playback-ready format
 * 4. Initialize playback mode
 * 5. Download sessions as JSON files
 *
 * @module features/users/hooks/use-user-impersonation
 */

import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

import { createLogger, serializeError } from "@journey/logger";
import { InteractionEventTypeValues, type InteractionEvent } from "@journey/schemas";
import type { SessionExport } from "@journey/schemas";

import { apiClient } from "@/shared/lib/api";
import { notify } from "@/shared/lib/ui/notify";
import { downloadJson } from "@/shared/lib/utils";
import { simulatorActions } from "@/features/journey/simulator/store";
import { uiActions } from "@/stores/ui-store";
import { clearReplayCache } from "@/features/journey/simulator/lib";
import {
  sessionExportToEnhancedJourney,
  sanitizeFileName,
} from "@/features/journey/session-player/lib";
import type { TelegramUserSession } from "@/shared/lib/api";

const log = createLogger("use-user-impersonation");

// Valid interaction event types for SessionExport
const validInteractionTypes = new Set(InteractionEventTypeValues);

/**
 * Result from startImpersonation - indicates whether to show dialog
 */
export interface StartImpersonationResult {
  showDialog: boolean;
  sessions?: TelegramUserSession[];
}

/**
 * Hook for orchestrating user impersonation workflow
 *
 * Provides three main functions:
 * - startImpersonation: Fetch sessions and determine UI flow
 * - loadSessionForPlayback: Initialize playback mode
 * - downloadSession: Export session as JSON file
 *
 * @returns Object with three async functions
 */
export function useUserImpersonation() {
  const navigate = useNavigate();

  /**
   * Step 1: Start impersonation flow - fetch sessions and determine action
   */
  const startImpersonation = useCallback(
    async (userId: string): Promise<StartImpersonationResult> => {
      try {
        log.info({ userId }, "impersonation:starting");

        // Fetch user's sessions
        const sessions = await apiClient.getTelegramUserSessions(userId);

        log.debug({ userId, sessionCount: sessions.length }, "impersonation:sessionsFetched");

        // Case 1: No sessions
        if (sessions.length === 0) {
          log.warn({ userId }, "impersonation:noSessions");
          notify.error("No sessions found", {
            description: "This user has no session history to replay.",
          });
          return { showDialog: false };
        }

        // Always show dialog (single or multiple sessions)
        // This ensures export button is always accessible
        log.debug({ userId, sessionCount: sessions.length }, "impersonation:showingDialog");
        return {
          showDialog: true,
          sessions,
        };
      } catch (error) {
        log.error(
          { err: serializeError(error), userId },
          "impersonation:startFailed"
        );
        notify.error("Failed to fetch sessions", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        });
        return { showDialog: false };
      }
    },
    []
  );

  /**
   * Step 2: Load session for playback
   *
   * Full pipeline:
   * 1. Fetch session detail with interactions
   * 2. Fetch journey metadata
   * 3. Convert to SessionExport format (in-memory)
   * 4. Navigate to journey page
   * 5. Initialize playback mode
   */
  const loadSessionForPlayback = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        log.debug({ sessionId }, "playback:loading");

        // 1. Fetch full session detail with interactions
        const sessionDetail = await apiClient.getSessionDetail(sessionId);

        if (!sessionDetail) {
          log.warn({ sessionId }, "playback:sessionNotFound");
          notify.error("Session not found", {
            description: "The session could not be loaded.",
          });
          return;
        }

        // 2. Check if session has interactions
        if (!sessionDetail.interactions || sessionDetail.interactions.length === 0) {
          log.warn({ sessionId }, "playback:noInteractions");
          notify.error("Session has no interaction history", {
            description: "This session cannot be replayed.",
          });
          return;
        }

        log.debug(
          { sessionId, interactionCount: sessionDetail.interactions.length },
          "playback:sessionFetched"
        );

        // 2. Fetch journey metadata
        let journeyRecord;
        try {
          journeyRecord = await apiClient.getJourneyFullRecord(sessionDetail.journeyId);
        } catch {
          log.warn(
            { journeyId: sessionDetail.journeyId },
            "playback:journeyNotFound"
          );
          notify.error("Journey not found", {
            description:
              "The journey for this session no longer exists in your workspace.",
          });
          return;
        }

        log.debug(
          { journeySlug: journeyRecord.slug },
          "playback:journeyFetched"
        );

        // 3. Convert to SessionExport format
        const sessionExport = convertSessionDetailToExport(sessionDetail, journeyRecord);

        // 4. Navigate to journey page
        log.debug(
          { journeySlug: journeyRecord.slug || journeyRecord.id },
          "playback:navigating"
        );
        try {
          await navigate({
            to: "/journeys/$journeySlug",
            params: { journeySlug: journeyRecord.slug || journeyRecord.id },
          });
        } catch (navError) {
          log.error(
            { err: serializeError(navError), journeySlug: journeyRecord.slug },
            "playback:navigationFailed"
          );
          notify.error("Navigation failed", {
            description: "Could not navigate to the journey page.",
          });
          return;
        }

        // 5. Convert to playback format and initialize playback
        const enhancedJourney = sessionExportToEnhancedJourney(sessionExport);

        log.debug({ sessionId }, "playback:initializingPlayback");

        // Clear any existing replay cache
        clearReplayCache();

        // Enter simulator mode
        uiActions.setMode("simulator");

        // Start playback with all session data
        simulatorActions.startPlayback({
          session: enhancedJourney,
          totalInteractions: sessionExport.interactions.length,
          impersonatedUser: {
            id: sessionExport.user.id,
            name: sessionExport.user.displayName,
          },
        });

        log.info(
          {
            sessionId,
            userId: sessionExport.user.id,
            interactionCount: sessionExport.interactions.length,
          },
          "playback:started"
        );

        notify.success("Playback started", {
          description: `Viewing ${sessionExport.user.displayName}'s session (${sessionExport.interactions.length} interactions)`,
        });
      } catch (error) {
        log.error(
          { err: serializeError(error), sessionId },
          "playback:error"
        );
        notify.error("Failed to start playback", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    },
    [navigate]
  );

  /**
   * Step 3: Download session as JSON file
   */
  const downloadSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        log.debug({ sessionId }, "download:starting");

        // Fetch session detail
        const sessionDetail = await apiClient.getSessionDetail(sessionId);

        if (!sessionDetail) {
          log.warn({ sessionId }, "download:sessionNotFound");
          notify.error("Session not found");
          return;
        }

        // Fetch journey metadata
        let journeyRecord;
        try {
          journeyRecord = await apiClient.getJourneyFullRecord(
            sessionDetail.journeyId
          );
        } catch {
          log.warn(
            { journeyId: sessionDetail.journeyId },
            "download:journeyNotFound"
          );
          notify.error("Journey not found");
          return;
        }

        // Convert to SessionExport
        const sessionExport = convertSessionDetailToExport(sessionDetail, journeyRecord);

        // Download as JSON file
        downloadJson(sessionExport, generateFileName(sessionExport));

        log.info(
          { sessionId, journeyId: journeyRecord.id },
          "download:sessionExported"
        );

        notify.success("Session downloaded", {
          description: generateFileName(sessionExport),
        });
      } catch (error) {
        log.error(
          { err: serializeError(error), sessionId },
          "download:failed"
        );
        notify.error("Failed to download session", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    },
    []
  );

  return {
    startImpersonation,
    loadSessionForPlayback,
    downloadSession,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert SessionDetail (from API) to SessionExport (portable format)
 */
function convertSessionDetailToExport(
  sessionDetail: Awaited<ReturnType<typeof apiClient.getSessionDetail>>,
  journeyRecord: Awaited<ReturnType<typeof apiClient.getJourneyFullRecord>>
): SessionExport {
  if (!sessionDetail) {
    throw new Error("Session detail is null");
  }

  // Build display name from user data
  const displayName = [sessionDetail.user.firstName, sessionDetail.user.lastName]
    .filter(Boolean)
    .join(" ") || sessionDetail.user.username || "Unknown User";

  // Platform user ID: prefer telegramUserId, fallback to user ID if not available
  const platformUserId = sessionDetail.telegramUserId || sessionDetail.user.id;

  return {
    exportVersion: "1.0",
    exportedAt: new Date().toISOString(),

    journey: {
      id: journeyRecord.id,
      slug: journeyRecord.slug || journeyRecord.id,
      name: journeyRecord.name,
    },

    user: {
      id: sessionDetail.user.id,
      platformUserId,
      displayName,
      firstName: sessionDetail.user.firstName,
      lastName: sessionDetail.user.lastName,
      username: sessionDetail.user.username,
    },

    session: {
      id: sessionDetail.id,
      status: (sessionDetail.status || "active") as SessionExport["session"]["status"],
      currentNodeId: sessionDetail.currentNodeId,
      context: sessionDetail.context,
      tags: sessionDetail.tags,
      nodeOutputs: sessionDetail.nodeOutputs || {},
      startedAt: sessionDetail.createdAt || new Date().toISOString(),
      updatedAt: sessionDetail.updatedAt || new Date().toISOString(),
      completedAt: sessionDetail.completedAt,
    },

    // Filter interactions to only include valid InteractionEventTypes
    // (exclude lifecycle, workflow, and system events that aren't journey execution events)
    interactions: sessionDetail.interactions.filter(
      (event) => validInteractionTypes.has(event.type as InteractionEvent["type"])
    ),

    // Include journey definition for self-contained offline replay
    journeyDefinition: journeyRecord.configuration,

    // Include session context with full details from database (if available)
    ...(sessionDetail.organizationId
      ? {
          sessionContext: {
            organizationId: sessionDetail.organizationId,
            channelId: sessionDetail.channelId ?? null,
            mode: sessionDetail.mode ?? "live",
            platform: sessionDetail.platform ?? null,
            channelName: sessionDetail.channelName,
          },
        }
      : {}),
  };
}

/**
 * Generate filename for session export
 */
function generateFileName(sessionExport: SessionExport): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedName = sanitizeFileName(
    sessionExport.user.displayName || "session"
  );
  const journeySlug = sessionExport.journey.slug || sessionExport.journey.id;
  return `${journeySlug}-${sanitizedName}-${timestamp}.json`;
}
