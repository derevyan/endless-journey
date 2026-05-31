/**
 * Channels Schema - Messaging channels owned by organizations
 *
 * Tables for messaging channels:
 * - messagingChannels: Telegram/WhatsApp channels
 */

import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { journeys, journeyMedia } from "./journey";
import { organization } from "./organization";
import { platformEnum, mediaTypeEnum } from "./enums";

// =============================================================================
// MESSAGING CHANNELS
// =============================================================================

/**
 * Messaging Channels - Telegram/WhatsApp channels owned by organizations
 */
export const messagingChannels = pgTable(
  "messaging_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Organization that owns this channel (required for multi-tenancy)
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // User who added this channel (for tracking)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull().default("telegram"),
    botTokenEncrypted: text("bot_token_encrypted").notNull(),
    botTokenHash: text("bot_token_hash").notNull(),
    botUsername: text("bot_username"),
    botName: text("bot_name"),
    // Default journey to use when user messages this channel
    defaultJourneyId: uuid("default_journey_id").references(() => journeys.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    webhookUrl: text("webhook_url"), // For storing the registered webhook URL
    // Webhook secret for authenticity verification (encrypted + hashed like bot_token)
    webhookSecretEncrypted: text("webhook_secret_encrypted"),
    webhookSecretHash: text("webhook_secret_hash"),
    settings: jsonb("settings").default({}), // Additional channel settings
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_messaging_channels_org").on(table.organizationId),
    // Unique index to ensure bot token hashes are unique across all channels
    uniqueIndex("idx_messaging_channels_token_hash").on(table.botTokenHash),
  ]
);

// =============================================================================
// TELEGRAM FILE CACHE
// =============================================================================

/**
 * Telegram File Cache - Stores file_ids for uploaded media per channel
 *
 * When a video/image is uploaded to Telegram, Telegram returns a file_id.
 * This file_id can be reused to send the same media instantly without re-uploading.
 * file_ids are bot-specific, so we cache per channel (bot).
 */
export const telegramFileCache = pgTable(
  "telegram_file_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => messagingChannels.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => journeyMedia.id, { onDelete: "cascade" }),
    mediaType: mediaTypeEnum("media_type").notNull(),
    fileId: text("file_id").notNull(),
    fileUniqueId: text("file_unique_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_telegram_file_cache_channel_media").on(table.channelId, table.mediaId),
    index("idx_telegram_file_cache_media").on(table.mediaId),
  ]
);
