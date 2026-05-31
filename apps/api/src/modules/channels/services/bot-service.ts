/**
 * Bot Service
 *
 * CRUD operations for Telegram/WhatsApp bots, scoped to organizations.
 *
 * @module modules/channels/services/bot-service
 */

import { decrypt, hashSecret, safeEncrypt } from "@journey/db";
import { journeys, member, messagingChannels } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { isJourneyUuid, NotFoundError } from "@journey/schemas";
import type { BotRecord } from "@journey/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { deleteWebhook, setWebhook } from "../../../adapters/telegram";
import { resolveBotToken, resolveBotTokenForDisplay } from "../../../lib/crypto-utils";
import type { ChannelServiceContext } from "./service-context";

const log = createLogger("bot-service");

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface TelegramGetMeResponse {
  ok: boolean;
  result?: TelegramBotInfo;
  description?: string;
}

// =============================================================================
// TELEGRAM API HELPERS
// =============================================================================

/**
 * Validate a bot token by calling Telegram's getMe API
 */
export async function validateBotToken(botToken: string): Promise<TelegramBotInfo | null> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = (await response.json()) as TelegramGetMeResponse;

    if (data.ok && data.result) {
      log.info({ botUsername: data.result.username }, "botService:validateToken:success");
      return data.result;
    }

    log.warn({ error: data.description }, "botService:validateToken:failed");
    return null;
  } catch (error) {
    log.error({ err: serializeError(error) }, "botService:validateToken:error");
    return null;
  }
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all bots for an organization
 */
export async function getOrganizationBots(ctx: ChannelServiceContext, organizationId: string): Promise<BotRecord[]> {
  const { db } = ctx;
  try {
    const results = await db
      .select({
        id: messagingChannels.id,
        organizationId: messagingChannels.organizationId,
        userId: messagingChannels.userId,
        platform: messagingChannels.platform,
        botTokenEncrypted: messagingChannels.botTokenEncrypted,
        botTokenHash: messagingChannels.botTokenHash,
        botUsername: messagingChannels.botUsername,
        botName: messagingChannels.botName,
        defaultJourneyId: messagingChannels.defaultJourneyId,
        isActive: messagingChannels.isActive,
        webhookUrl: messagingChannels.webhookUrl,
        settings: messagingChannels.settings,
        createdAt: messagingChannels.createdAt,
        updatedAt: messagingChannels.updatedAt,
        // Join to get journey info
        defaultJourneySlug: journeys.slug,
        defaultJourneyName: journeys.name,
      })
      .from(messagingChannels)
      .leftJoin(journeys, eq(messagingChannels.defaultJourneyId, journeys.id))
      .where(eq(messagingChannels.organizationId, organizationId));

    log.debug({ organizationId, count: results.length }, "botService:getOrganizationBots");
    return results.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      platform: row.platform,
      botToken: resolveBotTokenForDisplay(row.botTokenEncrypted, row.botTokenHash),
      botUsername: row.botUsername,
      botName: row.botName,
      defaultJourneyId: row.defaultJourneyId,
      isActive: row.isActive,
      webhookUrl: row.webhookUrl,
      settings: row.settings as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      defaultJourneySlug: row.defaultJourneySlug,
      defaultJourneyName: row.defaultJourneyName,
    })) as BotRecord[];
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "botService:getOrganizationBots:error");
    throw error;
  }
}

/**
 * Get a specific bot by ID (if it belongs to organization)
 *
 * Also handles bots with null organizationId that belong to users in this organization.
 * Used for admin operations that require organization scoping.
 */
export async function getOrganizationBot(
  ctx: ChannelServiceContext,
  botId: string,
  organizationId: string
): Promise<BotRecord | null> {
  const { db } = ctx;
  try {
    // First try direct match with organizationId
    let results = await db
      .select({
        id: messagingChannels.id,
        organizationId: messagingChannels.organizationId,
        userId: messagingChannels.userId,
        platform: messagingChannels.platform,
        botTokenEncrypted: messagingChannels.botTokenEncrypted,
        botTokenHash: messagingChannels.botTokenHash,
        botUsername: messagingChannels.botUsername,
        botName: messagingChannels.botName,
        defaultJourneyId: messagingChannels.defaultJourneyId,
        isActive: messagingChannels.isActive,
        webhookUrl: messagingChannels.webhookUrl,
        settings: messagingChannels.settings,
        createdAt: messagingChannels.createdAt,
        updatedAt: messagingChannels.updatedAt,
        defaultJourneySlug: journeys.slug,
        defaultJourneyName: journeys.name,
      })
      .from(messagingChannels)
      .leftJoin(journeys, eq(messagingChannels.defaultJourneyId, journeys.id))
      .where(and(eq(messagingChannels.id, botId), eq(messagingChannels.organizationId, organizationId)));

    // If not found, check if bot has null organizationId but belongs to a user in this org
    if (results.length === 0) {
      const botWithNullOrg = await db
        .select({
          id: messagingChannels.id,
          organizationId: messagingChannels.organizationId,
          userId: messagingChannels.userId,
          platform: messagingChannels.platform,
          botTokenEncrypted: messagingChannels.botTokenEncrypted,
          botTokenHash: messagingChannels.botTokenHash,
          botUsername: messagingChannels.botUsername,
          botName: messagingChannels.botName,
          defaultJourneyId: messagingChannels.defaultJourneyId,
          isActive: messagingChannels.isActive,
          webhookUrl: messagingChannels.webhookUrl,
          settings: messagingChannels.settings,
          createdAt: messagingChannels.createdAt,
          updatedAt: messagingChannels.updatedAt,
          defaultJourneySlug: journeys.slug,
          defaultJourneyName: journeys.name,
        })
        .from(messagingChannels)
        .leftJoin(journeys, eq(messagingChannels.defaultJourneyId, journeys.id))
        .where(and(eq(messagingChannels.id, botId), isNull(messagingChannels.organizationId)));

      if (botWithNullOrg.length > 0) {
        const bot = botWithNullOrg[0];
        // Verify the bot's user is a member of this organization
        const userMembership = await db
          .select({ userId: member.userId })
          .from(member)
          .where(and(eq(member.userId, bot.userId), eq(member.organizationId, organizationId)));

        if (userMembership.length > 0) {
          // Fix the bot's organizationId
          await db.update(messagingChannels).set({ organizationId, updatedAt: new Date() }).where(eq(messagingChannels.id, botId));

          log.info({ botId, organizationId, userId: bot.userId }, "botService:getOrganizationBot:fixedOrphanedBot");

          bot.organizationId = organizationId;
          results = [bot];
        }
      }
    }

    log.debug({ botId, organizationId, found: results.length > 0 }, "botService:getOrganizationBot");
    const bot = results[0];
    if (!bot) return null;
    return {
      id: bot.id,
      organizationId: bot.organizationId,
      userId: bot.userId,
      platform: bot.platform,
      botToken: resolveBotTokenForDisplay(bot.botTokenEncrypted, bot.botTokenHash),
      botUsername: bot.botUsername,
      botName: bot.botName,
      defaultJourneyId: bot.defaultJourneyId,
      isActive: bot.isActive,
      webhookUrl: bot.webhookUrl,
      settings: bot.settings as Record<string, unknown>,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
      defaultJourneySlug: bot.defaultJourneySlug,
      defaultJourneyName: bot.defaultJourneyName,
    };
  } catch (error) {
    log.error({ botId, organizationId, err: serializeError(error) }, "botService:getOrganizationBot:error");
    throw error;
  }
}

/**
 * Create a new bot for an organization
 *
 * Validates the token with Telegram API and registers the webhook.
 */
export async function createBot(
  ctx: ChannelServiceContext,
  organizationId: string,
  userId: string,
  botToken: string,
  webhookBaseUrl: string
): Promise<BotRecord | { error: string }> {
  const { db, publisher } = ctx;
  try {
    // Validate organizationId is provided
    if (!organizationId) {
      log.error({ userId }, "botService:createBot:missingOrganizationId");
      return { error: "Organization context is required to create a bot." };
    }

    // Validate token with Telegram API
    const botInfo = await validateBotToken(botToken);
    if (!botInfo) {
      return { error: "Invalid bot token. Please check the token from @BotFather." };
    }

    // Check if bot already exists within this organization (by username to prevent duplicates)
    const existing = await db
      .select()
      .from(messagingChannels)
      .where(and(eq(messagingChannels.botUsername, botInfo.username), eq(messagingChannels.organizationId, organizationId)));

    if (existing.length > 0) {
      return { error: `Bot @${botInfo.username} is already registered.` };
    }

    // Generate webhook secret for authenticity verification
    // Telegram will send this in X-Telegram-Bot-Api-Secret-Token header
    const webhookSecret = crypto.randomUUID();
    const botTokenEncrypted = safeEncrypt(botToken);
    const botTokenHash = hashSecret(botToken);

    // Encrypt webhook secret for storage (same pattern as bot token)
    const webhookSecretEncrypted = safeEncrypt(webhookSecret);
    const webhookSecretHash = hashSecret(webhookSecret);

    // Create the bot record
    const [newBot] = await db
      .insert(messagingChannels)
      .values({
        organizationId,
        userId,
        platform: "telegram",
        botTokenEncrypted,
        botTokenHash,
        botUsername: botInfo.username,
        botName: botInfo.first_name,
        isActive: true,
        webhookSecretEncrypted,
        webhookSecretHash,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Register webhook with Telegram (including secret token)
    const webhookUrl = `${webhookBaseUrl}/webhook/telegram/${newBot.id}`;
    const webhookSet = await setWebhook(botToken, webhookUrl, webhookSecret);

    if (webhookSet) {
      // Update bot with webhook URL
      await db.update(messagingChannels).set({ webhookUrl, updatedAt: new Date() }).where(eq(messagingChannels.id, newBot.id));

      newBot.webhookUrl = webhookUrl;
    } else {
      log.warn({ botId: newBot.id }, "botService:createBot:webhookFailed");
    }

    log.info({ botId: newBot.id, botUsername: botInfo.username, organizationId, userId }, "botService:createBot");

    // Publish bot.created event
    await publisher.bot.created(
      { organizationId, performedBy: userId },
      { botId: newBot.id, botUsername: botInfo.username, botName: botInfo.first_name, platform: "telegram" }
    );

    // Mask the original token for display (no need to decrypt what we just encrypted)
    const maskedToken = `...${botToken.slice(-4)}`;

    return {
      id: newBot.id,
      organizationId: newBot.organizationId,
      userId: newBot.userId,
      platform: newBot.platform,
      botToken: maskedToken,
      botUsername: newBot.botUsername,
      botName: newBot.botName,
      defaultJourneyId: newBot.defaultJourneyId,
      isActive: newBot.isActive,
      webhookUrl: newBot.webhookUrl,
      settings: newBot.settings as Record<string, unknown>,
      createdAt: newBot.createdAt,
      updatedAt: newBot.updatedAt,
      defaultJourneySlug: null,
      defaultJourneyName: null,
    } as BotRecord;
  } catch (error) {
    log.error({ organizationId, userId, err: serializeError(error) }, "botService:createBot:error");
    throw error;
  }
}

/**
 * Update a bot (if it belongs to organization)
 */
export async function updateBot(
  ctx: ChannelServiceContext,
  botId: string,
  organizationId: string,
  data: {
    defaultJourneyId?: string | null;
    isActive?: boolean;
    botName?: string;
  },
  performedBy?: string
): Promise<BotRecord | null> {
  const { db, publisher, journeyService } = ctx;
  try {
    // Check ownership
    const existing = await getOrganizationBot(ctx, botId, organizationId);
    if (!existing) {
      log.warn({ botId, organizationId }, "botService:updateBot:notFound");
      return null;
    }

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.defaultJourneyId !== undefined) {
      updates.defaultJourneyId = data.defaultJourneyId;
      // Auto-activate journey when connected to a bot
      if (data.defaultJourneyId) {
        if (isJourneyUuid(data.defaultJourneyId)) {
          // First check if journey exists and needs activation
          const journey = await journeyService.getJourneyById(data.defaultJourneyId, organizationId);
          if (!journey) {
            throw new NotFoundError("Journey", data.defaultJourneyId);
          }

          // If journey is not already active, activate it
          if (journey.status !== "active") {
            // Emit activation event (and resume any paused sessions)
            await journeyService.reactivateJourney(data.defaultJourneyId, organizationId, performedBy);
            // Update status in DB
            await journeyService.updateJourney(data.defaultJourneyId, organizationId, { status: "active" });
            log.info({ journeyId: data.defaultJourneyId, organizationId }, "botService:updateBot:autoActivatedJourney");
          }
        } else {
          log.warn({ journeyId: data.defaultJourneyId, organizationId }, "botService:updateBot:invalidJourneyId");
        }
      }
    }
    if (data.isActive !== undefined) {
      updates.isActive = data.isActive;
    }
    if (data.botName !== undefined) {
      updates.botName = data.botName;
    }

    await db.update(messagingChannels).set(updates).where(eq(messagingChannels.id, existing.id));

    log.info({ botId, organizationId, updates: Object.keys(updates) }, "botService:updateBot");

    // Publish events
    const eventPerformer = performedBy || "system";
    const eventCtx = { organizationId, performedBy: eventPerformer };

    // Handle activation/deactivation events
    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      if (data.isActive) {
        await publisher.bot.activated(eventCtx, { botId, botUsername: existing.botUsername });
      } else {
        await publisher.bot.deactivated(eventCtx, { botId, botUsername: existing.botUsername });
      }
    }

    // Publish general update event (for other changes)
    const changeKeys = Object.keys(updates).filter((k) => k !== "updatedAt");
    if (changeKeys.length > 0) {
      await publisher.bot.updated(eventCtx, { botId, botUsername: existing.botUsername, changes: updates });
    }

    // Return updated bot
    return getOrganizationBot(ctx, botId, organizationId);
  } catch (error) {
    log.error({ botId, organizationId, err: serializeError(error) }, "botService:updateBot:error");
    throw error;
  }
}

/**
 * Delete a bot (if it belongs to organization)
 *
 * Removes the webhook from Telegram before deleting.
 */
export async function deleteBot(
  ctx: ChannelServiceContext,
  botId: string,
  organizationId: string,
  performedBy?: string
): Promise<boolean> {
  const { db, publisher } = ctx;
  try {
    // Get bot with encrypted token for webhook deletion (need actual token, not display version)
    const [bot] = await db
      .select({
        id: messagingChannels.id,
        botTokenEncrypted: messagingChannels.botTokenEncrypted,
        botUsername: messagingChannels.botUsername,
        platform: messagingChannels.platform,
      })
      .from(messagingChannels)
      .where(and(eq(messagingChannels.id, botId), eq(messagingChannels.organizationId, organizationId)));

    if (!bot) {
      log.warn({ botId, organizationId }, "botService:deleteBot:notFound");
      return false;
    }

    // Remove webhook from Telegram using actual decrypted token (throws on decrypt failure)
    await deleteWebhook(resolveBotToken(bot.botTokenEncrypted));

    // Delete the bot
    await db.delete(messagingChannels).where(eq(messagingChannels.id, bot.id));

    log.info({ botId, botUsername: bot.botUsername, organizationId }, "botService:deleteBot");

    // Publish bot.deleted event
    await publisher.bot.deleted(
      { organizationId, performedBy: performedBy || "system" },
      { botId, botUsername: bot.botUsername, platform: bot.platform }
    );

    return true;
  } catch (error) {
    log.error({ botId, organizationId, err: serializeError(error) }, "botService:deleteBot:error");
    throw error;
  }
}

/**
 * Re-register webhook for a bot (e.g., after changing webhook URL)
 *
 * If the bot doesn't have a webhookSecret, generates a new one.
 */
export async function reregisterWebhook(
  ctx: ChannelServiceContext,
  botId: string,
  organizationId: string,
  webhookBaseUrl: string,
  performedBy?: string
): Promise<boolean> {
  const { db, publisher } = ctx;
  try {
    // Get bot with encrypted webhook secret
    const [bot] = await db
      .select({
        id: messagingChannels.id,
        botTokenEncrypted: messagingChannels.botTokenEncrypted,
        botUsername: messagingChannels.botUsername,
        webhookSecretEncrypted: messagingChannels.webhookSecretEncrypted,
      })
      .from(messagingChannels)
      .where(and(eq(messagingChannels.id, botId), eq(messagingChannels.organizationId, organizationId)));

    if (!bot) {
      return false;
    }

    // Decrypt existing secret or generate new one
    const webhookSecret = bot.webhookSecretEncrypted ? decrypt(bot.webhookSecretEncrypted) : crypto.randomUUID();

    const webhookUrl = `${webhookBaseUrl}/webhook/telegram/${bot.id}`;
    const success = await setWebhook(resolveBotToken(bot.botTokenEncrypted), webhookUrl, webhookSecret);

    if (success) {
      // Store encrypted secret and hash
      await db
        .update(messagingChannels)
        .set({
          webhookUrl,
          webhookSecretEncrypted: safeEncrypt(webhookSecret),
          webhookSecretHash: hashSecret(webhookSecret),
          updatedAt: new Date(),
        })
        .where(eq(messagingChannels.id, bot.id));

      // Publish bot.webhook.registered event
      await publisher.bot.webhookRegistered(
        { organizationId, performedBy: performedBy || "system" },
        { botId, botUsername: bot.botUsername, webhookUrl }
      );
    }

    log.info({ botId, success }, "botService:reregisterWebhook");
    return success;
  } catch (error) {
    log.error({ botId, organizationId, err: serializeError(error) }, "botService:reregisterWebhook:error");
    return false;
  }
}
