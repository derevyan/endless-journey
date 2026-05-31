/**
 * Mindstate Versions API Client
 *
 * Provides functions for interacting with mindstate definition version endpoints.
 * Mirrors the journey versions API pattern.
 *
 * @module shared/lib/api/mindstate-versions
 */

import type {
  MindstateDefinitionVersion,
  VersionedMindstateData,
  AtomicSaveMindstateInput,
  AtomicSaveMindstateResult,
} from "@journey/schemas";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import { handle404, handleErrorResponse, assertResponseFields } from "./response-helpers";

/**
 * List all versions for a mindstate definition
 */
export async function listVersions(definitionId: string): Promise<MindstateDefinitionVersion[]> {
  const logContext = { definitionId };
  const data = await authFetch<{ versions: MindstateDefinitionVersion[] }>(
    `${apiUrl}/api/mindstates/definitions/${definitionId}/versions`,
    undefined,
    { action: "listVersions", logContext }
  );
  return data.versions || [];
}

/**
 * Get a specific version with full configuration
 */
export async function getVersion(
  definitionId: string,
  versionId: string
): Promise<VersionedMindstateData> {
  const logContext = { definitionId, versionId };
  const res = await authFetchRaw(
    `${apiUrl}/api/mindstates/definitions/${definitionId}/versions/${versionId}`,
    undefined,
    { action: "getVersion", logContext }
  );

  handle404(res, "Version", "getVersion", logContext);
  if (!res.ok) await handleErrorResponse(res, "Failed to fetch version", "getVersion", logContext, false);

  const data = await res.json();
  assertResponseFields(data, ["version", "data"], "getVersion", logContext);

  log.debug(logContext, "apiClient:getVersion:success");
  return data as VersionedMindstateData;
}

/**
 * Atomic save - creates version and updates definition in single transaction
 *
 * This is the preferred save method as it:
 * - Generates version ID server-side (prevents collisions)
 * - Uses transaction (ensures consistency)
 * - Reduces network roundtrips
 */
export async function saveVersionAtomic(
  definitionId: string,
  data: AtomicSaveMindstateInput
): Promise<AtomicSaveMindstateResult> {
  const logContext = { definitionId };
  const res = await authFetchRaw(
    `${apiUrl}/api/mindstates/definitions/${definitionId}/save`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    { action: "saveVersionAtomic", logContext }
  );

  handle404(res, "Definition", "saveVersionAtomic", logContext);
  if (!res.ok) await handleErrorResponse(res, "Failed to save", "saveVersionAtomic", logContext);

  const result = await res.json();
  assertResponseFields(result, ["versionId"], "saveVersionAtomic", logContext);

  log.info({ definitionId, versionId: result.versionId }, "apiClient:saveVersionAtomic:success");
  return result as AtomicSaveMindstateResult;
}

/**
 * Delete a version
 */
export async function deleteVersion(definitionId: string, versionId: string): Promise<void> {
  const logContext = { definitionId, versionId };
  const res = await authFetchRaw(
    `${apiUrl}/api/mindstates/definitions/${definitionId}/versions/${versionId}`,
    { method: "DELETE" },
    { action: "deleteVersion", logContext }
  );

  handle404(res, "Version", "deleteVersion", logContext);
  if (!res.ok) await handleErrorResponse(res, "Failed to delete version", "deleteVersion", logContext, false);

  log.info(logContext, "apiClient:deleteVersion:success");
}

/**
 * Mindstate versions API object
 * Exported for use in components and stores
 */
export const mindstateVersionsApi = {
  listVersions,
  getVersion,
  saveVersionAtomic,
  deleteVersion,
};
