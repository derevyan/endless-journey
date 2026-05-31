/**
 * Users API
 *
 * Operations for Telegram users.
 *
 * @module lib/api/users
 */

import { serializeError } from "@journey/logger";
import { apiUrl, authFetchRaw, log } from "./base";
import type { TelegramUser, TelegramUserFilters, TelegramUserSession } from "./types";
import type { UserActivityEntry } from "@journey/schemas";

export const usersApi = {
  /**
   * Get all telegram users (with optional journey and tags filter)
   */
  async getTelegramUsers(filters: TelegramUserFilters = {}): Promise<{ users: TelegramUser[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.journeyId) params.append("journeyId", filters.journeyId);
    if (filters.tags && filters.tags.length > 0) params.append("tags", filters.tags.join(","));
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.offset) params.append("offset", filters.offset.toString());

    const queryString = params.toString();
    const url = `${apiUrl}/api/users${queryString ? `?${queryString}` : ""}`;

    const res = await authFetchRaw(url, undefined, {
      action: "getTelegramUsers",
      logContext: { filters },
    });

    if (!res.ok) {
      const error = new Error(`Failed to fetch users: ${res.status}`);
      log.error({ status: res.status, err: serializeError(error) }, "apiClient:getTelegramUsers:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ count: data.users?.length, total: data.total }, "apiClient:getTelegramUsers:success");
    return { users: data.users || [], total: data.total || 0 };
  },

  /**
   * Get all unique tags across all users
   */
  async getUserTags(): Promise<string[]> {
    const res = await authFetchRaw(`${apiUrl}/api/users/tags`, undefined, { action: "getUserTags" });

    if (!res.ok) {
      const error = new Error(`Failed to fetch tags: ${res.status}`);
      log.error({ status: res.status, err: serializeError(error) }, "apiClient:getUserTags:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ count: data.tags?.length }, "apiClient:getUserTags:success");
    return data.tags || [];
  },

  /**
   * Get all sessions for a specific telegram user
   */
  async getTelegramUserSessions(userId: string): Promise<TelegramUserSession[]> {
    const res = await authFetchRaw(`${apiUrl}/api/users/${userId}/sessions`, undefined, { action: "getTelegramUserSessions", logContext: { userId } });

    if (res.status === 404) {
      log.warn({ userId }, "apiClient:getTelegramUserSessions:notFound");
      return [];
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch user sessions: ${res.status}`);
      log.error({ userId, status: res.status, err: serializeError(error) }, "apiClient:getTelegramUserSessions:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ userId, count: data.sessions?.length }, "apiClient:getTelegramUserSessions:success");
    return data.sessions || [];
  },

  /**
   * Get enriched activity timeline entries for a specific user
   */
  async getTelegramUserActivity(userId: string, limit = 120, offset = 0): Promise<UserActivityEntry[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    const res = await authFetchRaw(`${apiUrl}/api/users/${userId}/activity?${params.toString()}`, undefined, {
      action: "getTelegramUserActivity",
      logContext: { userId, limit, offset },
    });

    if (res.status === 404) {
      log.warn({ userId }, "apiClient:getTelegramUserActivity:notFound");
      return [];
    }

    if (!res.ok) {
      const error = new Error(`Failed to fetch user activity: ${res.status}`);
      log.error({ userId, status: res.status, err: serializeError(error) }, "apiClient:getTelegramUserActivity:error");
      throw error;
    }

    const data = await res.json();
    log.debug({ userId, count: data.activities?.length }, "apiClient:getTelegramUserActivity:success");
    return data.activities || [];
  },

  /**
   * Delete a telegram user and all their data
   */
  async deleteTelegramUser(userId: string): Promise<void> {
    const res = await authFetchRaw(`${apiUrl}/api/users/${userId}`, { method: "DELETE" }, { action: "deleteTelegramUser", logContext: { userId } });

    if (res.status === 404) {
      log.warn({ userId }, "apiClient:deleteTelegramUser:notFound");
      throw new Error("User not found");
    }

    if (res.status === 403) {
      log.warn({ userId }, "apiClient:deleteTelegramUser:forbidden");
      throw new Error("Access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete user: ${res.status}`);
      log.error({ userId, status: res.status, err: serializeError(error) }, "apiClient:deleteTelegramUser:error");
      throw error;
    }

    log.info({ userId }, "apiClient:deleteTelegramUser:success");
  },
};
