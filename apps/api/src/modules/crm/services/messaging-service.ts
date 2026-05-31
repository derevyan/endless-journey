/**
 * CRM Direct Messaging Service
 *
 * Send messages to clients via their messaging channel (Telegram/WhatsApp)
 * outside of journey context.
 *
 * @module modules/crm/services/messaging-service
 */

import { decrypt, isEncrypted } from "@journey/db";
import { crmDirectMessages, clients, messagingChannels } from "@journey/db/schema";
import { createCircuitBreaker, CircuitOpenError } from "@journey/infra";
import { createLogger, serializeError } from "@journey/logger";
import type { DirectMessage, SendMessageInput, SendMessageResult } from "@journey/schemas";
import { and, eq, desc } from "drizzle-orm";

import { truncate } from "../../../lib/utils";
import type { CrmServiceContext } from "./service-context";

/**
 * Circuit-protected fetch for Telegram API
 *
 * Protects against Telegram API outages - if Telegram is down,
 * the circuit opens and requests fail fast instead of timing out.
 */
const telegramFetch = createCircuitBreaker(
  async (url: string, init?: RequestInit): Promise<Response> => fetch(url, init),
  {
    name: "telegram-api",
    serviceType: "telegram",
  }
);

const log = createLogger("crm-messaging-service");

const resolveBotToken = (encryptedToken: string): string => {
  if (isEncrypted(encryptedToken)) {
    return decrypt(encryptedToken);
  }
  return encryptedToken;
};

// =============================================================================
// DIRECT MESSAGING
// =============================================================================

/**
 * Send a direct message to a client
 */
export async function sendDirectMessage(
  ctx: CrmServiceContext,
  input: SendMessageInput & { clientId: string },
  sentBy: string
): Promise<SendMessageResult> {
  const { db, organizationId, publisher } = ctx;
  const { clientId, channelId, content } = input;

  try {
    // Verify client exists AND belongs to this organization
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!client) {
      return { success: false, error: "Client not found" };
    }

    // Verify channel exists and belongs to organization
    const [channel] = await db
      .select()
      .from(messagingChannels)
      .where(
        and(
          eq(messagingChannels.id, channelId),
          eq(messagingChannels.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    // Verify client platform matches channel platform
    if (client.platform !== channel.platform) {
      log.warn(
        { clientId, channelId, clientPlatform: client.platform, channelPlatform: channel.platform },
        "crmMessagingService:sendDirectMessage:platformMismatch"
      );
      return {
        success: false,
        error: `Cannot send message: client is on ${client.platform} but channel is ${channel.platform}`,
      };
    }

    if (!content.trim()) {
      return { success: false, error: "Message content is empty" };
    }

    // Create message record with pending status
    const [message] = await db
      .insert(crmDirectMessages)
      .values({
        clientId,
        organizationId,
        channelId,
        content,
        status: "pending",
        sentBy,
        sentAt: new Date(),
      })
      .returning();

    // Send the message via the appropriate platform
    let platformResult: { success: boolean; messageId?: string; error?: string };

    try {
      if (channel.platform === "telegram") {
        platformResult = await sendTelegramMessage(
          resolveBotToken(channel.botTokenEncrypted),
          client.platformUserId,
          content
        );
      } else {
        // WhatsApp or other platforms - placeholder
        platformResult = { success: false, error: `Platform ${channel.platform} not yet supported for direct messaging` };
      }
    } catch (err) {
      platformResult = {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send message",
      };
    }

    // Update message status
    await db
      .update(crmDirectMessages)
      .set({
        status: platformResult.success ? "sent" : "failed",
        platformMessageId: platformResult.messageId || null,
        errorMessage: platformResult.error || null,
        ...(platformResult.success && { deliveredAt: new Date() }),
      })
      .where(eq(crmDirectMessages.id, message.id));

    if (platformResult.success) {
      // Publish CRM event - stored in events table, queried via /api/events/crm
      await publisher.crm.messageSent(
        { organizationId, clientId, performedBy: sentBy, triggeredBy: "manual" },
        { messageId: message.id, channelId, platform: channel.platform, content, status: "sent" }
      );

      log.info(
        { clientId, organizationId, messageId: message.id, channelId },
        "crmMessagingService:sendDirectMessage:success"
      );
      return {
        success: true,
        messageId: message.id,
        platformMessageId: platformResult.messageId,
      };
    } else {
      log.warn(
        { clientId, organizationId, messageId: message.id, error: platformResult.error },
        "crmMessagingService:sendDirectMessage:failed"
      );
      return {
        success: false,
        messageId: message.id,
        error: platformResult.error,
      };
    }
  } catch (error) {
    log.error(
      { organizationId, input, err: serializeError(error) },
      "crmMessagingService:sendDirectMessage:error"
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get message history for a client
 */
export async function getClientMessages(
  ctx: CrmServiceContext,
  clientId: string,
  limit = 50,
  offset = 0
): Promise<DirectMessage[]> {
  const { db, organizationId } = ctx;
  try {
    const messages = await db
      .select()
      .from(crmDirectMessages)
      .where(
        and(
          eq(crmDirectMessages.clientId, clientId),
          eq(crmDirectMessages.organizationId, organizationId)
        )
      )
      .orderBy(desc(crmDirectMessages.sentAt))
      .limit(limit)
      .offset(offset);

    return messages.map((message) => ({
      id: message.id,
      clientId: message.clientId,
      content: message.content,
      status: message.status ?? "pending",
      sentBy: message.sentBy,
      sentByName: null,
      sentAt: message.sentAt ?? null,
      deliveredAt: message.deliveredAt ?? null,
      createdAt: message.sentAt ?? null,
      errorMessage: message.errorMessage ?? null,
    }));
  } catch (error) {
    log.error(
      { clientId, organizationId, err: serializeError(error) },
      "crmMessagingService:getClientMessages:error"
    );
    throw error;
  }
}

// =============================================================================
// TELEGRAM INTEGRATION
// =============================================================================

interface TelegramSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
  };
  description?: string;
}

/**
 * Send a message via Telegram Bot API
 *
 * Uses circuit breaker protection to fail fast if Telegram API is unavailable.
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<TelegramSendResult> {
  try {
    const response = await telegramFetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );

    const data = (await response.json()) as TelegramApiResponse;

    if (data.ok && data.result) {
      return {
        success: true,
        messageId: String(data.result.message_id),
      };
    } else {
      return {
        success: false,
        error: data.description || "Unknown Telegram error",
      };
    }
  } catch (error) {
    // Circuit breaker is open - provide clear error message
    if (error instanceof CircuitOpenError) {
      log.warn({ error: error.message }, "crmMessagingService:telegramCircuitOpen");
      return {
        success: false,
        error: "Telegram API is temporarily unavailable (circuit breaker open)",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send Telegram message",
    };
  }
}
