/**
 * Session Engine Factory
 *
 * Factory for creating configured SessionEngine instances.
 * Consolidates common engine setup logic used across webhook, automation, and timer handlers.
 *
 * @module services/session-engine-factory
 */

import type { MessagingAdapter } from "@journey/engine";
import { SessionEngine, setSleepScale } from "@journey/engine";
import { createEngineIntegrations } from "@journey/engine-integrations";
import { createLogger, serializeError } from "@journey/logger";
import type {
  BotRecord,
  ChannelSessionRecord,
  ClientRecord,
  EnhancedUserJourney,
  EventSource,
  InteractionEvent,
  JourneyConfig,
  TagOperationEventContext,
  TagOperations,
  VariableOperation,
  VariableOperationEventContext,
  VariableScope,
} from "@journey/schemas";
import { NotFoundError, BadRequestError, EventTypes } from "@journey/schemas";
import { TelegramAdapter } from "../adapters/telegram";
import { createMindstateServiceAdapter } from "./mindstate-service-adapter";
import { isRecord } from "../lib/type-guards";
import { createEvent, publishEvent } from "../event-bus/event-bus";
import { publishers } from "../event-bus/publishers";
import { createCrmEngineAdapter } from "../modules/crm";
import type { EventTrigger } from "../event-bus/utils";
import { loadHistoryFromDatabase } from "./session-runtime/state-persistence";
import { createServicesForOrganization, createServicesForSystem } from "./create-services";
import type { ServiceContainer } from "./service-container";

const log = createLogger("session-engine-factory");

// =============================================================================
// TYPES
// =============================================================================

function parseTimerScale(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function normalizeSessionStatus(status: ChannelSessionRecord["status"]): "active" | "completed" | "dropped" | "paused" {
  if (status === "active" || status === "completed" || status === "dropped" || status === "paused") {
    return status;
  }
  return "active";
}

const CHANNEL_PLATFORMS = ["telegram", "whatsapp", "simulator"] as const;
type ChannelPlatform = (typeof CHANNEL_PLATFORMS)[number];

const CHANNEL_MESSAGE_TYPES = [
  "text",
  "photo",
  "video",
  "audio",
  "document",
  "sticker",
  "contact",
  "location",
  "buttons",
] as const;
type ChannelMessageType = (typeof CHANNEL_MESSAGE_TYPES)[number];

function isChannelPlatform(value: unknown): value is ChannelPlatform {
  return typeof value === "string" && CHANNEL_PLATFORMS.some((platform) => platform === value);
}

function isChannelMessageType(value: unknown): value is ChannelMessageType {
  return typeof value === "string" && CHANNEL_MESSAGE_TYPES.some((type) => type === value);
}

export interface CreateSessionEngineOptions {
  session: ChannelSessionRecord;
  bot?: BotRecord; // Optional when using custom adapter
  channelId?: string | null; // Optional/nullable for simulator
  adapter?: MessagingAdapter; // Custom adapter (e.g., SimulatorAdapter)
  logger: ReturnType<typeof createLogger>;
  services?: ServiceContainer;
  clientData?: ClientRecord;
  adapterType?: "telegram" | "timer" | "simulator" | "automation";
  eventSource?: EventSource;
  triggeredBy?: EventTrigger;
  eventMetadata?: Record<string, unknown>;
  includeTagCallbacks?: boolean;
  includeVariableCallbacks?: boolean;
  customContext?: Record<string, unknown>;

  // Cached session state fields (restored from Redis cache during reconstruction)
  // These preserve stateful handler state (Agent, Questionnaire) across messages
  nodeOutputs?: EnhancedUserJourney["nodeOutputs"];
  pendingTimers?: EnhancedUserJourney["pendingTimers"];
  pendingPluginFollowUps?: EnhancedUserJourney["pendingPluginFollowUps"];
  history?: EnhancedUserJourney["history"];
  activeButtons?: EnhancedUserJourney["activeButtons"];
}

export interface CreateSessionEngineResult {
  engine: SessionEngine;
  organizationId: string;
  journeyConfig: JourneyConfig;
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a configured SessionEngine instance
 *
 * Handles:
 * - Journey config loading
 * - Organization ID lookup
 * - Adapter creation
 * - Enhanced session creation
 * - Engine callback setup
 *
 * @param options - Configuration options
 * @returns Engine instance with organization ID and journey config
 */
export async function createConfiguredEngine(options: CreateSessionEngineOptions): Promise<CreateSessionEngineResult> {
  const {
    session,
    bot,
    channelId,
    adapter: customAdapter,
    logger,
    services,
    clientData,
    adapterType = "telegram",
    eventSource = "journey",
    triggeredBy = "journey",
    eventMetadata,
    includeTagCallbacks = true,
    includeVariableCallbacks = true,
    customContext,
    // Cached session state (restored from Redis during reconstruction)
    nodeOutputs,
    pendingTimers,
    pendingPluginFollowUps,
    history,
    activeButtons,
  } = options;

  const systemServices = services ?? createServicesForSystem();

  // Load journey config
  const journeyConfig = await systemServices.channel.getJourneyConfig(session.journeyId);
  if (!journeyConfig) {
    logger.error({ journeyId: session.journeyId }, "sessionEngineFactory:journeyNotFound");
    throw new NotFoundError("Journey", session.journeyId);
  }

  // Get organization ID
  const organizationId = await systemServices.channel.getJourneyOrganizationId(session.journeyId);
  if (!organizationId) {
    logger.error({ journeyId: session.journeyId }, "sessionEngineFactory:organizationNotFound");
    throw new NotFoundError("Organization", session.journeyId);
  }

  const serviceContainer = services ?? createServicesForOrganization({ organizationId });

  // Get journey's default pipeline ID
  const defaultPipelineId = await serviceContainer.channel.getJourneyDefaultPipelineId(session.journeyId);

  // Get journey's mindstate configuration (for AI-powered state tracking)
  const mindstateConfig = await serviceContainer.channel.getJourneyMindstateConfig(session.journeyId);

  // Create mindstate service adapter if mindstate is configured
  const mindstateService = mindstateConfig?.keys?.length
    ? createMindstateServiceAdapter(serviceContainer.mindstate, organizationId)
    : undefined;

  if (!mindstateService) {
    logger.debug({ journeyId: session.journeyId }, "sessionEngineFactory:mindstateNotConfigured");
  }

  // Create CRM service adapter with session context for event publishing
  const crmService = createCrmEngineAdapter(serviceContainer.crm, publishers, {
    sessionId: session.id,
    journeyId: session.journeyId,
    organizationId,
    clientId: session.clientId,
  });

  // Create adapter (use custom adapter if provided, otherwise create TelegramAdapter)
  let adapter: MessagingAdapter;
  if (customAdapter) {
    adapter = customAdapter;
  } else if (bot && channelId) {
    adapter = new TelegramAdapter(bot.botToken, channelId, session.id, session.clientId, organizationId, session.journeyId, logger);
  } else {
    throw new BadRequestError("Either adapter or (bot + channelId) must be provided");
  }

  // Get client tags
  const clientTags = await serviceContainer.tag.getClientTagNames(session.clientId);

  // Create enhanced session for engine
  // Use cached state fields if provided (preserves stateful handler state across messages)
  const baseContext = isRecord(session.context) ? session.context : {};

  // Load conversation history: use cache if available, otherwise rebuild from database
  const conversationHistory = history ?? (await loadHistoryFromDatabase(session.id));

  const enhancedSession: EnhancedUserJourney = {
    sessionId: session.id,
    userId: session.clientId,
    // Platform-specific user ID for messaging (Telegram numeric ID, WhatsApp phone, etc.)
    platformUserId: clientData?.platformUserId || "",
    journeyId: session.journeyId,
    currentNodeId: session.currentNodeId,
    status: normalizeSessionStatus(session.status),
    context: customContext ? { ...baseContext, ...customContext } : baseContext,
    tags: clientTags,
    // Restore cached state fields or use defaults for new sessions
    pendingTimers: pendingTimers ?? [],
    pendingPluginFollowUps: pendingPluginFollowUps ?? [],
    nodeOutputs: nodeOutputs ?? {},
    activeButtons: activeButtons,
    startedAt: session.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: session.updatedAt?.toISOString() || new Date().toISOString(),
    completedAt: null,
    hasStarted: false,
    history: conversationHistory,
  };

  const engineIntegrations = createEngineIntegrations({
    clientId: session.clientId,
    organizationId,
  });

  // Create workflow event emitter for real-time SSE updates
  const workflowEventEmitter = serviceContainer.workflow.createWorkflowEmitter({
    organizationId,
    sessionId: session.id,
    journeyId: session.journeyId,
    clientId: session.clientId,
    performedBy: "system",
    triggeredBy: "journey",
  });
  const timerScale = parseTimerScale(process.env.TELEGRAM_PARITY_TIME_SCALE);
  setSleepScale(timerScale ?? 1);

  // Create engine with callbacks
  const engine = new SessionEngine(enhancedSession, journeyConfig, adapter, {
    clientData: clientData
      ? {
          id: clientData.id,
          platform: clientData.platform,
          firstName: clientData.firstName ?? undefined,
          lastName: clientData.lastName ?? undefined,
          username: clientData.username ?? undefined,
        }
      : undefined,
    onEvent: async (interactionEvent: InteractionEvent) => {
      logger.debug({ eventType: interactionEvent.type, nodeId: interactionEvent.nodeId }, "sessionEngineFactory:engineEvent");
      const interactionPayload = isRecord(interactionEvent.payload) ? interactionEvent.payload : {};
      const event = await createEvent(
        interactionEvent.type,
        organizationId,
        {
          ...interactionPayload,
          nodeId: interactionEvent.nodeId || "unknown",
          adapter: adapterType,
          ...eventMetadata,
        },
        {
          id: interactionEvent.id,
          clientId: session.clientId,
          sessionId: session.id,
          journeyId: session.journeyId,
          performedBy: "system",
          source: eventSource,
        }
      );

      // ✅ FIX: Save to interactions table SYNCHRONOUSLY FIRST
      // This ensures the FK reference exists before callbacks execute
      // Prevents race condition where sent_messages tries to reference non-existent interaction_event_id
      try {
        const payload: Record<string, unknown> = isRecord(event.payload) ? event.payload : {};
        const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "unknown";
        await serviceContainer.channel.saveInteraction({
          id: event.id ?? undefined,
          sessionId: event.sessionId || session.id,
          type: event.type,
          nodeId,
          payload,
          metadata: {
            source: event.source,
            performedBy: event.performedBy,
            timestamp: event.timestamp,
            eventId: event.id,
          },
        });
        logger.debug({ interactionId: event.id }, "sessionEngineFactory:interactionSaved");
      } catch (error) {
        logger.error({ err: serializeError(error), eventId: event.id }, "sessionEngineFactory:saveInteraction:error");
        // Don't throw - let event bus consumer handle it as backup
      }

      // Then publish to event bus (log consumer will handle duplicate)
      await publishEvent(event);
    },
    // Tag operation callbacks (optional)
    ...(includeTagCallbacks && {
      onTagOperation: async (clientId: string, operations: TagOperations) => {
        if (operations.add?.length || operations.remove?.length) {
          const eventContext: TagOperationEventContext = {
            sessionId: session.id,
            journeyId: session.journeyId,
            triggeredBy,
          };
          await serviceContainer.tag.executeOperations(clientId, operations, eventContext);
        }
      },
      onGetTags: async (clientId: string) => {
        return await serviceContainer.tag.getClientTagNames(clientId);
      },
    }),
    // User variable callbacks (optional)
    // Uses unified variable service for consistent behavior with global/journey variables
    ...(includeVariableCallbacks && {
      onUserVariableOperation: async (userId: string, operations: VariableOperation[]) => {
        if (operations && operations.length > 0) {
          const eventContext: VariableOperationEventContext = {
            organizationId,
            sessionId: session.id,
            journeyId: session.journeyId,
            clientId: session.clientId,
            triggeredBy,
          };
          await serviceContainer.variable.executeOperations("user", userId, operations, eventContext);
        }
      },
      onGetUserVariables: async (userId: string) => {
        return await serviceContainer.variable.getVariablesAsMap("user", userId);
      },
    }),
    // Journey/Global variable callbacks (optional)
    ...(includeVariableCallbacks && {
      onVariableOperation: async (scope: VariableScope, scopeId: string, operations?: VariableOperation[]) => {
        const actualScopeId = scope === "global" ? organizationId : scopeId;
        if (operations && operations.length > 0) {
          const eventContext: VariableOperationEventContext = {
            organizationId,
            sessionId: session.id,
            journeyId: session.journeyId,
            clientId: session.clientId,
            triggeredBy,
          };
          await serviceContainer.variable.executeOperations(scope, actualScopeId, operations, eventContext);
        }
      },
      onGetVariables: async (scope: VariableScope, scopeId: string) => {
        const actualScopeId = scope === "global" ? organizationId : scopeId;
        return await serviceContainer.variable.getVariablesAsMap(scope, actualScopeId);
      },
    }),
    organizationId,
    agentWorkflowService: engineIntegrations.agentWorkflowService,
    memoryService: engineIntegrations.memoryService,
    followUpAIService: engineIntegrations.followUpAIService,
    workflowEventEmitter,
    timerScale,
    logger,
    // CRM service for pipeline management
    crmService,
    defaultPipelineId: defaultPipelineId ?? undefined,
    // Mindstate configuration and service for AI-powered state tracking
    mindstateConfig: mindstateConfig ?? undefined,
    mindstateService,
    // Sent messages callback for storing platform message IDs
    onMessageSent: async (params) => {
      // ✅ FIX: Ensure interaction exists BEFORE saving sent_messages with FK reference
      // The onEvent callback saves async, but we need to guarantee the interaction exists
      // saveInteraction uses onConflictDoNothing so duplicates are safe
      await serviceContainer.channel.saveInteraction({
        id: params.interactionEventId,
        sessionId: params.sessionId,
        type: EventTypes.ENGINE_MESSAGE,
        nodeId: params.nodeId,
        payload: { content: params.content, platform: params.platform },
        metadata: { source: "messenger", timestamp: new Date().toISOString() },
      });

      const platform = isChannelPlatform(params.platform) ? params.platform : null;
      if (!platform) {
        logger.warn({ platform: params.platform }, "sessionEngineFactory:onMessageSent:unknownPlatform");
        return;
      }

      await serviceContainer.channel.saveSentMessages({
        sessionId: params.sessionId,
        nodeId: params.nodeId,
        interactionEventId: params.interactionEventId,
        platform,
        platformChatId: params.chatId,
        content: params.content,
        messages: params.messages.map((m) => {
          const messageType = isChannelMessageType(m.messageType) ? m.messageType : "text";
          if (messageType !== m.messageType) {
            logger.warn({ messageType: m.messageType }, "sessionEngineFactory:onMessageSent:unknownMessageType");
          }
          return {
            platformMessageId: m.platformMessageId,
            messageType,
          };
        }),
      });
    },
  });

  logger.debug(
    {
      sessionId: session.id,
      journeyId: session.journeyId,
      defaultPipelineId,
      hasMindstate: !!mindstateService,
      mindstateKeys: mindstateConfig?.keys?.length ?? 0,
    },
    "sessionEngineFactory:engineCreated"
  );

  return {
    engine,
    organizationId,
    journeyConfig,
  };
}
