/**
 * Session Service
 *
 * Manages journey session lifecycle operations.
 * Sessions track user progress through journeys.
 *
 * @module modules/channels/services/session-service
 */

import { hashSecret } from "@journey/db";
import { interactions, journeys, journeySessions, messagingChannels } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, NotFoundError } from "@journey/schemas";
import { resolveBotToken, resolveWebhookSecret } from "../../../lib/crypto-utils";
import type {
  BotRecord,
  ChannelSessionRecord,
  ChannelSessionStatus,
  JourneyConfig,
  JourneyMindstateConfig,
  JourneyStatus,
  SaveInteractionParams,
} from "@journey/schemas";
import { desc, eq, and } from "drizzle-orm";
import { appConfig } from "../../../config";
import type { ChannelServiceContext } from "./service-context";

const log = createLogger("session-service");

async function getClientTagsForOrg(
  ctx: ChannelServiceContext,
  clientId: string,
  organizationId: string | null,
  logContext: Record<string, unknown>
): Promise<string[]> {
  if (!organizationId) {
    log.warn({ ...logContext, clientId }, "session:tags:organizationMissing");
    return [];
  }

  return ctx.tagService.getClientTagNames(clientId);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Helper to convert DB session to ChannelSessionRecord with tags
 */
function toChannelSessionRecord(
  session: typeof journeySessions.$inferSelect,
  tags: string[] = [],
  contextOverride: Record<string, unknown> = {}
): ChannelSessionRecord {
  return {
    id: session.id,
    clientId: session.clientId,
    channelId: session.channelId,
    journeyId: session.journeyId,
    currentNodeId: session.currentNodeId,
    status: session.status,
    mode: session.mode,
    context: contextOverride,
    tags,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
  };
}

// =============================================================================
// BOT OPERATIONS
// =============================================================================

/**
 * Get bot by channel ID for webhook/engine operations.
 * No organization scoping - used by telegram-webhook and automation handlers.
 */
export async function getChannelBot(ctx: ChannelServiceContext, channelId: string): Promise<BotRecord | null> {
  const { db } = ctx;
  try {
    const results = await db.select().from(messagingChannels).where(eq(messagingChannels.id, channelId));

    const bot = results[0];
    if (!bot) return null;

    const parityChannelId = process.env.TELEGRAM_PARITY_CHANNEL_ID;
    const parityBotToken = process.env.TELEGRAM_PARITY_BOT_TOKEN;
    const parityWebhookSecret = process.env.TELEGRAM_PARITY_WEBHOOK_SECRET;
    const parityJourneyId = process.env.TELEGRAM_PARITY_JOURNEY_ID;
    const useParityOverrides =
      appConfig.env.isTest && parityChannelId === channelId && !!parityBotToken;

    return {
      id: bot.id,
      userId: bot.userId,
      platform: bot.platform,
      botToken: useParityOverrides ? parityBotToken : resolveBotToken(bot.botTokenEncrypted),
      botUsername: bot.botUsername,
      defaultJourneyId: useParityOverrides && parityJourneyId ? parityJourneyId : bot.defaultJourneyId,
      isActive: bot.isActive,
      webhookSecret: useParityOverrides
        ? parityWebhookSecret || null
        : resolveWebhookSecret(bot.webhookSecretEncrypted),
    };
  } catch (error) {
    log.error({ channelId, err: serializeError(error) }, "session:getChannelBot:error");
    throw error;
  }
}

/**
 * Get organization ID for a messaging channel
 */
export async function getChannelOrganizationId(ctx: ChannelServiceContext, channelId: string): Promise<string | null> {
  const { db } = ctx;
  try {
    const results = await db
      .select({ organizationId: messagingChannels.organizationId })
      .from(messagingChannels)
      .where(eq(messagingChannels.id, channelId))
      .limit(1);

    return results[0]?.organizationId ?? null;
  } catch (error) {
    log.error({ channelId, err: serializeError(error) }, "session:getChannelOrganizationId:error");
    throw error;
  }
}

/**
 * Get bot by token
 */
export async function getBotByToken(ctx: ChannelServiceContext, botToken: string): Promise<BotRecord | null> {
  const { db } = ctx;
  try {
    const tokenHash = hashSecret(botToken);
    const results = await db.select().from(messagingChannels).where(eq(messagingChannels.botTokenHash, tokenHash));

    const bot = results[0];
    if (!bot) return null;

    return {
      id: bot.id,
      userId: bot.userId,
      platform: bot.platform,
      botToken: resolveBotToken(bot.botTokenEncrypted),
      botUsername: bot.botUsername,
      defaultJourneyId: bot.defaultJourneyId,
      isActive: bot.isActive,
      webhookSecret: resolveWebhookSecret(bot.webhookSecretEncrypted),
    };
  } catch (error) {
    log.error({ err: serializeError(error) }, "session:getBotByTokenError");
    throw error;
  }
}

// =============================================================================
// SESSION OPERATIONS
// =============================================================================

/**
 * Find the most recent session for a channel user and bot (regardless of status)
 * Returns the latest session to check if user has completed a journey
 */
export async function findActiveSession(
  ctx: ChannelServiceContext,
  clientId: string,
  channelId: string
): Promise<ChannelSessionRecord | null> {
  const { db } = ctx;
  try {
    const results = await db
      .select()
      .from(journeySessions)
      .where(and(eq(journeySessions.clientId, clientId), eq(journeySessions.channelId, channelId)))
      .orderBy(desc(journeySessions.updatedAt))
      .limit(1);

    if (!results[0]) return null;

    // Fetch tags separately (stored in client_tags table)
    const organizationId = await getChannelOrganizationId(ctx, channelId);
    if (!organizationId) {
      throw new NotFoundError("Channel organization", channelId);
    }
    const tags = await getClientTagsForOrg(ctx, clientId, organizationId, { channelId });
    return toChannelSessionRecord(results[0], tags);
  } catch (error) {
    log.error({ clientId, channelId, err: serializeError(error) }, "session:findActiveError");
    throw error;
  }
}

/**
 * Create a new session
 *
 * @param clientId - Client ID
 * @param channelId - Channel ID
 * @param journeyId - Journey ID
 * @param startNodeId - Start node ID
 * @param organizationId - Organization ID
 * @param initialContext - Optional initial context (e.g., from teleport)
 */
export async function createSession(
  ctx: ChannelServiceContext,
  clientId: string,
  channelId: string,
  journeyId: string,
  startNodeId: string,
  organizationId: string,
  initialContext?: Record<string, unknown>
): Promise<ChannelSessionRecord> {
  const { db } = ctx;
  try {
    // Check journey is active before creating session
    const journeyStatus = await getJourneyStatus(ctx, journeyId);
    if (journeyStatus !== "active") {
      throw new BadRequestError(`Journey is not active (status: ${journeyStatus})`, { journeyId });
    }

    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId,
        organizationId,
        channelId,
        journeyId,
        currentNodeId: startNodeId,
        status: "active",
        mode: "live",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.info({ sessionId: session.id, clientId, channelId, journeyId, hasInitialContext: !!initialContext }, "session:created");

    // New sessions start with empty tags
    return toChannelSessionRecord(session, [], initialContext ?? {});
  } catch (error) {
    log.error({ clientId, channelId, journeyId, err: serializeError(error) }, "session:createError");
    throw error;
  }
}

/**
 * Update session state
 */
export async function updateSession(
  ctx: ChannelServiceContext,
  sessionId: string,
  data: {
    currentNodeId?: string;
    status?: ChannelSessionStatus;
    completedAt?: Date;
  }
): Promise<void> {
  const { db } = ctx;
  try {
    await db
      .update(journeySessions)
      .set({
        ...(data.currentNodeId !== undefined && { currentNodeId: data.currentNodeId }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
        updatedAt: new Date(),
      })
      .where(eq(journeySessions.id, sessionId));

    log.debug({ sessionId }, "session:updated");
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "session:updateError");
    throw error;
  }
}

/**
 * Get session by ID
 */
export async function getSessionById(ctx: ChannelServiceContext, sessionId: string): Promise<ChannelSessionRecord | null> {
  const { db } = ctx;
  try {
    const results = await db.select().from(journeySessions).where(eq(journeySessions.id, sessionId));

    if (!results[0]) return null;

    // Fetch tags separately (stored in client_tags table)
    const organizationId = await getJourneyOrganizationId(ctx, results[0].journeyId);
    const tags = await getClientTagsForOrg(ctx, results[0].clientId, organizationId, { sessionId });
    return toChannelSessionRecord(results[0], tags);
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "session:getError");
    throw error;
  }
}

/**
 * Delete a single session and all its interactions
 * Interactions and timers are cascade-deleted via FK constraints
 */
export async function deleteSession(ctx: ChannelServiceContext, sessionId: string): Promise<boolean> {
  const { db } = ctx;
  try {
    log.info({ sessionId }, "session:delete:start");

    const result = await db.delete(journeySessions).where(eq(journeySessions.id, sessionId)).returning({ id: journeySessions.id });

    if (result.length === 0) {
      log.warn({ sessionId }, "session:delete:notFound");
      return false;
    }

    log.info({ sessionId }, "session:delete:success");
    return true;
  } catch (error) {
    log.error({ sessionId, err: serializeError(error) }, "session:delete:error");
    throw error;
  }
}

// =============================================================================
// JOURNEY OPERATIONS
// =============================================================================

/**
 * Get journey config by ID
 */
export async function getJourneyConfig(ctx: ChannelServiceContext, journeyId: string): Promise<JourneyConfig | null> {
  const { db } = ctx;
  try {
    const results = await db.select({ configuration: journeys.configuration }).from(journeys).where(eq(journeys.id, journeyId));

    if (results.length === 0) {
      return null;
    }

    return results[0].configuration as JourneyConfig;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "session:getJourneyError");
    throw error;
  }
}

/**
 * Get organization ID for a journey
 */
export async function getJourneyOrganizationId(ctx: ChannelServiceContext, journeyId: string): Promise<string | null> {
  const { db } = ctx;
  try {
    const results = await db.select({ organizationId: journeys.organizationId }).from(journeys).where(eq(journeys.id, journeyId));

    if (results.length === 0) {
      return null;
    }

    return results[0].organizationId;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "session:getJourneyOrganizationId:error");
    throw error;
  }
}

/**
 * Get journey's default pipeline ID
 */
export async function getJourneyDefaultPipelineId(ctx: ChannelServiceContext, journeyId: string): Promise<string | null> {
  const { db } = ctx;
  try {
    const results = await db
      .select({ defaultPipelineId: journeys.defaultPipelineId })
      .from(journeys)
      .where(eq(journeys.id, journeyId));

    if (results.length === 0) {
      return null;
    }

    return results[0].defaultPipelineId;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "session:getJourneyDefaultPipelineId:error");
    throw error;
  }
}

/**
 * Get journey's mindstate configuration
 * Used by session engine factory to initialize mindstate analysis
 */
export async function getJourneyMindstateConfig(
  ctx: ChannelServiceContext,
  journeyId: string
): Promise<JourneyMindstateConfig | null> {
  const { db } = ctx;
  try {
    const results = await db
      .select({ mindstateConfig: journeys.mindstateConfig })
      .from(journeys)
      .where(eq(journeys.id, journeyId));

    if (results.length === 0) {
      return null;
    }

    return results[0].mindstateConfig;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "session:getJourneyMindstateConfig:error");
    throw error;
  }
}

/**
 * Get journey name by ID
 */
export async function getJourneyName(ctx: ChannelServiceContext, journeyId: string): Promise<string | null> {
  const { db } = ctx;
  try {
    const results = await db.select({ name: journeys.name }).from(journeys).where(eq(journeys.id, journeyId));

    if (results.length === 0) {
      return null;
    }

    return results[0].name;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "session:getJourneyName:error");
    throw error;
  }
}

/**
 * Get journey status by ID
 * Used by webhook to check if journey is active before creating new sessions
 */
export async function getJourneyStatus(ctx: ChannelServiceContext, journeyId: string): Promise<JourneyStatus | null> {
  const { db } = ctx;
  try {
    const results = await db.select({ status: journeys.status }).from(journeys).where(eq(journeys.id, journeyId));

    if (results.length === 0) {
      return null;
    }

    return results[0].status;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "session:getJourneyStatus:error");
    throw error;
  }
}

// =============================================================================
// INTERACTIONS
// =============================================================================

/**
 * Save an interaction event to the database
 */
export async function saveInteraction(ctx: ChannelServiceContext, params: SaveInteractionParams): Promise<string> {
  const { db } = ctx;
  try {
    log.debug({ sessionId: params.sessionId, type: params.type, nodeId: params.nodeId }, "session:saveInteraction:start");

    // Generate ID if not provided
    const interactionId = params.id || crypto.randomUUID();

    const [result] = await db
      .insert(interactions)
      .values({
        id: interactionId,
        sessionId: params.sessionId,
        type: params.type,
        nodeId: params.nodeId,
        payload: params.payload,
        metadata: params.metadata,
        timestamp: new Date(),
      })
      .onConflictDoNothing() // ✅ FIX: Handle duplicates gracefully (from parallel saves)
      .returning({ id: interactions.id });

    // If duplicate exists, return the ID
    if (!result) {
      log.debug({ interactionId, sessionId: params.sessionId, type: params.type }, "session:saveInteraction:duplicate");
      return interactionId;
    }

    log.debug({ interactionId: result.id, sessionId: params.sessionId, type: params.type }, "session:saveInteraction:success");

    return result.id;
  } catch (error) {
    log.error({ sessionId: params.sessionId, type: params.type, err: serializeError(error) }, "session:saveInteraction:error");
    throw error;
  }
}
