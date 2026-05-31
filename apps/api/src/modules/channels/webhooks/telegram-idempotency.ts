/**
 * Telegram Idempotency Guard
 *
 * Prevents duplicate update processing by tracking update IDs in Redis.
 * Falls back to allowing processing if Redis is unavailable.
 *
 * @module modules/channels/webhooks/telegram-idempotency
 */

import { createLogger, serializeError } from "@journey/logger";

import { getRedisConnection } from "../../../lib/redis";

const log = createLogger("telegram-idempotency");

const KEY_PREFIX = "telegram:update:";
const TTL_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * Check if a Telegram update was already processed.
 *
 * @returns true when the update is a duplicate and should be ignored.
 */
export async function isDuplicateTelegramUpdate(channelId: string, updateId: number): Promise<boolean> {
  const redis = getRedisConnection();
  const key = `${KEY_PREFIX}${channelId}:${updateId}`;

  try {
    const result = await redis.set(key, "1", "EX", TTL_SECONDS, "NX");
    if (result === null) {
      return true;
    }
    return false;
  } catch (error) {
    log.warn(
      { err: serializeError(error), channelId, updateId },
      "telegramIdempotency:checkFailed"
    );
    return false;
  }
}
