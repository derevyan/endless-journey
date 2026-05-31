/**
 * Sent Messages Service
 *
 * Handles persistence of sent message records for journey execution.
 * Stores platform message IDs to enable edit/delete and reply threading.
 *
 * @module modules/channels/services/sent-messages-service
 */

import { sentMessages } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError } from "@journey/schemas";
import type { ChannelPlatform, SaveSentMessagesParams, SentMessage } from "@journey/schemas";
import { and, desc, eq } from "drizzle-orm";

import type { ChannelServiceContext } from "./service-context";
const log = createLogger("sent-messages-service");
const FK_RETRY_ATTEMPTS = 5;
const FK_RETRY_DELAY_MS = 25;

function isForeignKeyViolation(error: unknown): boolean {
  const dbError = error as { code?: string; cause?: { code?: string }; message?: string };
  return (
    dbError.code === "23503" ||
    dbError.cause?.code === "23503" ||
    dbError.message?.includes("foreign key constraint") === true
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Save sent messages to the database
 *
 * Called by the engine after messages are successfully sent to the platform.
 * Supports saving multiple messages from a single sendMessage call
 * (e.g., media + buttons as separate messages).
 */
export async function saveSentMessages(ctx: ChannelServiceContext, params: SaveSentMessagesParams): Promise<void> {
  const { sessionId, nodeId, interactionEventId, platform, platformChatId, content, messages } = params;

  if (messages.length === 0) {
    return;
  }

  try {
    const records = messages.map((msg) => ({
      sessionId,
      nodeId,
      interactionEventId,
      platform,
      platformMessageId: msg.platformMessageId,
      platformChatId,
      messageType: msg.messageType,
      content: content ?? null,
      sentAt: new Date(),
    }));

    for (let attempt = 0; attempt < FK_RETRY_ATTEMPTS; attempt += 1) {
      try {
        await ctx.db.insert(sentMessages).values(records);

        log.info(
          {
            sessionId,
            nodeId,
            platform,
            messageCount: messages.length,
            messageIds: messages.map((m) => m.platformMessageId),
            ...(attempt > 0 ? { retries: attempt } : {}),
          },
          "sentMessages:saved"
        );
        return;
      } catch (error) {
        const isLastAttempt = attempt >= FK_RETRY_ATTEMPTS - 1;
        const shouldRetry = isForeignKeyViolation(error) && !isLastAttempt;
        if (!shouldRetry) {
          // If we exhausted retries due to FK violation, provide context
          if (isForeignKeyViolation(error) && isLastAttempt) {
            throw new BadRequestError("Session not found after retries - may be deleted or invalid", {
              sessionId,
              attempts: FK_RETRY_ATTEMPTS,
            });
          }
          throw error;
        }
        await sleep(FK_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  } catch (error) {
    log.error(
      {
        err: serializeError(error),
        sessionId,
        nodeId,
        platform,
      },
      "sentMessages:saveError"
    );
    throw error;
  }
}

/**
 * Get the last sent message for a session
 *
 * Useful for reply threading - get the most recent message
 * to use as reply_to_message_id.
 */
export async function getLastMessageForSession(
  ctx: ChannelServiceContext,
  sessionId: string
): Promise<SentMessage | null> {
  try {
    const [result] = await ctx.db
      .select()
      .from(sentMessages)
      .where(eq(sentMessages.sessionId, sessionId))
      .orderBy(desc(sentMessages.sentAt))
      .limit(1);

    return result ?? null;
  } catch (error) {
    log.error(
      {
        err: serializeError(error),
        sessionId,
      },
      "sentMessages:getLastError"
    );
    return null;
  }
}

/**
 * Get all sent messages for a session
 *
 * Returns messages in chronological order (oldest first).
 */
export async function getMessagesForSession(ctx: ChannelServiceContext, sessionId: string): Promise<SentMessage[]> {
  try {
    const results = await ctx.db
      .select()
      .from(sentMessages)
      .where(eq(sentMessages.sessionId, sessionId))
      .orderBy(sentMessages.sentAt);

    return results;
  } catch (error) {
    log.error(
      {
        err: serializeError(error),
        sessionId,
      },
      "sentMessages:getMessagesError"
    );
    return [];
  }
}

/**
 * Get a sent message by platform message ID
 *
 * Useful for looking up message details for edit/delete operations.
 */
export async function getMessageByPlatformId(
  ctx: ChannelServiceContext,
  platform: ChannelPlatform,
  platformMessageId: string
): Promise<SentMessage | null> {
  try {
    const [result] = await ctx.db
      .select()
      .from(sentMessages)
      .where(
        and(
          eq(sentMessages.platform, platform),
          eq(sentMessages.platformMessageId, platformMessageId)
        )
      )
      .limit(1);

    return result ?? null;
  } catch (error) {
    log.error(
      {
        err: serializeError(error),
        platform,
        platformMessageId,
      },
      "sentMessages:getByPlatformIdError"
    );
    return null;
  }
}
