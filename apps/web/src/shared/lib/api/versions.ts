/**
 * Versions API
 *
 * Version history operations for journey configurations.
 *
 * @module lib/api/versions
 */

import type { AtomicSaveInput, JourneyVersion, SaveVersionInput, VersionedJourneyData } from "@journey/schemas";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import { handle404, handleErrorResponse, assertResponseFields } from "./response-helpers";

/**
 * Result of atomic save operation
 */
export interface AtomicSaveResult {
  version: JourneyVersion;
  versionId: string;
}

export const versionsApi = {
  /**
   * Get all versions for a journey
   * Returns versions ordered by creation date (newest first)
   */
  async listVersions(journeyId: string): Promise<JourneyVersion[]> {
    const data = await authFetch<{ versions: JourneyVersion[] }>(
      `${apiUrl}/api/journeys/${journeyId}/versions`,
      undefined,
      { action: "listVersions", logContext: { journeyId } }
    );
    return data.versions || [];
  },

  /**
   * Save a new version of a journey
   * Creates a snapshot of the current configuration
   */
  async saveVersion(journeyId: string, data: SaveVersionInput): Promise<JourneyVersion> {
    const logContext = { journeyId, versionId: data.versionId };
    const res = await authFetchRaw(
      `${apiUrl}/api/journeys/${journeyId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { action: "saveVersion", logContext }
    );

    handle404(res, "Journey", "saveVersion", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to save version", "saveVersion", logContext);

    const result = await res.json();
    assertResponseFields(result, ["version"], "saveVersion", logContext);

    log.info({ journeyId, versionId: result.version.versionId }, "apiClient:saveVersion:success");
    return result.version;
  },

  /**
   * Get a specific version with full configuration
   * Returns version metadata and the saved journey configuration
   */
  async getVersion(journeyId: string, versionId: string): Promise<VersionedJourneyData> {
    const logContext = { journeyId, versionId };
    const res = await authFetchRaw(
      `${apiUrl}/api/journeys/${journeyId}/versions/${versionId}`,
      undefined,
      { action: "getVersion", logContext }
    );

    handle404(res, "Version", "getVersion", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to fetch version", "getVersion", logContext, false);

    const data = await res.json();
    assertResponseFields(data, ["version", "data"], "getVersion", logContext);

    log.debug(logContext, "apiClient:getVersion:success");
    return data as VersionedJourneyData;
  },

  /**
   * Atomic save - creates version AND updates journey configuration in one transaction
   *
   * Preferred save method that:
   * - Generates version ID server-side (prevents collisions)
   * - Uses transaction for atomicity (both operations succeed or both fail)
   * - Reduces network roundtrips (one call instead of two)
   */
  async saveVersionAtomic(journeyId: string, data: AtomicSaveInput): Promise<AtomicSaveResult> {
    const logContext = { journeyId };
    const res = await authFetchRaw(
      `${apiUrl}/api/journeys/${journeyId}/save`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { action: "saveVersionAtomic", logContext }
    );

    handle404(res, "Journey", "saveVersionAtomic", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to save", "saveVersionAtomic", logContext);

    const result = await res.json();
    assertResponseFields(result, ["version", "versionId"], "saveVersionAtomic", logContext);

    log.info({ journeyId, versionId: result.versionId }, "apiClient:saveVersionAtomic:success");
    return result as AtomicSaveResult;
  },

  /**
   * Delete a specific version
   */
  async deleteVersion(journeyId: string, versionId: string): Promise<void> {
    const logContext = { journeyId, versionId };
    const res = await authFetchRaw(
      `${apiUrl}/api/journeys/${journeyId}/versions/${versionId}`,
      { method: "DELETE" },
      { action: "deleteVersion", logContext }
    );

    handle404(res, "Version", "deleteVersion", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to delete version", "deleteVersion", logContext, false);

    log.info(logContext, "apiClient:deleteVersion:success");
  },
};
