/**
 * Tags API
 *
 * Operations for organization-wide tag DEFINITIONS (the tag registry).
 * For assigning tags to clients, use crmClientTagsApi from ./crm.ts instead.
 *
 * @module lib/api/tags
 */

import { serializeError } from "@journey/logger";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import type { GlobalTag } from "./types";

export const tagsApi = {
  /**
   * Get all tags for the organization
   */
  async getTags(): Promise<GlobalTag[]> {
    const data = await authFetch<{ tags: GlobalTag[] }>(`${apiUrl}/api/tags/global`, undefined, { action: "getTags" });

    log.debug({ count: data.tags?.length }, "apiClient:getTags:success");
    return data.tags || [];
  },

  /**
   * Add a tag
   */
  async addTag(tag: string, description?: string, color?: string): Promise<GlobalTag> {
    const data = await authFetch<{ tag: GlobalTag }>(
      `${apiUrl}/api/tags/global`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, description, color }),
      },
      { action: "addTag", logContext: { tag } }
    );

    log.info({ tag }, "apiClient:addTag:success");
    return data.tag;
  },

  /**
   * Update a tag
   */
  async updateTag(tag: string, description?: string, color?: string): Promise<GlobalTag> {
    const res = await authFetchRaw(
      `${apiUrl}/api/tags/global/${encodeURIComponent(tag)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, color }),
      },
      { action: "updateTag", logContext: { tag } }
    );

    if (res.status === 404) {
      log.warn({ tag }, "apiClient:updateTag:notFound");
      throw new Error("Tag not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update tag: ${res.status}`);
      log.error({ tag, status: res.status, err: serializeError(error) }, "apiClient:updateTag:error");
      throw error;
    }

    const data = await res.json();
    log.info({ tag }, "apiClient:updateTag:success");
    return data.tag;
  },

  /**
   * Remove a tag
   */
  async removeTag(tag: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/tags/global/${encodeURIComponent(tag)}`,
      { method: "DELETE" },
      { action: "removeTag", logContext: { tag } }
    );

    if (res.status === 404) {
      log.warn({ tag }, "apiClient:removeTag:notFound");
      throw new Error("Tag not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to remove tag: ${res.status}`);
      log.error({ tag, status: res.status, err: serializeError(error) }, "apiClient:removeTag:error");
      throw error;
    }

    log.info({ tag }, "apiClient:removeTag:success");
  },
};
