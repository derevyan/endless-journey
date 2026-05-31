/**
 * Teleport Service
 *
 * Handles teleporting users between journeys.
 * Called by webhook handlers when a session completes with __teleport marker.
 *
 * @module modules/channels/services/teleport-service
 */

import { createLogger, serializeError } from "@journey/logger";
import type { BotRecord, ChannelSessionRecord, ClientRecord } from "@journey/schemas";

import { createConfiguredEngine } from "../../../services/session-engine-factory";
import type { ServiceContainer } from "../../../services";
import { isRecord } from "../../../lib/type-guards";

const log = createLogger("teleport-service");

// =============================================================================
// TYPES
// =============================================================================

export interface TeleportData {
  targetJourneyId: string;
  targetNodeId?: string;
  preserveContext: boolean;
}

export interface TeleportParams {
  /** Client ID being teleported */
  clientId: string;
  /** Channel ID (bot) */
  channelId: string;
  /** Teleport configuration from __teleport marker */
  teleportData: TeleportData;
  /** Previous session context to potentially preserve */
  previousContext: Record<string, unknown>;
  /** Bot record for creating adapter */
  bot: BotRecord;
  /** Client data for template bindings */
  clientData?: ClientRecord;
  /** Service container for channel operations */
  services: ServiceContainer;
  /** Logger instance */
  logger?: ReturnType<typeof createLogger>;
}

export type TeleportResult =
  | {
      /** Whether teleport was successful */
      success: true;
      /** New session created in target journey */
      session: ChannelSessionRecord;
    }
  | {
      /** Whether teleport was successful */
      success: false;
      /** New session created in target journey */
      session: null;
      /** Error message if failed */
      error: string;
    };

// =============================================================================
// CONTEXT SANITIZATION
// =============================================================================

/**
 * Sanitize context for teleport to prevent cross-journey data corruption
 *
 * MUST CLEAR (Journey-Specific):
 * - userResponse: Only relevant to previous node
 * - __teleport: Internal marker, must be removed
 * - storeResponseAs: Node-specific variable storage
 *
 * SAFE TO PRESERVE:
 * - User tags: Global to user (stored in client_tags table)
 * - User-scoped variables: Stored in unified variables table (user scope)
 * - Custom context keys: User-defined data like customerId, orderTotal
 *
 * Note: nodeOutputs, pendingTimers, history are on session object, not context
 *
 * @public Exported for unit testing
 */
export function sanitizeContextForTeleport(context: Record<string, unknown>): Record<string, unknown> {
  const {
    userResponse, // Clear - node-specific input
    __teleport, // Clear - internal marker
    storeResponseAs, // Clear - node-specific variable name
    ...preservedContext
  } = context;

  log.debug(
    {
      removedKeys: ["userResponse", "__teleport", "storeResponseAs"].filter(
        (k) => context[k] !== undefined
      ),
      preservedKeyCount: Object.keys(preservedContext).length,
    },
    "teleport:contextSanitized"
  );

  return preservedContext;
}

// =============================================================================
// TELEPORT HANDLER
// =============================================================================

/**
 * Handle teleporting a user to another journey
 *
 * This function:
 * 1. Loads target journey config
 * 2. Determines start node (specified or default start node)
 * 3. Sanitizes context if preserveContext is true
 * 4. Creates new session in target journey
 * 5. Creates and starts engine for new session
 * 6. Updates session with engine state after start
 *
 * @param params - Teleport parameters
 * @returns Result with new session or error
 */
export async function handleTeleport(params: TeleportParams): Promise<TeleportResult> {
  const {
    clientId,
    channelId,
    teleportData,
    previousContext,
    bot,
    clientData,
    services,
    logger = log,
  } = params;
  const channelService = services.channel;

  const teleportLog = logger.child({
    clientId,
    channelId,
    targetJourneyId: teleportData.targetJourneyId,
    targetNodeId: teleportData.targetNodeId,
  });

  try {
    teleportLog.info({}, "teleport:start");

    // 1. Load target journey config
    const journeyConfig = await channelService.getJourneyConfig(teleportData.targetJourneyId);
    if (!journeyConfig) {
      teleportLog.error({}, "teleport:targetJourneyNotFound");
      return {
        success: false,
        session: null,
        error: `Target journey not found: ${teleportData.targetJourneyId}`,
      };
    }

    // 2. Determine start node
    let startNodeId = teleportData.targetNodeId;

    if (!startNodeId) {
      // Find default start node
      const startNode = journeyConfig.nodes.find((n) => n.data.type === "start");
      startNodeId = startNode?.id;
    } else {
      // Validate target node exists
      const targetNode = journeyConfig.nodes.find((n) => n.id === startNodeId);
      if (!targetNode) {
        teleportLog.error({ targetNodeId: startNodeId }, "teleport:targetNodeNotFound");
        return {
          success: false,
          session: null,
          error: `Target node not found: ${startNodeId}`,
        };
      }
    }

    if (!startNodeId) {
      teleportLog.error({}, "teleport:noStartNode");
      return {
        success: false,
        session: null,
        error: "No valid start node in target journey",
      };
    }

    // 3. Build context for new session
    const newContext = teleportData.preserveContext
      ? sanitizeContextForTeleport(previousContext)
      : {};

    teleportLog.debug(
      { preserveContext: teleportData.preserveContext, contextKeyCount: Object.keys(newContext).length },
      "teleport:contextPrepared"
    );

    // 3b. Get organization ID for the target journey
    const organizationId = await channelService.getJourneyOrganizationId(teleportData.targetJourneyId);
    if (!organizationId) {
      teleportLog.error({}, "teleport:organizationNotFound");
      return {
        success: false,
        session: null,
        error: `Organization not found for journey: ${teleportData.targetJourneyId}`,
      };
    }

    // 4. Create new session with initial context
    const newSession = await channelService.createSession(
      clientId,
      channelId,
      teleportData.targetJourneyId,
      startNodeId,
      organizationId,
      newContext
    );

    teleportLog.info({ newSessionId: newSession.id, startNodeId }, "teleport:sessionCreated");

    // 5. Create and start engine for new journey
    const { engine } = await createConfiguredEngine({
      session: newSession,
      bot,
      channelId,
      logger: teleportLog,
      clientData: clientData ?? undefined,
      adapterType: "telegram",
      customContext: newContext,
      services,
    });

    await engine.start();

    // 6. Update new session with engine state after start
    const engineSession = engine.getSession();
    await channelService.updateSession(newSession.id, {
      currentNodeId: engineSession.currentNodeId,
      status: engineSession.status,
      completedAt: engineSession.completedAt ? new Date(engineSession.completedAt) : undefined,
    });

    teleportLog.info(
      {
        newSessionId: newSession.id,
        currentNodeId: engineSession.currentNodeId,
        status: engineSession.status,
      },
      "teleport:success"
    );

    // Return updated session info
    return {
      session: {
        ...newSession,
        currentNodeId: engineSession.currentNodeId,
        status: engineSession.status,
        context: engineSession.context,
      },
      success: true,
    };
  } catch (error) {
    teleportLog.error({ err: serializeError(error) }, "teleport:error");
    return {
      success: false,
      session: null,
      error: error instanceof Error ? error.message : "Unknown teleport error",
    };
  }
}

/**
 * Check if a session context contains a teleport marker
 */
export function hasTeleportMarker(context: Record<string, unknown>): boolean {
  return context.__teleport !== undefined && context.__teleport !== null;
}

/**
 * Extract teleport data from session context
 */
export function extractTeleportData(context: Record<string, unknown>): TeleportData | null {
  if (!hasTeleportMarker(context)) {
    return null;
  }

  const teleport = context.__teleport;
  if (!isRecord(teleport)) {
    return null;
  }

  const targetJourneyId = teleport.targetJourneyId;
  if (typeof targetJourneyId !== "string" || !targetJourneyId) {
    return null;
  }

  const targetNodeId = typeof teleport.targetNodeId === "string" ? teleport.targetNodeId : undefined;
  const preserveContext = teleport.preserveContext === true;

  return {
    targetJourneyId,
    targetNodeId,
    preserveContext,
  };
}
