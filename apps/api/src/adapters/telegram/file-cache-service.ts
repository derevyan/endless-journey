/**
 * Telegram File Cache Service
 *
 * Manages caching of Telegram file_ids for uploaded media.
 * When media is uploaded to Telegram, the returned file_id can be reused
 * to send the same file instantly without re-uploading.
 *
 * file_ids are bot-specific, so we cache per channel (bot).
 *
 * @module adapters/telegram/file-cache-service
 */

import { createLogger, serializeError } from "@journey/logger";
import { db, telegramFileCache } from "@journey/db";
import { and, eq } from "drizzle-orm";

const log = createLogger("telegram-file-cache");

export interface CachedFileId {
  fileId: string;
  fileUniqueId: string | null;
  mediaType: "image" | "video";
}

export interface SaveFileCacheParams {
  channelId: string;
  mediaId: string;
  mediaType: "image" | "video";
  fileId: string;
  fileUniqueId?: string;
}

/**
 * Get cached file_id for a media item on a specific channel
 */
export async function getCachedFileId(channelId: string, mediaId: string): Promise<CachedFileId | null> {
  try {
    const result = await db
      .select({
        fileId: telegramFileCache.fileId,
        fileUniqueId: telegramFileCache.fileUniqueId,
        mediaType: telegramFileCache.mediaType,
      })
      .from(telegramFileCache)
      .where(and(eq(telegramFileCache.channelId, channelId), eq(telegramFileCache.mediaId, mediaId)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    log.debug({ channelId, mediaId }, "telegramFileCache:hit");
    return result[0];
  } catch (error) {
    log.error({ channelId, mediaId, err: serializeError(error) }, "telegramFileCache:get:error");
    return null;
  }
}

/**
 * Save file_id to cache after successful upload
 * Returns true if save was successful, false otherwise
 */
export async function saveFileIdToCache(params: SaveFileCacheParams): Promise<boolean> {
  try {
    const result = await db
      .insert(telegramFileCache)
      .values({
        channelId: params.channelId,
        mediaId: params.mediaId,
        mediaType: params.mediaType,
        fileId: params.fileId,
        fileUniqueId: params.fileUniqueId,
      })
      .onConflictDoUpdate({
        target: [telegramFileCache.channelId, telegramFileCache.mediaId],
        set: {
          fileId: params.fileId,
          fileUniqueId: params.fileUniqueId,
        },
      })
      .returning({ id: telegramFileCache.id });

    if (result.length === 0) {
      log.warn({ ...params }, "telegramFileCache:save:noRowsAffected");
      return false;
    }

    log.info({ channelId: params.channelId, mediaId: params.mediaId, mediaType: params.mediaType }, "telegramFileCache:saved");
    return true;
  } catch (error) {
    log.error({ ...params, err: serializeError(error) }, "telegramFileCache:save:error");
    return false;
  }
}

/**
 * Delete cached file_ids for a channel (e.g., when bot token changes)
 */
export async function clearChannelCache(channelId: string): Promise<number> {
  try {
    const result = await db.delete(telegramFileCache).where(eq(telegramFileCache.channelId, channelId)).returning();

    log.info({ channelId, deletedCount: result.length }, "telegramFileCache:cleared");
    return result.length;
  } catch (error) {
    log.error({ channelId, err: serializeError(error) }, "telegramFileCache:clear:error");
    return 0;
  }
}

/**
 * Delete cached file_ids for a media item (e.g., when media is re-uploaded)
 */
export async function clearMediaCache(mediaId: string): Promise<number> {
  try {
    const result = await db.delete(telegramFileCache).where(eq(telegramFileCache.mediaId, mediaId)).returning();

    log.info({ mediaId, deletedCount: result.length }, "telegramFileCache:mediaCleared");
    return result.length;
  } catch (error) {
    log.error({ mediaId, err: serializeError(error) }, "telegramFileCache:clearMedia:error");
    return 0;
  }
}
