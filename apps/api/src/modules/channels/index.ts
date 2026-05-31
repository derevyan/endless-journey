/**
 * Channels Module
 *
 * Public API for the channels domain.
 *
 * @module modules/channels
 */

// Routes
export { channels } from "./routes";
export { telegramWebhook } from "./webhooks/telegram";

// Services (for cross-module use)
export * from "./services";
