/**
 * Sessions API
 *
 * Operations for journey sessions (Users Viewer).
 *
 * @module lib/api/sessions
 */

import { serializeError } from "@journey/logger";
import { apiUrl, authFetchRaw, log } from "./base";
import type { SessionDetail, SessionFilters, SessionListItem } from "./types";

export const sessionsApi = {
  /**
   * Get all sessions for a journey
   */
  async getJourneySessions(journeyId: string, filters: SessionFilters = {}): Promise<SessionListItem[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.offset) params.set("offset", String(filters.offset));

    const queryString = params.toString();
    const url = `${apiUrl}/api/journeys/${journeyId}/sessions${queryString ? `?${queryString}` : ""}`;

    const res = await authFetchRaw(url, undefined, {
      action: "getJourneySessions",
      logContext: { journeyId, filters },
    });

    if (res.status === 404) {
      log.warn({ journeyId }, "apiClient:getJourneySessions:notFound");
      return [];
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch sessions: ${res.status}`);
      log.error({ journeyId, status: res.status, err: serializeError(error) }, "apiClient:getJourneySessions:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ journeyId, count: data.sessions?.length }, "apiClient:getJourneySessions:success");
    return data.sessions || [];
  },

  /**
   * Get session detail with interactions
   */
  async getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    const res = await authFetchRaw(`${apiUrl}/api/sessions/${sessionId}`, undefined, { action: "getSessionDetail", logContext: { sessionId } });

    if (res.status === 404) {
      log.warn({ sessionId }, "apiClient:getSessionDetail:notFound");
      return null;
    }

    if (res.status === 403) {
      log.warn({ sessionId }, "apiClient:getSessionDetail:accessDenied");
      return null;
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch session: ${res.status}`);
      log.error({ sessionId, status: res.status, err: serializeError(error) }, "apiClient:getSessionDetail:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ sessionId, interactionCount: data.session?.interactions?.length }, "apiClient:getSessionDetail:success");
    return data.session;
  },

  /**
   * Reset all sessions for a journey (development only)
   */
  async resetJourneySessions(journeyId: string): Promise<{ deletedCount: number }> {
    const res = await authFetchRaw(
      `${apiUrl}/api/journeys/${journeyId}/sessions`,
      { method: "DELETE" },
      { action: "resetJourneySessions", logContext: { journeyId } }
    );

    if (res.status === 403) {
      log.warn({ journeyId }, "apiClient:resetJourneySessions:forbidden");
      throw new Error("Reset not available in production");
    }

    if (!res.ok) {
      const error = new Error(`Failed to reset sessions: ${res.status}`);
      log.error({ journeyId, status: res.status, err: serializeError(error) }, "apiClient:resetJourneySessions:error");
      throw error;
    }

    const data = await res.json();
    log.warn({ journeyId, deletedCount: data.deletedCount }, "apiClient:resetJourneySessions:success");
    return { deletedCount: data.deletedCount };
  },

  /**
   * Delete a single session and all its interactions
   */
  async deleteSession(sessionId: string): Promise<void> {
    const res = await authFetchRaw(`${apiUrl}/api/sessions/${sessionId}`, { method: "DELETE" }, { action: "deleteSession", logContext: { sessionId } });

    if (res.status === 404) {
      log.warn({ sessionId }, "apiClient:deleteSession:notFound");
      throw new Error("Session not found");
    }

    if (res.status === 403) {
      log.warn({ sessionId }, "apiClient:deleteSession:forbidden");
      throw new Error("Access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete session: ${res.status}`);
      log.error({ sessionId, status: res.status, err: serializeError(error) }, "apiClient:deleteSession:error");
      throw error;
    }

    log.info({ sessionId }, "apiClient:deleteSession:success");
  },
};
