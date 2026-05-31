/**
 * Channel Routes
 *
 * CRUD API for Telegram/WhatsApp messaging channels, scoped to organizations.
 *
 * @module modules/channels/routes
 */

import { createLogger } from "@journey/logger";
import { CreateChannelInputSchema, UpdateChannelInputSchema, NotFoundError, BadRequestError } from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson } from "../../../lib/zod-validator";
import { appConfig } from "../../../config";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:channels");

const channels = createProtectedRouter({
  defaultPermission: { resource: "channel", action: "read" },
});

/**
 * GET /channels - List all channels for current organization
 */
channels.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const orgBots = await services.channel.getOrganizationBots(organization.id);
  log.debug({ userId: user.id, organizationId: organization.id, count: orgBots.length }, "channels:list");

  // Mask bot tokens in response (only show last 4 chars)
  const safeBots = orgBots.map((bot) => ({
    ...bot,
    botToken: `...${bot.botToken.slice(-4)}`,
  }));

  return c.json({ bots: safeBots });
});

/**
 * GET /channels/:id - Get a specific channel
 */
channels.get("/:id", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const channelId = c.req.param("id");
  const services = createServicesFromContext(c);

  const bot = await services.channel.getOrganizationBot(channelId, organization.id);

  if (!bot) {
    throw new NotFoundError("Channel", channelId);
  }

  log.debug({ userId: user.id, organizationId: organization.id, channelId }, "channels:get");

  // Mask bot token
  return c.json({
    bot: {
      ...bot,
      botToken: `...${bot.botToken.slice(-4)}`,
    },
  });
});

/**
 * POST /channels - Create a new channel
 *
 * Request body:
 * - botToken: string (required) - Bot token from @BotFather
 */
channels.post(
  "/",
  protect({ permission: { resource: "channel", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateChannelInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    // Get webhook base URL from environment or request
    const webhookBaseUrl =
      appConfig.urls.webhookBaseUrl ||
      appConfig.urls.apiBaseUrl ||
      `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}`;

    const result = await services.channel.createBot(organization.id, user.id, data.botToken, webhookBaseUrl);

    if ("error" in result) {
      log.warn({ userId: user.id, organizationId: organization.id, error: result.error }, "channels:create:validationError");
      throw new BadRequestError(result.error);
    }

    log.info(
      { userId: user.id, organizationId: organization.id, channelId: result.id, botUsername: result.botUsername },
      "channels:create"
    );

    // Mask bot token in response
    return c.json(
      {
        bot: {
          ...result,
          botToken: `...${result.botToken.slice(-4)}`,
        },
      },
      201
    );
  }
);

/**
 * PUT /channels/:id - Update a channel
 *
 * Request body (all optional):
 * - defaultJourneyId: string | null - UUID of the default journey
 * - isActive: boolean - Whether the channel is active
 * - botName: string - Display name for the channel
 */
channels.put(
  "/:id",
  protect({ permission: { resource: "channel", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const channelId = c.req.param("id");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateChannelInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const bot = await services.channel.updateBot(channelId, organization.id, {
      defaultJourneyId: data.defaultJourneyId,
      isActive: data.isActive,
      botName: data.botName,
    });

    if (!bot) {
      throw new NotFoundError("Channel", channelId);
    }

    log.info({ userId: user.id, organizationId: organization.id, channelId }, "channels:update");

    return c.json({
      bot: {
        ...bot,
        botToken: `...${bot.botToken.slice(-4)}`,
      },
    });
  }
);

/**
 * DELETE /channels/:id - Delete a channel
 */
channels.delete(
  "/:id",
  protect({ permission: { resource: "channel", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const channelId = c.req.param("id");
    const services = createServicesFromContext(c);

    const deleted = await services.channel.deleteBot(channelId, organization.id);

    if (!deleted) {
      throw new NotFoundError("Channel", channelId);
    }

    log.info({ userId: user.id, organizationId: organization.id, channelId }, "channels:delete");
    return c.json({ success: true });
  }
);

/**
 * POST /channels/:id/webhook - Re-register webhook for a channel
 *
 * Useful when changing the webhook URL or if the webhook got disconnected.
 */
channels.post(
  "/:id/webhook",
  protect({ permission: { resource: "channel", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const channelId = c.req.param("id");
    const services = createServicesFromContext(c);

    const webhookBaseUrl =
      appConfig.urls.webhookBaseUrl ||
      appConfig.urls.apiBaseUrl ||
      `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}`;

    const success = await services.channel.reregisterWebhook(channelId, organization.id, webhookBaseUrl);

    if (!success) {
      throw new BadRequestError("Failed to register webhook or channel not found");
    }

    log.info({ userId: user.id, organizationId: organization.id, channelId }, "channels:webhook:reregister");
    return c.json({ success: true });
  }
);

export { channels };
