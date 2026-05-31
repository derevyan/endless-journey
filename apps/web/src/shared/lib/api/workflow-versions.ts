/**
 * Workflow Versions API
 *
 * Version history operations for workflow configurations.
 *
 * @module lib/api/workflow-versions
 */

import type {
  WorkflowVersion,
  SaveWorkflowVersionInput,
  VersionedWorkflowData,
  AtomicWorkflowSaveInput,
  AtomicWorkflowSaveResult,
} from "@journey/schemas";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import { handle404, handleErrorResponse, assertResponseFields } from "./response-helpers";

export const workflowVersionsApi = {
  /**
   * Get all versions for a workflow
   * Returns versions ordered by creation date (newest first)
   */
  async list(workflowKey: string): Promise<WorkflowVersion[]> {
    const data = await authFetch<{ versions: WorkflowVersion[] }>(
      `${apiUrl}/api/workflows/${workflowKey}/versions`,
      undefined,
      { action: "listWorkflowVersions", logContext: { workflowKey } }
    );
    return data.versions || [];
  },

  /**
   * Save a new version of a workflow
   * Creates a snapshot of the current configuration
   */
  async save(workflowKey: string, data: SaveWorkflowVersionInput): Promise<WorkflowVersion> {
    const logContext = { workflowKey, versionId: data.versionId };
    const res = await authFetchRaw(
      `${apiUrl}/api/workflows/${workflowKey}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { action: "saveWorkflowVersion", logContext }
    );

    handle404(res, "Workflow", "saveWorkflowVersion", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to save version", "saveWorkflowVersion", logContext);

    const result = await res.json();
    assertResponseFields(result, ["version"], "saveWorkflowVersion", logContext);

    log.info({ workflowKey, versionId: result.version.versionId }, "apiClient:saveWorkflowVersion:success");
    return result.version;
  },

  /**
   * Get a specific version with full configuration
   * Returns version metadata and the saved workflow configuration
   */
  async get(workflowKey: string, versionId: string): Promise<VersionedWorkflowData> {
    const logContext = { workflowKey, versionId };
    const res = await authFetchRaw(
      `${apiUrl}/api/workflows/${workflowKey}/versions/${versionId}`,
      undefined,
      { action: "getWorkflowVersion", logContext }
    );

    handle404(res, "Version", "getWorkflowVersion", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to fetch version", "getWorkflowVersion", logContext, false);

    const data = await res.json();
    assertResponseFields(data, ["version", "data"], "getWorkflowVersion", logContext);

    log.debug(logContext, "apiClient:getWorkflowVersion:success");
    return data as VersionedWorkflowData;
  },

  /**
   * Delete a specific version
   */
  async delete(workflowKey: string, versionId: string): Promise<void> {
    const logContext = { workflowKey, versionId };
    const res = await authFetchRaw(
      `${apiUrl}/api/workflows/${workflowKey}/versions/${versionId}`,
      { method: "DELETE" },
      { action: "deleteWorkflowVersion", logContext }
    );

    handle404(res, "Version", "deleteWorkflowVersion", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to delete version", "deleteWorkflowVersion", logContext, false);

    log.info(logContext, "apiClient:deleteWorkflowVersion:success");
  },

  /**
   * Atomic save - updates workflow AND creates version in one transaction
   *
   * Preferred save method that:
   * - Generates version ID server-side (prevents collisions)
   * - Uses database transaction (ensures consistency)
   * - Reduces network roundtrips (one call instead of two)
   */
  async saveVersionAtomic(workflowKey: string, data: AtomicWorkflowSaveInput): Promise<AtomicWorkflowSaveResult> {
    const logContext = { workflowKey };
    const res = await authFetchRaw(
      `${apiUrl}/api/workflows/${workflowKey}/save`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { action: "saveWorkflowVersionAtomic", logContext }
    );

    handle404(res, "Workflow", "saveWorkflowVersionAtomic", logContext);
    if (!res.ok) await handleErrorResponse(res, "Failed to save", "saveWorkflowVersionAtomic", logContext);

    const result = await res.json();
    assertResponseFields(result, ["version", "versionId"], "saveWorkflowVersionAtomic", logContext);

    log.info({ workflowKey, versionId: result.versionId }, "apiClient:saveWorkflowVersionAtomic:success");
    return result as AtomicWorkflowSaveResult;
  },
};

// Re-export type for convenience (defined in @journey/schemas)
export type { AtomicWorkflowSaveResult };
