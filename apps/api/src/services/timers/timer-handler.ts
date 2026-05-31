/**
 * Timer Handler Service
 *
 * Handles timer callbacks from BullMQ to resume journey sessions
 * when wait node timers fire.
 *
 * Supports both Telegram and Simulator adapter types:
 * - Telegram timers: Load bot, create TelegramAdapter, resume journey
 * - Simulator timers: Create SimulatorAdapter, resume journey via SSE events
 *
 * @module services/timers/timer-handler
 */

import { createLogger, serializeError } from "@journey/logger";
import { eq, and } from "drizzle-orm";
import { db, durableTimers } from "@journey/db";

import type { TimerJobData } from "./bull-timer-service";
import { createConfiguredEngine } from "../session-engine-factory";
import { withSessionLock } from "../session-lock-service";
import { getSimulatorSession, updateSimulatorSessionState } from "../../modules/simulator/services/session-manager";
import {
  clearCache,
  emitSessionCompleted,
  finalizeSession,
  getSessionCache,
  loadNodeOutputs,
} from "../session-runtime";
import { createServicesForOrganization, createServicesForSystem } from "../create-services";
import { publishers } from "../../event-bus/publishers";
import type { SimulatorServiceContext } from "../../modules/simulator/services/service-context";

const log = createLogger("timer-handler");

/**
 * Handle a timer firing - resume the session and continue the journey
 */
export async function handleTimerFired(data: TimerJobData): Promise<void> {
  const { sessionId, channelId, edgeId } = data;
  const handlerLog = log.child({ sessionId, channelId, edgeId });

  // Trace: Log full timer job data
  handlerLog.trace(
    {
      jobData: data,
      receivedAt: new Date().toISOString(),
    },
    "timerHandler:trace:jobReceived"
  );

  handlerLog.info({}, "timerHandler:processing");

  // Acquire session lock to prevent race conditions with concurrent webhook processing
  // This ensures timer and webhook don't process the same session simultaneously
  await withSessionLock(
    sessionId,
    async () => {
      // Get cached state BEFORE clearing - preserves nodeOutputs, pendingTimers, etc.
      // These fields aren't stored in DB but are needed for stateful handlers (Agent, Questionnaire)
      const cachedState = await getSessionCache(sessionId);

      // Clear webhook cache - ensures next message uses fresh session state
      await clearCache(sessionId);

      // Trace: Log cache cleared
      handlerLog.trace(
        { sessionId, cacheCleared: true, hadCachedState: !!cachedState },
        "timerHandler:trace:cacheCleared"
      );

      try {
        // 1. Mark timer as fired in PostgreSQL (atomic guard prevents double processing)
        // Using .returning() to check if any rows were updated - if not, timer was already
        // fired by another caller (race condition between skip and BullMQ worker)
        const updatedTimers = await db
          .update(durableTimers)
          .set({ status: "fired" })
          .where(
            and(
              eq(durableTimers.sessionId, sessionId),
              eq(durableTimers.edgeId, edgeId),
              eq(durableTimers.status, "active")
            )
          )
          .returning({ id: durableTimers.id });

        // If no rows updated, timer was already fired/cancelled - exit early
        if (updatedTimers.length === 0) {
          handlerLog.info({ edgeId }, "timerHandler:skipped:alreadyFired");
          return;
        }

        // Trace: Log timer marked as fired
        handlerLog.trace(
          { edgeId, markedAsFired: true, timerId: updatedTimers[0].id },
          "timerHandler:trace:timerMarkedFired"
        );

        // 2. Load the session from database
        const systemServices = createServicesForSystem();
        const session = await systemServices.channel.getSessionById(sessionId);
        if (!session) {
          handlerLog.warn({}, "timerHandler:sessionNotFound");
          return;
        }

        const organizationId = await systemServices.channel.getJourneyOrganizationId(session.journeyId);
        if (!organizationId) {
          handlerLog.warn({ journeyId: session.journeyId }, "timerHandler:organizationNotFound");
          return;
        }

        const services = createServicesForOrganization({ organizationId });
        const simulatorCtx: SimulatorServiceContext = { db, organizationId, publisher: publishers };

        // 2b. Load client data for platformUserId (needed for Telegram adapter)
        const clientData = await services.channel.getClientById(session.clientId);
        if (!clientData) {
          handlerLog.warn({ clientId: session.clientId }, "timerHandler:clientNotFound");
          return;
        }

        // Trace: Log loaded session
        handlerLog.trace(
          {
            sessionId: session.id,
            currentNodeId: session.currentNodeId,
            status: session.status,
            journeyId: session.journeyId,
            contextKeys: Object.keys(session.context || {}),
          },
          "timerHandler:trace:sessionLoaded"
        );

        // Skip if session is no longer active (paused/dropped)
        if (session.status !== "active") {
          handlerLog.info({ status: session.status }, "timerHandler:sessionNotActive");
          return;
        }

        let engine: Awaited<ReturnType<typeof createConfiguredEngine>>["engine"];

        // 3. Handle based on adapter type
        if (data.adapterType === "simulator") {
          // Simulator timer - use cached adapter from session manager to prevent memory leaks
          handlerLog.info({}, "timerHandler:simulatorTimer");

          // Get cached session with adapter (ensures timerMap is properly cleaned)
          const sessionData = await getSimulatorSession(simulatorCtx, services, systemServices, sessionId);
          if (!sessionData) {
            // Session expired or was cleaned up - timer is stale
            handlerLog.warn({}, "timerHandler:simulatorSessionNotFound:staleTimer");
            return;
          }

          const { adapter } = sessionData;

          // Let cached adapter handle the timer event (cleans timerMap, publishes to SSE)
          await adapter.handleTimerFired(data);

          // Update session state after engine processing
          await updateSimulatorSessionState(systemServices, sessionId);

          handlerLog.info({ edgeId }, "timerHandler:simulatorTimer:completed");
          return;
        } else {
          // Telegram timer (default) - load bot
          if (!channelId) {
            handlerLog.warn({}, "timerHandler:noChannelIdForTelegram");
            return;
          }

          const bot = await services.channel.getChannelBot(channelId);
          if (!bot || !bot.isActive) {
            handlerLog.warn({}, "timerHandler:botNotFoundOrInactive");
            return;
          }

          // Trace: Log bot loaded
          handlerLog.trace(
            {
              botId: bot.id,
              botIsActive: bot.isActive,
              defaultJourneyId: bot.defaultJourneyId,
            },
            "timerHandler:trace:botLoaded"
          );

          // Load nodeOutputs from DB if cache was empty (cache miss recovery)
          const persistedNodeOutputs = cachedState?.nodeOutputs ?? await loadNodeOutputs(sessionId);

          // Create configured engine (timer handlers don't need tag/variable callbacks)
          // Pass cached state fields to preserve stateful handler state (Agent, Questionnaire)
          const result = await createConfiguredEngine({
            session,
            bot,
            channelId,
            clientData,
            logger: handlerLog,
            adapterType: "timer",
            includeTagCallbacks: false,
            includeVariableCallbacks: false,
            services,
            // Restore cached session state if available, or from DB for cache miss
            nodeOutputs: persistedNodeOutputs,
            pendingTimers: cachedState?.pendingTimers,
            pendingPluginFollowUps: cachedState?.pendingPluginFollowUps,
            history: cachedState?.history,
            activeButtons: cachedState?.activeButtons,
          });
          engine = result.engine;
        }
        // Trace: Log engine created
        const engineSession = engine.getSession();
        handlerLog.trace(
          {
            engineCreated: true,
            organizationId,
            engineCurrentNodeId: engineSession.currentNodeId,
            engineStatus: engineSession.status,
          },
          "timerHandler:trace:engineCreated"
        );

        // 5. Inject timeout event to let event router handle it
        // This works for BOTH regular wait timers AND follow-up timers
        // (follow-up timers use pseudo-edges like "followup:node-123:0" which forceEdgeTransition can't handle)
        handlerLog.info({ edgeId, timerId: data.timerId }, "timerHandler:injectingTimeoutEvent");

        // Trace: Log before event injection
        handlerLog.trace(
          {
            edgeId,
            timerId: data.timerId,
            nodeBeforeEvent: engineSession.currentNodeId,
          },
          "timerHandler:trace:beforeEventInjection"
        );

        // Warn if timerId is missing - indicates legacy timer or recovery without bullmqJobId
        if (!data.timerId) {
          handlerLog.warn({ sessionId, edgeId }, "timerHandler:missingTimerId");
        }

        // Create and inject the timeout event
        const timeoutEvent = {
          type: "timeout" as const,
          userId: session.clientId,
          sessionId: session.id,
          payload: { timerId: data.timerId, edgeId: data.edgeId },
          timestamp: new Date().toISOString(),
        };
        await engine.injectEvent(timeoutEvent);

        // 6. Update session state in database
        // Note: tags are handled by the tag service callbacks, not stored in session
        const currentSession = engine.getSession();

        // Trace: Log after event processing
        handlerLog.trace(
          {
            edgeId,
            timerId: data.timerId,
            nodeBeforeEvent: engineSession.currentNodeId,
            nodeAfterEvent: currentSession.currentNodeId,
            statusAfterEvent: currentSession.status,
            pendingTimers: currentSession.pendingTimers?.length || 0,
            contextKeys: Object.keys(currentSession.context || {}),
          },
          "timerHandler:trace:afterEventInjection"
        );

        await finalizeSession({
          sessionId: session.id,
          session: currentSession,
          logger: handlerLog,
        });

        if (currentSession.status === "completed" || currentSession.status === "dropped") {
          await emitSessionCompleted(
            {
              organizationId,
              clientId: session.clientId,
              sessionId: session.id,
              journeyId: session.journeyId,
              channelId: channelId ?? undefined,
              source: "timer",
              finalNodeId: currentSession.currentNodeId,
            },
            currentSession.status
          );
        }

        // Trace: Log session updated
        handlerLog.trace(
          {
            sessionUpdated: true,
            newNodeId: currentSession.currentNodeId,
            newStatus: currentSession.status,
          },
          "timerHandler:trace:sessionUpdated"
        );

        handlerLog.info(
          {
            newNodeId: currentSession.currentNodeId,
            status: currentSession.status,
          },
          "timerHandler:completed"
        );
      } catch (error) {
        handlerLog.error({ err: serializeError(error) }, "timerHandler:error");
        throw error; // Re-throw to trigger BullMQ retry
      }
    },
    { waitTimeoutMs: 15_000 } // 15s timeout to match webhook
  );
}
