/**
 * Journeys API
 *
 * CRUD operations for journey configurations.
 *
 * @module lib/api/journeys
 */

import { serializeError } from "@journey/logger";
import type { DeactivationMode, JourneyConfig, JourneyMindstateConfig, JourneySlug, JourneyUuid } from "@journey/schemas";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import type { JourneyConfigRecord, JourneyMeta } from "./types";

export const journeysApi = {
  /**
   * Get all journeys accessible to the current user
   * Returns metadata only (not full configuration)
   */
  async getJourneys(): Promise<JourneyMeta[]> {
    const data = await authFetch<{ journeys: JourneyConfigRecord[] }>(`${apiUrl}/api/journeys`, undefined, { action: "getJourneys" });

    // Map to JourneyMeta (strip configuration for list view)
    // Cast API response strings to branded types (API responses are validated by server)
    return (data.journeys || []).map((j) => ({
      id: j.id as JourneyUuid,
      slug: (j.slug || j.id) as JourneySlug,
      name: j.name,
      description: j.description ?? undefined,
      status: j.status ?? undefined,
      nodeCount: j.configuration?.nodes?.length || 0,
      edgeCount: j.configuration?.edges?.length || 0,
      defaultPipelineId: j.defaultPipelineId ?? null,
      mindstateConfig: j.mindstateConfig ?? null,
      transferAllowlist: j.transferAllowlist ?? null,
    }));
  },

  /**
   * Get a specific journey by ID (if user has access)
   * Returns full configuration
   */
  async getJourneyById(id: string): Promise<JourneyConfig> {
    const res = await authFetchRaw(`${apiUrl}/api/journeys/${id}`, undefined, { action: "getJourneyById", logContext: { journeyId: id } });

    if (res.status === 404) {
      log.warn({ journeyId: id }, "apiClient:getJourneyById:notFound");
      throw new Error("Journey not found or access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch journey: ${res.status}`);
      log.error({ journeyId: id, status: res.status, err: serializeError(error) }, "apiClient:getJourneyById:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ journeyId: id, name: data.journey?.name }, "apiClient:getJourneyById:success");
    return data.journey.configuration;
  },

  /**
   * Get a specific journey by ID with full record (metadata + configuration)
   * Used for export functionality
   */
  async getJourneyFullRecord(id: string): Promise<JourneyConfigRecord> {
    const res = await authFetchRaw(`${apiUrl}/api/journeys/${id}`, undefined, { action: "getJourneyFullRecord", logContext: { journeyId: id } });

    if (res.status === 404) {
      log.warn({ journeyId: id }, "apiClient:getJourneyFullRecord:notFound");
      throw new Error("Journey not found or access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch journey: ${res.status}`);
      log.error({ journeyId: id, status: res.status, err: serializeError(error) }, "apiClient:getJourneyFullRecord:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ journeyId: id, name: data.journey?.name }, "apiClient:getJourneyFullRecord:success");
    return data.journey;
  },

  /**
   * Create a new journey
   */
  async createJourney(data: {
    name: string;
    description?: string;
    configuration: JourneyConfig;
    defaultPipelineId?: string | null;
  }): Promise<JourneyConfigRecord> {
    const result = await authFetch<{ journey: JourneyConfigRecord }>(
      `${apiUrl}/api/journeys`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { action: "createJourney", logContext: { name: data.name } }
    );

    log.info({ journeyId: result.journey?.id }, "apiClient:createJourney:success");
    return result.journey;
  },

  /**
   * Update an existing journey
   * When changing status from "active" to other, pass deactivationMode to handle sessions
   */
  async updateJourney(
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      configuration?: JourneyConfig;
      deactivationMode?: DeactivationMode;
      defaultPipelineId?: string | null;
      mindstateConfig?: JourneyMindstateConfig | null;
      transferAllowlist?: string[] | null;
    }
  ): Promise<JourneyConfigRecord> {
    const res = await authFetchRaw(
      `${apiUrl}/api/journeys/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { action: "updateJourney", logContext: { journeyId: id } }
    );

    if (res.status === 404) {
      log.warn({ journeyId: id }, "apiClient:updateJourney:notFound");
      throw new Error("Journey not found or access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update journey: ${res.status}`);
      log.error({ journeyId: id, status: res.status, err: serializeError(error) }, "apiClient:updateJourney:error");
      throw error;
    }

    const result = await res.json();
    log.info({ journeyId: id }, "apiClient:updateJourney:success");
    return result.journey;
  },

  /**
   * Delete a journey
   */
  async deleteJourney(id: string): Promise<void> {
    const res = await authFetchRaw(`${apiUrl}/api/journeys/${id}`, { method: "DELETE" }, { action: "deleteJourney", logContext: { journeyId: id } });

    if (res.status === 404) {
      log.warn({ journeyId: id }, "apiClient:deleteJourney:notFound");
      throw new Error("Journey not found or access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete journey: ${res.status}`);
      log.error({ journeyId: id, status: res.status, err: serializeError(error) }, "apiClient:deleteJourney:error");
      throw error;
    }

    log.info({ journeyId: id }, "apiClient:deleteJourney:success");
  },

  /**
   * Get the count of active sessions for a journey
   * Used to show warning before deactivation
   */
  async getActiveSessionsCount(journeyId: string): Promise<number> {
    const res = await authFetchRaw(`${apiUrl}/api/journeys/${journeyId}/active-sessions-count`, undefined, {
      action: "getActiveSessionsCount",
      logContext: { journeyId },
    });

    if (res.status === 404) {
      log.warn({ journeyId }, "apiClient:getActiveSessionsCount:notFound");
      throw new Error("Journey not found or access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to get active sessions count: ${res.status}`);
      log.error({ journeyId, status: res.status, err: serializeError(error) }, "apiClient:getActiveSessionsCount:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ journeyId, count: data.count }, "apiClient:getActiveSessionsCount:success");
    return data.count;
  },
};
