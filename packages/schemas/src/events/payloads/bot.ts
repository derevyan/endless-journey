/**
 * Bot Event Payloads
 *
 * Payload schemas for bot lifecycle events.
 *
 * @module schemas/events/payloads/bot
 */

import { z } from "zod";

// =============================================================================
// BOT LIFECYCLE EVENTS
// =============================================================================

/**
 * Payload for bot.created event
 * Emitted when a new bot is registered
 */
export const BotCreatedPayloadSchema = z.object({
  botId: z.string(),
  botUsername: z.string().nullable(),
  botName: z.string().nullable(),
  platform: z.string(),
  createdBy: z.string(),
});

export type BotCreatedPayload = z.infer<typeof BotCreatedPayloadSchema>;

/**
 * Payload for bot.updated event
 * Emitted when bot configuration is changed
 */
export const BotUpdatedPayloadSchema = z.object({
  botId: z.string(),
  botUsername: z.string().nullable(),
  changes: z.record(z.string(), z.unknown()),
  updatedBy: z.string(),
});

export type BotUpdatedPayload = z.infer<typeof BotUpdatedPayloadSchema>;

/**
 * Payload for bot.deleted event
 * Emitted when a bot is removed
 */
export const BotDeletedPayloadSchema = z.object({
  botId: z.string(),
  botUsername: z.string().nullable(),
  platform: z.string(),
  deletedBy: z.string(),
});

export type BotDeletedPayload = z.infer<typeof BotDeletedPayloadSchema>;

/**
 * Payload for bot.activated event
 * Emitted when a bot is activated
 */
export const BotActivatedPayloadSchema = z.object({
  botId: z.string(),
  botUsername: z.string().nullable(),
  activatedBy: z.string(),
});

export type BotActivatedPayload = z.infer<typeof BotActivatedPayloadSchema>;

/**
 * Payload for bot.deactivated event
 * Emitted when a bot is deactivated
 */
export const BotDeactivatedPayloadSchema = z.object({
  botId: z.string(),
  botUsername: z.string().nullable(),
  deactivatedBy: z.string(),
});

export type BotDeactivatedPayload = z.infer<typeof BotDeactivatedPayloadSchema>;

/**
 * Payload for bot.webhook.registered event
 * Emitted when a bot webhook is registered or re-registered
 */
export const BotWebhookRegisteredPayloadSchema = z.object({
  botId: z.string(),
  botUsername: z.string().nullable(),
  webhookUrl: z.string(),
  registeredBy: z.string(),
});

export type BotWebhookRegisteredPayload = z.infer<typeof BotWebhookRegisteredPayloadSchema>;
