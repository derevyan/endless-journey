/**
 * Bot Event Publishers
 *
 * All bot-related event publishers using the factory pattern.
 *
 * @module events/publishers/bot
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// BOT LIFECYCLE EVENTS
// =============================================================================

export const publishBotCreated = createEventPublisher(EventTypes.BOT_CREATED);
export const publishBotUpdated = createEventPublisher(EventTypes.BOT_UPDATED);
export const publishBotDeleted = createEventPublisher(EventTypes.BOT_DELETED);
export const publishBotActivated = createEventPublisher(EventTypes.BOT_ACTIVATED);
export const publishBotDeactivated = createEventPublisher(EventTypes.BOT_DEACTIVATED);
export const publishBotWebhookRegistered = createEventPublisher(EventTypes.BOT_WEBHOOK_REGISTERED);

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All bot publishers as a single object
 *
 * @example
 * import { bot } from "./publishers";
 * await bot.created(ctx, data);
 */
export const bot = {
  created: publishBotCreated,
  updated: publishBotUpdated,
  deleted: publishBotDeleted,
  activated: publishBotActivated,
  deactivated: publishBotDeactivated,
  webhookRegistered: publishBotWebhookRegistered,
} as const;
