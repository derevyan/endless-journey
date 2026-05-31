/**
 * Session Export Converters
 *
 * Convert between SessionExport (portable JSON format)
 * and EnhancedUserJourney (simulator format).
 *
 * @module features/journey/session-player/lib/session-converters
 */

import type { EnhancedUserJourney, SessionExport } from "@journey/schemas";

/**
 * Convert SessionExport to EnhancedUserJourney format for simulator playback.
 *
 * This maps the portable JSON format to the internal format used by the
 * simulator store and replay functions.
 *
 * @param sessionExport - The exported session data
 * @returns Enhanced journey ready for playback
 */
export function sessionExportToEnhancedJourney(
  sessionExport: SessionExport
): EnhancedUserJourney {
  return {
    // IDs and identifiers
    sessionId: sessionExport.session.id,
    userId: sessionExport.user.id,
    platformUserId: sessionExport.user.platformUserId,
    journeyId: sessionExport.journey.id,

    // Current state
    currentNodeId: sessionExport.session.currentNodeId,
    status: sessionExport.session.status,

    // Variables and metadata
    context: sessionExport.session.context,
    tags: sessionExport.session.tags,

    // Timers and follow-ups (empty for JSON playback)
    pendingTimers: [],
    pendingPluginFollowUps: [],

    // Node outputs
    nodeOutputs: sessionExport.session.nodeOutputs,

    // Timestamps
    startedAt: sessionExport.session.startedAt,
    updatedAt: sessionExport.session.updatedAt,
    completedAt: sessionExport.session.completedAt,

    // Resume marker (default to true for exported sessions as they've been started)
    hasStarted: true,

    // Event log (history)
    history: sessionExport.interactions,
  };
}

/**
 * Build a display name from user data.
 * Tries firstName + lastName first, falls back to username or displayName.
 */
export function buildUserDisplayName(user: SessionExport["user"]): string {
  const parts: string[] = [];
  if (user.firstName) parts.push(user.firstName);
  if (user.lastName) parts.push(user.lastName);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  if (user.username) {
    return user.username;
  }

  return user.displayName || "Unknown User";
}
