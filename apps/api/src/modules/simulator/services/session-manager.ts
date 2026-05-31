/**
 * Simulator Session Manager
 *
 * Manages active simulator engine instances.
 * Similar pattern to modules/channels/webhooks/telegram.ts engine cache, but for simulator sessions.
 *
 * Key responsibilities:
 * - Create and cache SessionEngine instances for active simulations
 * - Handle session lifecycle (create, get, cleanup)
 * - Manage test client creation
 *
 * @module modules/simulator/services/session-manager
 */

import { clients, journeySessions, journeys } from "@journey/db";
import { eq, and } from "drizzle-orm";
import { createLogger, serializeError } from "@journey/logger";
import {
  SessionEngine,
  createPluginDebugStateRegistry,
  followUpDebugStateProvider,
} from "@journey/engine";
import {
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
  SIMULATOR_CONFIG,
  generateSimulatorClientId,
  JourneyConfigSchema,
  type CreateSimulatorSession,
  type Persona,
  type PersonaProfile,
  type SimulatorSessionInfo,
  type VariableOperation,
  type ChannelSessionRecord,
  VariableValueSchema,
} from "@journey/schemas";
import { SimulatorAdapter } from "../../../adapters/simulator";
import type { ServiceContainer } from "../../../services/service-container";
import { createConfiguredEngine } from "../../../services/session-engine-factory";
import { persistSessionState } from "../../../services/session-runtime";
import { getCachedSession } from "../../../services/session-cache-service";
import type { SimulatorServiceContext } from "./service-context";
import { normalizePersonaProfile } from "./profile-helpers";
import { getPersona, setPersonaClientId } from "./persona-service";
import { resetClientData } from "./cleanup-service";

const log = createLogger("simulator-session-manager");

// =============================================================================
// TYPES
// =============================================================================

interface ActiveSimulatorSession {
  sessionId: string;
  engine: SessionEngine;
  adapter: SimulatorAdapter;
  organizationId: string;
  clientId: string;
  lastActivity: Date;
  timeoutId: NodeJS.Timeout;
}

// =============================================================================
// SESSION CACHE
// =============================================================================

// In-memory cache of active simulator engines
const activeSessions = new Map<string, ActiveSimulatorSession>();

// Session timeout from constants
const SESSION_TIMEOUT_MS = SIMULATOR_CONFIG.SESSION_TIMEOUT_MS;

// Plugin debug state registry - extracts debug state from all registered plugins
const pluginDebugRegistry = createPluginDebugStateRegistry([followUpDebugStateProvider]);

// =============================================================================
// CLIENT CREATION HELPER
// =============================================================================

/**
 * Create a simulator test client with the given profile.
 * Extracted to avoid duplication between persona and anonymous modes.
 */
async function createSimulatorClient(
  ctx: SimulatorServiceContext,
  options: { clientId: string; profile: PersonaProfile }
): Promise<void> {
  await ctx.db.insert(clients).values({
    id: options.clientId,
    organizationId: ctx.organizationId,
    platform: SIMULATOR_CONFIG.PLATFORM,
    platformUserId: options.clientId,
    firstName: options.profile.firstName ?? "Simulator",
    lastName: options.profile.lastName ?? "User",
    username: options.profile.username ?? `sim_${Date.now()}`,
    isTest: true,
  });
}

// =============================================================================
// STATE SYNC HELPER
// =============================================================================

/**
 * Sync engine session state to database and update adapter debug state.
 *
 * This is the single source of truth for state synchronization between
 * the engine, adapter debug state, and persistent storage.
 *
 * @param sessionId - The session ID to sync
 * @param engine - The SessionEngine instance
 * @param adapter - The SimulatorAdapter instance
 * @param tags - Tags array (pass directly if already loaded, or null to load from DB)
 */
async function syncSessionStateToDb(
  systemServices: ServiceContainer,
  sessionId: string,
  engine: SessionEngine,
  adapter: SimulatorAdapter,
  tags: string[] | null
): Promise<void> {
  const currentSession = engine.getSession();

  // Load fresh tags from DB if not provided
  let resolvedTags = tags;
  if (resolvedTags === null) {
    const session = await getSessionRecord(systemServices, sessionId);
    resolvedTags = session?.tags ?? [];
  }

  // Extract all plugin debug states using the registry
  const pluginStates = pluginDebugRegistry.extractAll(currentSession);

  // Update adapter debug state for SSE event enrichment
  adapter.updateDebugState({
    currentNodeId: currentSession.currentNodeId,
    variables: currentSession.context ?? {},
    tags: resolvedTags,
    // Generic plugin states from registry
    pluginStates,
  });

  // Publish debug state update to notify frontend of state changes
  // (engine events via sseConsumer don't include _debug state)
  await adapter.publishDebugStateUpdate();

  await persistSessionState({
    sessionId,
    session: currentSession,
    logger: log,
  });
}

async function getSessionRecord(
  systemServices: ServiceContainer,
  sessionId: string
): Promise<ChannelSessionRecord | null> {
  return systemServices.channel.getSessionById(sessionId);
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Create a new simulator session
 *
 * Creates:
 * 1. A test client (platform='simulator', is_test=true)
 * 2. A journey session (mode='simulation', channelId=null)
 * 3. A SessionEngine with SimulatorAdapter
 */
export async function createSimulatorSession(
  ctx: SimulatorServiceContext,
  services: ServiceContainer,
  systemServices: ServiceContainer,
  options: CreateSimulatorSession
): Promise<SimulatorSessionInfo> {
  const { journeyId, startNodeId, personaId, clientProfile } = options;
  const organizationId = ctx.organizationId;
  const normalizedProfile = normalizePersonaProfile(clientProfile);

  log.info({ journeyId, organizationId, personaId }, "simulatorSessionManager:createSession:start");

  try {
    // 1. Get journey config and verify organization ownership
    const journey = await ctx.db.query.journeys.findFirst({
      where: and(eq(journeys.id, journeyId), eq(journeys.organizationId, organizationId)),
      columns: { configuration: true, status: true },
    });

    if (!journey) {
      throw new NotFoundError("Journey", journeyId);
    }

    if (journey.status !== "active") {
      throw new BadRequestError(`Journey is not active (status: ${journey.status})`, { journeyId });
    }

    const configResult = JourneyConfigSchema.safeParse(journey.configuration);
    if (!configResult.success) {
      throw new BadRequestError("Invalid journey configuration", { journeyId }, configResult.error);
    }
    const config = configResult.data;
    const actualStartNodeId = startNodeId ?? config.nodes.find((n) => n.data.type === "start")?.id;

    if (!actualStartNodeId) {
      throw new BadRequestError("No start node found in journey", { journeyId });
    }

    // 2. Get or create client (persona mode vs anonymous mode)
    let clientId: string;
    let persona: Persona | null = null;

    if (personaId) {
      // Persona mode: reuse existing client or create new one
      persona = await getPersona(ctx, personaId);
      if (!persona) {
        throw new NotFoundError("Persona", personaId);
      }

      if (persona.clientId) {
        // Reuse existing client and sync profile from persona
        clientId = persona.clientId;

        // Update client profile to match current persona settings
        // CRITICAL: Clear metadata (playback flags, etc.) when reusing client
        await ctx.db
          .update(clients)
          .set({
            firstName: persona.profile.firstName || undefined,
            lastName: persona.profile.lastName || undefined,
            username: persona.profile.username || undefined,
            metadata: null, // Clear any stale playback mode flags
            updatedAt: new Date(),
          })
          .where(eq(clients.id, clientId));

        log.debug({ clientId, personaId }, "simulatorSessionManager:reusingPersonaClient:profileSynced");
      } else {
        // Create new client for persona
        clientId = generateSimulatorClientId();
        await createSimulatorClient(ctx, {
          clientId,
          profile: persona.profile,
        });

        if (persona.userVars && Object.keys(persona.userVars).length > 0) {
          const variableOps: VariableOperation[] = Object.entries(persona.userVars).map(([key, value]) => ({
            op: "set",
            key,
            value: VariableValueSchema.parse(value),
          }));

          await services.variable.executeOperations("user", clientId, variableOps);
        }

        // Link client to persona
        await setPersonaClientId(ctx, personaId, clientId);
        log.debug({ clientId, personaId }, "simulatorSessionManager:createdPersonaClient");
      }
    } else {
      // Anonymous mode: reuse single shared client per organization
      // Use transaction with FOR UPDATE to prevent race conditions when two requests
      // try to reuse/create the anonymous client simultaneously
      const clientResult = await ctx.db.transaction(async (tx) => {
        // SELECT FOR UPDATE locks the row to prevent concurrent access
        const existingClient = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.organizationId, organizationId),
              eq(clients.platform, SIMULATOR_CONFIG.PLATFORM),
              eq(clients.platformUserId, SIMULATOR_CONFIG.ANONYMOUS_PLATFORM_USER_ID)
            )
          )
          .limit(1)
          .for("update");

        if (existingClient.length > 0) {
          // Reuse existing anonymous client
          const existingClientId = existingClient[0].id;

          // Update profile if provided
          if (normalizedProfile.firstName || normalizedProfile.lastName || normalizedProfile.username) {
            await tx
              .update(clients)
              .set({
                firstName: normalizedProfile.firstName ?? "Simulator",
                lastName: normalizedProfile.lastName ?? "User",
                username: normalizedProfile.username,
                updatedAt: new Date(),
              })
              .where(eq(clients.id, existingClientId));
          }

          return { clientId: existingClientId, isNew: false };
        } else {
          // Create anonymous client for first time
          const newClientId = generateSimulatorClientId();
          await tx.insert(clients).values({
            id: newClientId,
            organizationId,
            platform: SIMULATOR_CONFIG.PLATFORM,
            platformUserId: SIMULATOR_CONFIG.ANONYMOUS_PLATFORM_USER_ID,
            firstName: normalizedProfile.firstName ?? "Simulator",
            lastName: normalizedProfile.lastName ?? "User",
            username: normalizedProfile.username ?? "anonymous_sim",
            isTest: true,
          });

          return { clientId: newClientId, isNew: true };
        }
      });

      clientId = clientResult.clientId;

      if (!clientResult.isNew) {
        // Cleanup happens outside transaction to avoid holding locks during async operations
        await cleanupSessionsForClient(clientId, "stale");
        await resetClientData(ctx, clientId);
        log.debug({ clientId }, "simulatorSessionManager:anonymousClientReused");
      } else {
        log.debug({ clientId }, "simulatorSessionManager:anonymousClientCreated");
      }
    }

    // 3. Create journey session
    const [session] = await ctx.db
      .insert(journeySessions)
      .values({
        clientId,
        organizationId,
        channelId: null, // Simulator doesn't need a channel
        journeyId,
        currentNodeId: actualStartNodeId,
        status: "active",
        mode: "simulation",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.debug({ sessionId: session.id }, "simulatorSessionManager:sessionCreated");

    // 4. Create adapter and engine
    const adapter = new SimulatorAdapter(session.id, organizationId, clientId, log);

    // Load session record with tags
    const sessionRecord = await getSessionRecord(systemServices, session.id);
    if (!sessionRecord) {
      throw new ServiceUnavailableError("Failed to load created session", { sessionId: session.id });
    }

    const { engine } = await createConfiguredEngine({
      session: sessionRecord,
      adapter,
      logger: log,
      adapterType: "simulator",
      includeTagCallbacks: true,
      includeVariableCallbacks: true,
      services,
    });

    // 5. Cache the active session
    const timeoutId = setTimeout(() => {
      cleanupSession(session.id, "timeout");
    }, SESSION_TIMEOUT_MS);

    activeSessions.set(session.id, {
      sessionId: session.id,
      engine,
      adapter,
      organizationId,
      clientId,
      lastActivity: new Date(),
      timeoutId,
    });

    // 6. Start the engine to process start node and send first message
    // This is critical! Without this, no messages are sent to the frontend.
    // All production code (telegram-webhook, automation-handler, teleport-service) calls engine.start()
    await engine.start();

    // 7. Sync session state to DB and update adapter debug state
    await syncSessionStateToDb(systemServices, session.id, engine, adapter, sessionRecord.tags ?? []);

    const startedSession = engine.getSession();
    log.info(
      { sessionId: session.id, currentNodeId: startedSession.currentNodeId },
      "simulatorSessionManager:engineStarted"
    );

    log.info(
      { sessionId: session.id, clientId, journeyId, startNodeId: actualStartNodeId },
      "simulatorSessionManager:createSession:success"
    );

    return {
      sessionId: session.id,
      clientId,
      journeyId,
      currentNodeId: startedSession.currentNodeId, // Return actual current node after engine.start()
      status: startedSession.status,
    };
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "simulatorSessionManager:createSession:error");
    throw error;
  }
}

/**
 * Get an active simulator session
 *
 * Returns the cached engine if available, or loads from DB and recreates if needed.
 */
export async function getSimulatorSession(
  ctx: SimulatorServiceContext,
  services: ServiceContainer,
  systemServices: ServiceContainer,
  sessionId: string
): Promise<{ engine: SessionEngine; adapter: SimulatorAdapter; session: ChannelSessionRecord } | null> {
  // Check cache first
  const cached = activeSessions.get(sessionId);
  if (cached) {
    if (cached.organizationId !== ctx.organizationId) {
      return null;
    }
    // Reset timeout and update activity
    clearTimeout(cached.timeoutId);
    cached.lastActivity = new Date();
    cached.timeoutId = setTimeout(() => cleanupSession(sessionId, "timeout"), SESSION_TIMEOUT_MS);

    // Load fresh session state from DB
    const session = await getSessionRecord(systemServices, sessionId);
    if (!session) {
      cleanupSession(sessionId, "stale");
      return null;
    }

    return { engine: cached.engine, adapter: cached.adapter, session };
  }

  // Not in cache - try to load from DB
  const session = await getSessionRecord(systemServices, sessionId);
  if (!session || session.mode !== "simulation") {
    return null;
  }

  const journeyOrganizationId = await systemServices.channel.getJourneyOrganizationId(session.journeyId);
  if (!journeyOrganizationId || journeyOrganizationId !== ctx.organizationId) {
    return null;
  }

  // Check Redis cache for preserved session state (nodeOutputs, pendingTimers, etc.)
  // Even though simulator uses in-memory cache, Redis may have state from previous instance
  const cachedState = await getCachedSession(sessionId);

  // Recreate adapter and engine
  const adapter = new SimulatorAdapter(sessionId, ctx.organizationId, session.clientId, log);

  const { engine } = await createConfiguredEngine({
    session,
    adapter,
    logger: log,
    adapterType: "simulator",
    includeTagCallbacks: true,
    includeVariableCallbacks: true,
    services,
    // Restore cached session state if available (preserves stateful handler state)
    nodeOutputs: cachedState?.session.nodeOutputs,
    pendingTimers: cachedState?.session.pendingTimers,
    history: cachedState?.session.history,
    activeButtons: cachedState?.session.activeButtons,
  });

  // Cache it
  const timeoutId = setTimeout(() => cleanupSession(sessionId, "timeout"), SESSION_TIMEOUT_MS);
  activeSessions.set(sessionId, {
    sessionId,
    engine,
    adapter,
    organizationId: ctx.organizationId,
    clientId: session.clientId,
    lastActivity: new Date(),
    timeoutId,
  });

  return { engine, adapter, session };
}

/**
 * Cleanup a simulator session
 *
 * Removes from cache but keeps DB records for replay/debugging.
 *
 * @param sessionId - The session ID to cleanup
 * @param reason - Why the session is being cleaned up (for logging)
 */
export async function cleanupSession(
  sessionId: string,
  reason: "timeout" | "explicit" | "error" | "stale" = "explicit"
): Promise<void> {
  const cached = activeSessions.get(sessionId);
  if (cached) {
    const sessionAgeMs = Date.now() - cached.lastActivity.getTime();
    clearTimeout(cached.timeoutId);
    try {
      await cached.engine.destroy();
    } catch (error) {
      log.error({ sessionId, err: serializeError(error) }, "simulatorSessionManager:engineDestroy:error");
    }
    cached.adapter.clearTimerMap(); // Clear timer tracking to prevent memory leaks
    activeSessions.delete(sessionId);
    log.info(
      {
        sessionId,
        reason,
        sessionAgeMs,
        sessionAgeSec: Math.round(sessionAgeMs / 1000),
      },
      "simulatorSessionManager:sessionCleaned"
    );
  }
}

async function cleanupSessionsForClient(
  clientId: string,
  reason: "timeout" | "explicit" | "error" | "stale" = "explicit"
): Promise<void> {
  const sessions = Array.from(activeSessions.values()).filter((session) => session.clientId === clientId);

  if (sessions.length === 0) return;

  await Promise.all(sessions.map((session) => cleanupSession(session.sessionId, reason)));
}

/**
 * Update session state in DB after engine processing.
 * Also syncs the adapter debug state for SSE event enrichment.
 */
export async function updateSimulatorSessionState(
  systemServices: ServiceContainer,
  sessionId: string
): Promise<void> {
  const cached = activeSessions.get(sessionId);
  if (!cached) return;

  // Use shared helper - pass null for tags to load fresh from DB
  await syncSessionStateToDb(systemServices, sessionId, cached.engine, cached.adapter, null);
}

/**
 * Get count of active simulator sessions
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}

/**
 * Cleanup all sessions (for graceful shutdown)
 */
export function cleanupAllSessions(): void {
  const previousCount = activeSessions.size;
  for (const [sessionId, session] of activeSessions) {
    clearTimeout(session.timeoutId);
    session.adapter.clearTimerMap();
    log.debug({ sessionId }, "simulatorSessionManager:cleanupAll");
  }
  activeSessions.clear();
  log.info({ previousCount }, "simulatorSessionManager:allSessionsCleaned");
}
