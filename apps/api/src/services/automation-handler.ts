/**
 * Automation Handler Service
 *
 * Processes automation events from the event bus.
 * Finds matching triggers and starts journey sessions.
 *
 * Supports both:
 * - Channel-based automations (with message delivery via Telegram)
 * - Channel-less automations (for journeys that only set tags/variables)
 *
 * Pattern based on timer-handler.ts
 *
 * @module services/automation-handler
 */

import { createLogger, serializeError } from "@journey/logger";
import type { BaseEvent, BotRecord, ChannelSessionRecord, ClientRecord } from "@journey/schemas";

import { NoOpAdapter } from "../adapters/noop-adapter";
import { findMatchingTriggers } from "./automation-matcher";
import { createConfiguredEngine } from "./session-engine-factory";
import { emitSessionCompleted, emitSessionStarted, finalizeSession } from "./session-runtime";
import { createServicesForOrganization, createServicesForSystem } from "./create-services";
import type { ServiceContainer } from "./service-container";
import { isRecord } from "../lib/type-guards";

const log = createLogger("automation-handler");

// =============================================================================
// MAIN HANDLER
// =============================================================================

/**
 * Handle an automation event from the event bus
 *
 * 1. Find matching triggers for the event
 * 2. For each trigger, start a new journey session
 *
 * @param event - The automation event to process
 */
export async function handleAutomationEvent(event: BaseEvent): Promise<void> {
  const handlerLog = log.child({
    eventType: event.type,
    organizationId: event.organizationId,
  });

  handlerLog.info({}, "automationHandler:processing");

  try {
    // Find matching triggers
    const triggers = await findMatchingTriggers(event);

    if (triggers.length === 0) {
      handlerLog.debug({}, "automationHandler:noMatchingTriggers");
      return;
    }

    handlerLog.info({ triggerCount: triggers.length }, "automationHandler:foundTriggers");

    // Process each matching trigger
    for (const trigger of triggers) {
      try {
        await startAutomationSession(trigger.journeyId, event, handlerLog);
      } catch (error) {
        // Log error but continue processing other triggers
        handlerLog.error({ triggerId: trigger.id, journeyId: trigger.journeyId, err: serializeError(error) }, "automationHandler:triggerFailed");
      }
    }

    handlerLog.info({ triggerCount: triggers.length }, "automationHandler:completed");
  } catch (error) {
    handlerLog.error({ err: serializeError(error) }, "automationHandler:error");
    throw error; // Re-throw to trigger BullMQ retry
  }
}

// =============================================================================
// SESSION CREATION
// =============================================================================

/**
 * Start a new journey session for an automation trigger
 *
 * @param journeyId - The journey to start
 * @param event - The triggering event (provides context)
 * @param parentLog - Parent logger for context
 */
async function startAutomationSession(journeyId: string, event: BaseEvent, parentLog: ReturnType<typeof createLogger>): Promise<void> {
  const sessionLog = parentLog.child({ journeyId });

  // Extract clientId from event (required for automations)
  const clientId = event.clientId;
  if (!clientId) {
    sessionLog.warn({}, "automationHandler:noClientId:skipping");
    return;
  }

  // Load journey config to find start node
  const systemServices = createServicesForSystem();
  const journeyConfig = await systemServices.channel.getJourneyConfig(journeyId);
  if (!journeyConfig) {
    sessionLog.error({}, "automationHandler:journeyNotFound");
    return;
  }

  // Find start node
  const startNode = journeyConfig.nodes.find((n) => n.data.type === "start");
  if (!startNode) {
    sessionLog.error({}, "automationHandler:noStartNode");
    return;
  }

  // Get organization ID for event publishing
  const organizationId = await systemServices.channel.getJourneyOrganizationId(journeyId);
  if (!organizationId) {
    sessionLog.error({}, "automationHandler:organizationNotFound");
    return;
  }

  const services = createServicesForOrganization({ organizationId });

  // Get client data for template bindings
  const clientData = await services.channel.getClientById(clientId);

  // Try to find a channel for message delivery
  const channelId = getChannelIdFromEvent(event);
  const bot = channelId ? await services.channel.getChannelBot(channelId) : null;

  // Decide which path to take based on channel availability
  if (channelId && bot && bot.isActive) {
    // Channel-based automation - use full Telegram adapter
    await startChannelBasedSession(
      journeyId,
      clientId,
      channelId,
      bot,
      startNode.id,
      organizationId,
      clientData,
      event,
      sessionLog,
      services
    );
  } else {
    // Channel-less automation - use NoOp adapter
    if (channelId && (!bot || !bot.isActive)) {
      sessionLog.warn({ channelId }, "automationHandler:botNotFoundOrInactive:usingNoOpAdapter");
    }
    await startChannelLessSession(
      journeyId,
      clientId,
      startNode.id,
      organizationId,
      clientData,
      event,
      sessionLog,
      services
    );
  }
}

/**
 * Start a session with channel-based message delivery (Telegram)
 */
async function startChannelBasedSession(
  journeyId: string,
  clientId: string,
  channelId: string,
  bot: BotRecord,
  startNodeId: string,
  organizationId: string,
  clientData: ClientRecord | null,
  event: BaseEvent,
  sessionLog: ReturnType<typeof createLogger>,
  services: ServiceContainer
): Promise<void> {
  // Create new session
  const session = await services.channel.createSession(clientId, channelId, journeyId, startNodeId, organizationId);
  sessionLog.info({ sessionId: session.id, mode: "channel" }, "automationHandler:sessionCreated");

  await startAutomationEngine({
    session,
    journeyId,
    organizationId,
    clientId,
    channelId,
    startNodeId,
    bot,
    clientData: clientData ?? undefined,
    adapterType: "telegram",
    eventSource: "journey",
    triggeredBy: "journey",
    customContext: {
      _automation: {
        triggeredBy: event.type,
        triggeredAt: new Date().toISOString(),
      },
    },
    sessionLog,
    services,
  });
}

/**
 * Start a session without channel (NoOp adapter for tag/variable-only journeys)
 */
async function startChannelLessSession(
  journeyId: string,
  clientId: string,
  startNodeId: string,
  organizationId: string,
  clientData: ClientRecord | null,
  event: BaseEvent,
  sessionLog: ReturnType<typeof createLogger>,
  services: ServiceContainer
): Promise<void> {
  // Use a placeholder channelId for channel-less sessions
  const placeholderChannelId = "automation-triggered";

  // Create new session with placeholder channelId
  const session = await services.channel.createSession(clientId, placeholderChannelId, journeyId, startNodeId, organizationId);
  sessionLog.info({ sessionId: session.id, mode: "channelLess" }, "automationHandler:sessionCreated");

  // Create NoOp adapter (doesn't send messages but handles timers)
  const adapter = new NoOpAdapter(session.id);

  await startAutomationEngine({
    session,
    journeyId,
    organizationId,
    clientId,
    channelId: undefined,
    startNodeId,
    adapter,
    adapterType: "automation",
    eventSource: "automation",
    triggeredBy: "automation",
    clientData: clientData ?? undefined,
    customContext: {
      _automation: {
        triggeredBy: event.type,
        triggeredAt: new Date().toISOString(),
      },
    },
    sessionLog,
    services,
  });

  // Cleanup adapter when done
  adapter.cleanup();
}

async function startAutomationEngine(options: {
  session: ChannelSessionRecord;
  journeyId: string;
  organizationId: string;
  clientId: string;
  channelId?: string;
  startNodeId: string;
  bot?: BotRecord;
  adapter?: NoOpAdapter;
  adapterType: "telegram" | "automation";
  eventSource: "journey" | "automation";
  triggeredBy: "journey" | "automation";
  clientData?: ClientRecord;
  customContext: Record<string, unknown>;
  sessionLog: ReturnType<typeof createLogger>;
  services: ServiceContainer;
}): Promise<void> {
  const {
    session,
    journeyId,
    organizationId,
    clientId,
    channelId,
    startNodeId,
    bot,
    adapter,
    adapterType,
    eventSource,
    triggeredBy,
    clientData,
    customContext,
    sessionLog,
    services,
  } = options;

  const { engine } = await createConfiguredEngine({
    session,
    bot,
    channelId,
    adapter,
    logger: sessionLog,
    clientData,
    adapterType,
    eventSource,
    triggeredBy,
    eventMetadata: { automation: true },
    customContext,
    services,
  });

  await engine.start();

  const startedSession = engine.getSession();
  await finalizeSession({
    sessionId: session.id,
    session: startedSession,
    logger: sessionLog,
    cacheMode: "set",
  });

  sessionLog.info(
    { sessionId: session.id, currentNodeId: startedSession.currentNodeId, status: startedSession.status },
    "automationHandler:sessionStarted"
  );

  await emitSessionStarted({
    organizationId,
    clientId,
    sessionId: session.id,
    journeyId,
    channelId,
    source: "automation",
    startNodeId,
  });

  if (startedSession.status === "completed" || startedSession.status === "dropped") {
    await emitSessionCompleted(
      {
        organizationId,
        clientId,
        sessionId: session.id,
        journeyId,
        channelId,
        source: "automation",
        finalNodeId: startedSession.currentNodeId,
      },
      startedSession.status
    );
  }

  services.crm.assignClientToDefaultPipeline(clientId).catch((error) => {
    sessionLog.debug({ err: serializeError(error) }, "automationHandler:crmAutoAssign:failed");
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract channelId from an automation event payload
 */
function getChannelIdFromEvent(event: BaseEvent): string | undefined {
  const payload = isRecord(event.payload) ? event.payload : null;
  const channelId = payload?.channelId;
  return typeof channelId === "string" ? channelId : undefined;
}
