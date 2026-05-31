/**
 * Channels API
 *
 * Operations for messaging channels (Telegram bots).
 *
 * @module lib/api/channels
 */

import { serializeError } from "@journey/logger";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import type { Channel } from "./types";

export const channelsApi = {
  /**
   * Get all channels for the current user
   */
  async getChannels(): Promise<Channel[]> {
    const data = await authFetch<{ bots: Channel[] }>(`${apiUrl}/api/channels`, undefined, { action: "getChannels" });

    log.debug({ count: data.bots?.length }, "apiClient:getChannels:success");
    return data.bots || [];
  },

  /**
   * Create a new Telegram channel
   * @param botToken - Bot token from @BotFather
   */
  async createChannel(botToken: string): Promise<Channel> {
    const res = await authFetchRaw(
      `${apiUrl}/api/channels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken }),
      },
      { action: "createChannel" }
    );

    if (!res.ok) {
      let errorMessage = `Failed to create channel: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Response wasn't JSON, use status-based message
      }
      const error = new Error(errorMessage);
      log.error({ status: res.status, err: serializeError(error) }, "apiClient:createChannel:error");
      throw error;
    }

    const data = await res.json();
    log.info({ channelId: data.bot?.id, botUsername: data.bot?.botUsername }, "apiClient:createChannel:success");
    return data.bot;
  },

  /**
   * Update a channel
   */
  async updateChannel(channelId: string, data: { defaultJourneyId?: string | null; isActive?: boolean; botName?: string }): Promise<Channel> {
    const res = await authFetchRaw(
      `${apiUrl}/api/channels/${channelId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { action: "updateChannel", logContext: { channelId } }
    );

    if (res.status === 404) {
      log.warn({ channelId }, "apiClient:updateChannel:notFound");
      throw new Error("Channel not found or access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update channel: ${res.status}`);
      log.error({ channelId, status: res.status, err: serializeError(error) }, "apiClient:updateChannel:error");
      throw error;
    }

    const result = await res.json();
    log.info({ channelId }, "apiClient:updateChannel:success");
    return result.bot;
  },

  /**
   * Delete a channel
   */
  async deleteChannel(channelId: string): Promise<void> {
    const res = await authFetchRaw(`${apiUrl}/api/channels/${channelId}`, { method: "DELETE" }, { action: "deleteChannel", logContext: { channelId } });

    if (res.status === 404) {
      log.warn({ channelId }, "apiClient:deleteChannel:notFound");
      throw new Error("Channel not found or access denied");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete channel: ${res.status}`);
      log.error({ channelId, status: res.status, err: serializeError(error) }, "apiClient:deleteChannel:error");
      throw error;
    }

    log.info({ channelId }, "apiClient:deleteChannel:success");
  },

  /**
   * Re-register webhook for a channel
   */
  async reregisterChannelWebhook(channelId: string): Promise<void> {
    const res = await authFetchRaw(
      `${apiUrl}/api/channels/${channelId}/webhook`,
      { method: "POST" },
      { action: "reregisterChannelWebhook", logContext: { channelId } }
    );

    if (!res.ok) {
      const error = new Error(`Failed to register webhook: ${res.status}`);
      log.error({ channelId, status: res.status, err: serializeError(error) }, "apiClient:reregisterChannelWebhook:error");
      throw error;
    }

    log.info({ channelId }, "apiClient:reregisterChannelWebhook:success");
  },
};
