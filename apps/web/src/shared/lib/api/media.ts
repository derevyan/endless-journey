/**
 * Media API
 *
 * Operations for file uploads and media gallery.
 *
 * @module lib/api/media
 */

import { serializeError } from "@journey/logger";
import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import type { MediaItem, UploadConfig, UploadResponse } from "./types";

export const mediaApi = {
  /**
   * Upload a media file (image or video) to a specific journey
   */
  async uploadFile(file: File, journeyId: string): Promise<UploadResponse> {
    log.debug({ filename: file.name, size: file.size, type: file.type, journeyId }, "apiClient:uploadFile:start");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${apiUrl}/api/uploads?journeyId=${journeyId}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (res.status === 401) {
      log.warn({}, "apiClient:uploadFile:unauthorized");
      throw new Error("Unauthorized");
    }

    if (res.status === 400) {
      const errorData = await res.json();
      log.warn({ error: errorData.error }, "apiClient:uploadFile:invalidFile");
      throw new Error(errorData.error || "Invalid file");
    }

    if (!res.ok) {
      const error = new Error(`Failed to upload file: ${res.status}`);
      log.error({ status: res.status, err: serializeError(error) }, "apiClient:uploadFile:error");
      throw error;
    }

    const data = await res.json();
    log.info({ url: data.url, type: data.type, journeyId }, "apiClient:uploadFile:success");
    return data;
  },

  /**
   * Get media files for a specific journey (gallery)
   */
  async getMediaGallery(journeyId: string): Promise<MediaItem[]> {
    const data = await authFetch<{ media: MediaItem[] }>(`${apiUrl}/api/uploads?journeyId=${journeyId}`, undefined, {
      action: "getMediaGallery",
      logContext: { journeyId },
    });

    log.debug({ journeyId, count: data.media?.length }, "apiClient:getMediaGallery:success");
    return data.media || [];
  },

  /**
   * Check if media is in use in any journey
   */
  async checkMediaUsage(mediaId: string): Promise<{ inUse: boolean; usedIn: string[] }> {
    const data = await authFetch<{ inUse: boolean; usedIn: string[] }>(`${apiUrl}/api/uploads/${mediaId}/usage`, undefined, {
      action: "checkMediaUsage",
      logContext: { mediaId },
    });

    log.debug({ mediaId, inUse: data.inUse, usedIn: data.usedIn }, "apiClient:checkMediaUsage:success");
    return data;
  },

  /**
   * Delete a media file
   * @param force - Force delete even if media is in use
   */
  async deleteMedia(mediaId: string, force = false): Promise<{ success: boolean; inUse?: boolean; usedIn?: string[] }> {
    const url = force ? `${apiUrl}/api/uploads/${mediaId}?force=true` : `${apiUrl}/api/uploads/${mediaId}`;

    const res = await authFetchRaw(
      url,
      { method: "DELETE" },
      {
        action: "deleteMedia",
        logContext: { mediaId, force },
      }
    );

    if (res.status === 404) {
      log.warn({ mediaId }, "apiClient:deleteMedia:notFound");
      throw new Error("Media not found");
    }

    if (res.status === 409) {
      const data = await res.json();
      log.warn({ mediaId, usedIn: data.usedIn }, "apiClient:deleteMedia:inUse");
      return { success: false, inUse: true, usedIn: data.usedIn };
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete media: ${res.status}`);
      log.error({ mediaId, status: res.status, err: serializeError(error) }, "apiClient:deleteMedia:error");
      throw error;
    }

    log.info({ mediaId }, "apiClient:deleteMedia:success");
    return { success: true };
  },

  /**
   * Get upload configuration (allowed types, size limits)
   */
  async getUploadConfig(): Promise<UploadConfig> {
    try {
      return await authFetch<UploadConfig>(`${apiUrl}/api/uploads/config`, undefined, {
        action: "getUploadConfig",
      });
    } catch {
      // Return defaults if endpoint fails
      log.warn({}, "apiClient:getUploadConfig:fallback");
      return {
        allowedTypes: {
          image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          video: ["video/mp4", "video/webm"],
        },
        maxSize: {
          image: 10 * 1024 * 1024,
          video: 300 * 1024 * 1024,
        },
      };
    }
  },

  /**
   * Upload an avatar/logo image for user profile or organisation
   * @param file - Image file to upload (JPEG, PNG, GIF, WebP, max 5MB)
   * @returns URL of the uploaded avatar
   */
  async uploadAvatar(file: File): Promise<{ url: string }> {
    log.debug({ filename: file.name, size: file.size, type: file.type }, "apiClient:uploadAvatar:start");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${apiUrl}/api/uploads/avatar`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (res.status === 401) {
      log.warn({}, "apiClient:uploadAvatar:unauthorized");
      throw new Error("Unauthorized");
    }

    if (res.status === 400) {
      const errorData = await res.json();
      log.warn({ error: errorData.error }, "apiClient:uploadAvatar:invalidFile");
      throw new Error(errorData.error || "Invalid file");
    }

    if (!res.ok) {
      const error = new Error(`Failed to upload avatar: ${res.status}`);
      log.error({ status: res.status, err: serializeError(error) }, "apiClient:uploadAvatar:error");
      throw error;
    }

    const data = await res.json();
    log.info({ url: data.url }, "apiClient:uploadAvatar:success");
    return { url: data.url };
  },
};
