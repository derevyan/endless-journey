/**
 * Telegram Webhook Routes
 *
 * Handles incoming Telegram updates and routes them to the appropriate
 * session engine for processing.
 *
 * Uses Redis for distributed session caching and locking to enable
 * horizontal scaling across multiple API instances.
 *
 * @module modules/channels/webhooks/telegram
 */

import type { SessionEngine } from "@journey/engine";
import { createLogger, serializeError } from "@journey/logger";
import type { Context } from "hono";
import { Hono } from "hono";

import { TelegramAdapter, parseUpdate, type TelegramUpdate } from "../../../adapters/telegram";
import { getRequestId } from "../../../lib/request-logger";
import { getCachedSession } from "../../../services/session-cache-service";
import { createConfiguredEngine } from "../../../services/session-engine-factory";
import { acquireSessionLock, releaseSessionLock } from "../../../services/session-lock-service";
import { extractTeleportData, handleTeleport, hasTeleportMarker } from "../services/teleport-service";
import {
  clearCache,
  emitSessionCompleted,
  emitSessionStarted,
  finalizeSession,
  loadNodeOutputs,
} from "../../../services/session-runtime";
import { isDuplicateTelegramUpdate } from "./telegram-idempotency";
import { createServicesForOrganization, createServicesForSystem } from "../../../services";

const log = createLogger("api:telegram-webhook");

function normalizeSessionStatus(status: unknown): "active" | "completed" | "dropped" | "paused" {
  if (status === "active" || status === "completed" || status === "dropped" || status === "paused") {
    return status;
  }
  return "active";
}

const telegramWebhook = new Hono();

/**
 * POST /webhook/telegram/:channelId
 *
 * Handle incoming Telegram updates for a specific bot.
 *
 * Flow:
 * 1. Validate the bot exists and is active
 * 2. Parse the Telegram update
 * 3. Find or create the channel user
 * 4. Find or create an active session
 * 5. Process the update with SessionEngine
 */
telegramWebhook.post("/:channelId", async (c: Context) => {
  const channelId = c.req.param("channelId");
  const requestId = getRequestId(c) ?? crypto.randomUUID();
  const requestLog = log.child({ requestId, channelId });

  try {
    const systemServices = createServicesForSystem();

    // Get the bot
    const bot = await systemServices.channel.getChannelBot(channelId);
    if (!bot) {
      requestLog.warn({}, "webhook:botNotFound");
      return c.json({ ok: false, error: "Bot not found" }, 404);
    }

    if (!bot.isActive) {
      requestLog.warn({}, "webhook:botInactive");
      return c.json({ ok: false, error: "Bot is inactive" }, 403);
    }

    // Validate webhook secret token (authenticity verification)
    // Telegram sends this in X-Telegram-Bot-Api-Secret-Token header
    if (bot.webhookSecret) {
      const headerToken = c.req.header("X-Telegram-Bot-Api-Secret-Token");
      if (headerToken !== bot.webhookSecret) {
        requestLog.warn({}, "webhook:invalidSecretToken");
        return c.json({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    // Parse the update
    const update: TelegramUpdate = await c.req.json();

    // Trace: Log raw incoming update
    requestLog.trace({ rawUpdate: update }, "webhook:trace:rawUpdate");

    const parsed = parseUpdate(update);

    if (!parsed) {
      requestLog.debug({ updateId: update.update_id }, "webhook:updateIgnored");
      return c.json({ ok: true }); // Acknowledge but don't process
    }

    const isDuplicate = await isDuplicateTelegramUpdate(channelId, update.update_id);
    if (isDuplicate) {
      requestLog.info({ updateId: update.update_id }, "webhook:updateDuplicate:ignored");
      return c.json({ ok: true });
    }

    // Trace: Log parsed update details
    requestLog.trace(
      {
        updateId: update.update_id,
        chatId: parsed.chatId,
        userId: parsed.userId,
        text: parsed.text,
        isCallbackQuery: parsed.isCallbackQuery,
        firstName: parsed.firstName,
        username: parsed.username,
      },
      "webhook:trace:parsedUpdate"
    );

    requestLog.info(
      {
        updateId: update.update_id,
        chatId: parsed.chatId,
        isCallback: parsed.isCallbackQuery,
      },
      "webhook:updateReceived"
    );

    // Get organization ID from bot's channel
    const channelOrgId = await systemServices.channel.getChannelOrganizationId(channelId);
    if (!channelOrgId) {
      requestLog.error({}, "webhook:channelMissingOrgId");
      return c.json({ ok: false, error: "Channel misconfigured" }, 500);
    }

    const services = createServicesForOrganization({ organizationId: channelOrgId });

    // Find or create the channel user (Telegram)
    const clientId = await services.channel.findOrCreateChannelUser({
      platform: "telegram",
      platformUserId: String(parsed.userId),
      organizationId: channelOrgId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      username: parsed.username,
    });

    // Get client data for template bindings
    const clientData = await services.channel.getClientById(clientId);

    // Find or create session
    let session = await services.channel.findActiveSession(clientId, channelId);
    let isNewSession = false;
    let startNodeId: string | undefined;

    // If session exists but is completed, ignore the message (stop means stop)
    // User cannot restart a journey after reaching the End Node
    if (session && session.status === "completed") {
      requestLog.info(
        { sessionId: session.id, status: session.status },
        "webhook:sessionCompleted:ignoringMessage"
      );
      return c.json({ ok: true });
    }

    // Check if existing session's journey matches bot's current configuration
    if (session) {
      const journeyMismatch = session.journeyId !== bot.defaultJourneyId;

      if (journeyMismatch) {
        requestLog.info(
          { sessionId: session.id, sessionJourneyId: session.journeyId, botDefaultJourneyId: bot.defaultJourneyId },
          "webhook:sessionJourneyMismatch:droppingSession"
        );

        // Mark old session as dropped and clear from cache
        await services.channel.updateSession(session.id, { status: "dropped" });
        await clearCache(session.id);
        session = null; // Force new session creation or "not configured" message
      }
    }

    if (!session) {
      // Check if bot has a default journey
      if (!bot.defaultJourneyId) {
        requestLog.warn({ channelId }, "webhook:noDefaultJourney");
        // Just log and keep silent to avoid spamming users. Journey disconnected from messaging channel for a reason.
        requestLog.debug({ channelId }, "webhook:noDefaultJourney:silent");
        return c.json({ ok: true });
      }

      // Load the journey config to find the start node
      const journeyConfig = await services.channel.getJourneyConfig(bot.defaultJourneyId);
      if (!journeyConfig) {
        requestLog.error({ journeyId: bot.defaultJourneyId }, "webhook:journeyNotFound");
        return c.json({ ok: false, error: "Journey not found" }, 500);
      }

      // Find start node
      const startNode = journeyConfig.nodes.find((n) => n.data.type === "start");
      if (!startNode) {
        requestLog.error({ journeyId: bot.defaultJourneyId }, "webhook:noStartNode");
        return c.json({ ok: false, error: "Journey has no start node" }, 500);
      }

      startNodeId = startNode.id;

      // Create new session (will throw if journey is not active)
      try {
        session = await services.channel.createSession(
          clientId,
          channelId,
          bot.defaultJourneyId,
          startNodeId,
          channelOrgId
        );
        isNewSession = true;
      } catch (error) {
        // Silent return for inactive journeys - don't spam users
        if (error instanceof Error && error.message.includes("not active")) {
          requestLog.info({ journeyId: bot.defaultJourneyId }, "webhook:journeyNotActive:blockingNewSession");
          return c.json({ ok: true });
        }
        throw error;
      }
    }

    // =========================================================================
    // DISTRIBUTED LOCK & SESSION PROCESSING
    // =========================================================================
    // Acquire lock to prevent race conditions across API instances
    const sessionLock = await acquireSessionLock(session.id, {
      waitTimeoutMs: 15_000, // Wait up to 15s for lock
    });

    if (!sessionLock) {
      requestLog.warn({ sessionId: session.id }, "webhook:lockAcquisitionFailed");
      return c.json({ ok: false, error: "Service temporarily unavailable" }, 503);
    }

    try {
      // Check Redis cache for session state
      const cachedState = await getCachedSession(session.id);
      const cacheHit = !!cachedState;

      // Trace: Log session lookup
      requestLog.trace(
        {
          sessionId: session.id,
          cacheHit,
          sessionStatus: session.status,
          currentNodeId: session.currentNodeId,
          journeyId: session.journeyId,
        },
        "webhook:trace:sessionLookup"
      );

      // Create engine (either from cache or fresh)
      let engine: SessionEngine;
      let organizationId: string;

      if (cachedState) {
        // Reconstruct engine from cached state
        // CRITICAL: Pass all cached session fields to preserve stateful handler state
        // (Agent workflowInitialized, Questionnaire currentIndex, etc.)
        const result = await createConfiguredEngine({
          session: {
            ...session,
            currentNodeId: cachedState.session.currentNodeId,
            context: cachedState.session.context,
            status: normalizeSessionStatus(cachedState.session.status),
          },
          bot,
          channelId,
          logger: requestLog,
          clientData: clientData ?? undefined,
          adapterType: "telegram",
          services,
          // Restore all cached session state fields
          nodeOutputs: cachedState.session.nodeOutputs,
          pendingTimers: cachedState.session.pendingTimers,
          pendingPluginFollowUps: cachedState.session.pendingPluginFollowUps,
          history: cachedState.session.history,
          activeButtons: cachedState.session.activeButtons,
        });
        engine = result.engine;
        organizationId = result.organizationId;

        requestLog.debug({ sessionId: session.id }, "webhook:engineReconstructedFromCache");

        // Debug: Trace activeButtons loaded from cache for button click issues
        requestLog.info(
          {
            sessionId: session.id,
            hasActiveButtons: !!cachedState.session.activeButtons,
            activeButtonCount: cachedState.session.activeButtons?.length,
            activeButtonIds: cachedState.session.activeButtons?.map((b) => b.id),
            activeButtonTexts: cachedState.session.activeButtons?.map((b) => b.text),
          },
          "webhook:cacheLoaded:activeButtons"
        );
      } else {
        // Cache miss - load nodeOutputs from DB for session recovery
        // This preserves stateful handler state (Agent, Questionnaire) across cache expiry
        const persistedNodeOutputs = isNewSession
          ? undefined
          : await loadNodeOutputs(session.id);

        // Create fresh engine (with persisted nodeOutputs if available)
        const result = await createConfiguredEngine({
          session,
          bot,
          channelId,
          logger: requestLog,
          clientData: clientData ?? undefined,
          adapterType: "telegram",
          services,
          // Restore nodeOutputs from DB for resumed sessions
          nodeOutputs: persistedNodeOutputs,
        });
        engine = result.engine;
        organizationId = result.organizationId;

        // Only start the engine for NEW sessions
        // For resumed sessions (cache-miss), just wait for events - don't re-execute current node
        if (isNewSession) {
          await engine.start();

          const startedSession = engine.getSession();
          await finalizeSession({
            sessionId: session.id,
            session: startedSession,
            logger: requestLog,
            cacheMode: "set",
          });

          requestLog.info(
            { sessionId: session.id, currentNodeId: startedSession.currentNodeId, status: startedSession.status },
            "webhook:engineStarted"
          );

          await emitSessionStarted({
            organizationId,
            clientId,
            sessionId: session.id,
            journeyId: session.journeyId,
            channelId,
            source: "webhook",
            startNodeId,
          });

          // Auto-assign client to default CRM pipeline (fire-and-forget)
          services.crm.assignClientToDefaultPipeline(clientId).catch((error) => {
            requestLog.debug({ err: serializeError(error) }, "webhook:crmAutoAssign:failed");
          });

          if (startedSession.status === "completed" || startedSession.status === "dropped") {
            if (hasTeleportMarker(startedSession.context)) {
              const teleportData = extractTeleportData(startedSession.context);
              if (teleportData) {
                requestLog.info(
                  { targetJourneyId: teleportData.targetJourneyId, targetNodeId: teleportData.targetNodeId },
                  "webhook:teleportDetected"
                );

                const teleportResult = await handleTeleport({
                  clientId,
                  channelId,
                  teleportData,
                  previousContext: startedSession.context,
                  bot,
                  clientData: clientData ?? undefined,
                  logger: requestLog,
                  services,
                });

                if (teleportResult.success) {
                  requestLog.info(
                    { newSessionId: teleportResult.session.id, targetJourneyId: teleportData.targetJourneyId },
                    "webhook:teleportSuccess"
                  );
                } else {
                  requestLog.error({ error: teleportResult.error }, "webhook:teleportFailed");
                }

                return c.json({ ok: true });
              }
            }

            await emitSessionCompleted(
              {
                organizationId,
                clientId,
                sessionId: session.id,
                journeyId: session.journeyId,
                channelId,
                source: "webhook",
                finalNodeId: startedSession.currentNodeId,
              },
              startedSession.status
            );
          }
        } else {
          requestLog.info({ sessionId: session.id, currentNodeId: session.currentNodeId }, "webhook:engineResumed");
        }

        // For /start command that created a new session, we're done
        // The session was started and state was saved
        if (isNewSession && parsed.text?.startsWith("/start")) {
          return c.json({ ok: true });
        }
      }

      // Check if this is a /start command for an EXISTING session - ignore it
      // /start is only used to initialize the session, not to trigger transitions
      const isStartCommand = parsed.text?.startsWith("/start");

      if (isStartCommand) {
        requestLog.debug({ text: parsed.text }, "webhook:startCommandIgnored:existingSession");
        return c.json({ ok: true });
      }

      // Trace: Log engine state before processing
      const engineSessionBefore = engine.getSession();
      requestLog.trace(
        {
          sessionId: session.id,
          currentNodeId: engineSessionBefore.currentNodeId,
          status: engineSessionBefore.status,
          pendingTimers: engineSessionBefore.pendingTimers?.length || 0,
          contextKeys: Object.keys(engineSessionBefore.context || {}),
        },
        "webhook:trace:engineStateBefore"
      );

      // Process the update through the adapter
      // Note: User interactions (user.click, user.message) are logged by the engine's
      // event router and persisted via log-consumer through the event bus
      // Pass internal clientId (UUID) for EventRouter validation
      const adapter = engine.getAdapter();
      if (!(adapter instanceof TelegramAdapter)) {
        requestLog.error({ adapterType: adapter.adapterType }, "webhook:adapterMismatch");
        return c.json({ ok: false, error: "Adapter mismatch" }, 500);
      }
      await adapter.processUpdate(update, clientId);

      // Update session state in database
      // Note: tags are handled by the tag service callbacks, not stored in session
      const currentSession = engine.getSession();

      // Trace: Log engine state after processing
      requestLog.trace(
        {
          sessionId: session.id,
          nodeBefore: engineSessionBefore.currentNodeId,
          nodeAfter: currentSession.currentNodeId,
          nodeChanged: engineSessionBefore.currentNodeId !== currentSession.currentNodeId,
          statusBefore: engineSessionBefore.status,
          statusAfter: currentSession.status,
          pendingTimers: currentSession.pendingTimers?.length || 0,
          contextKeys: Object.keys(currentSession.context || {}),
        },
        "webhook:trace:engineStateAfter"
      );

      await finalizeSession({
        sessionId: session.id,
        session: currentSession,
        logger: requestLog,
      });

      if (currentSession.status === "completed" || currentSession.status === "dropped") {
        requestLog.info({ sessionId: session.id, status: currentSession.status }, "webhook:sessionEnded");

        // Check for teleport marker before emitting completion event
        if (hasTeleportMarker(currentSession.context)) {
          const teleportData = extractTeleportData(currentSession.context);

          if (teleportData) {
            requestLog.info(
              { targetJourneyId: teleportData.targetJourneyId, targetNodeId: teleportData.targetNodeId },
              "webhook:teleportDetected"
            );

            // Handle teleport to new journey
            const teleportResult = await handleTeleport({
              clientId,
              channelId,
              teleportData,
              previousContext: currentSession.context,
              bot,
              clientData: clientData ?? undefined,
              logger: requestLog,
              services,
            });

            if (teleportResult.success) {
              requestLog.info(
                { newSessionId: teleportResult.session.id, targetJourneyId: teleportData.targetJourneyId },
                "webhook:teleportSuccess"
              );
            } else {
              requestLog.error({ error: teleportResult.error }, "webhook:teleportFailed");
            }

            // Don't emit journey.session.completed for teleports - it's a transfer, not completion
            return c.json({ ok: true });
          }
        }

        // Emit event for journey completion (only for non-teleport completions)
        await emitSessionCompleted(
          {
            organizationId,
            clientId,
            sessionId: session.id,
            journeyId: session.journeyId,
            channelId,
            source: "webhook",
            finalNodeId: currentSession.currentNodeId,
          },
          currentSession.status
        );
      }

      return c.json({ ok: true });
    } finally {
      // Always release the lock
      await releaseSessionLock(sessionLock);
    }
  } catch (error) {
    requestLog.error({ err: serializeError(error) }, "webhook:error");
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export { telegramWebhook };
