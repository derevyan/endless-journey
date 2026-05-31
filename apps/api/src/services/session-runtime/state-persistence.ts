/**
 * Session State Persistence
 *
 * Handles persisting and restoring session state to/from cache and database.
 * Consolidates caching logic used across webhook, timer, and automation handlers.
 *
 * @module services/session-runtime/state-persistence
 */

import { createLogger, serializeError } from "@journey/logger";
import { InteractionEventTypeSchema, type EnhancedUserJourney, type InteractionEvent } from "@journey/schemas";
import { createNodeOutputsStore, loadConversation, deleteConversation } from "@journey/engine-integrations";
import { getCachedSession, setCachedSession, updateCachedSession, clearSessionEngine } from "../session-cache-service";
import { db } from "@journey/db";
import type { CachedSessionState, PersistStateOptions } from "./types";
import { createServicesForSystem } from "../create-services";
import { isRecord } from "../../lib/type-guards";

const log = createLogger("session-runtime:state");

// Singleton store for node outputs persistence
const nodeOutputsStore = createNodeOutputsStore();

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Get cached session state
 *
 * Retrieves session state from Redis cache, including nodeOutputs,
 * pendingTimers, history, and other stateful handler data.
 *
 * @param sessionId - The session ID
 * @returns Cached state or null if not found
 */
export async function getSessionCache(sessionId: string): Promise<CachedSessionState | null> {
  try {
    const cached = await getCachedSession(sessionId);
    if (!cached) {
      return null;
    }

    return {
      context: cached.session.context,
      nodeOutputs: cached.session.nodeOutputs,
      pendingTimers: cached.session.pendingTimers,
      pendingPluginFollowUps: cached.session.pendingPluginFollowUps,
      history: cached.session.history,
      activeButtons: cached.session.activeButtons,
    };
  } catch (error) {
    log.warn({ err: serializeError(error), sessionId }, "sessionRuntime:getCache:failed");
    return null;
  }
}

/**
 * Update session cache
 *
 * Updates the Redis cache with current session state.
 * Used for active sessions to preserve state between messages.
 *
 * @param sessionId - The session ID
 * @param session - Current session state from engine
 */
export async function updateSessionCache(
  sessionId: string,
  session: EnhancedUserJourney,
  cacheMode: "set" | "update" = "update"
): Promise<void> {
  try {
    if (cacheMode === "set") {
      await setCachedSession(sessionId, session.journeyId, session);
      log.debug({ sessionId, nodeId: session.currentNodeId }, "sessionRuntime:setCache:success");
    } else {
      await updateCachedSession(sessionId, session);
      log.debug({ sessionId, nodeId: session.currentNodeId }, "sessionRuntime:updateCache:success");
    }
  } catch (error) {
    log.warn({ err: serializeError(error), sessionId }, "sessionRuntime:updateCache:failed");
  }
}

/**
 * Clear session cache
 *
 * Removes session from Redis cache.
 * Used when session completes or needs fresh state from database.
 *
 * @param sessionId - The session ID
 */
export async function clearCache(sessionId: string): Promise<void> {
  try {
    await clearSessionEngine(sessionId);
    log.debug({ sessionId }, "sessionRuntime:clearCache:success");
  } catch (error) {
    log.warn({ err: serializeError(error), sessionId }, "sessionRuntime:clearCache:failed");
  }
}

// =============================================================================
// HISTORY RECOVERY (Cache Expiration Handler)
// =============================================================================

/**
 * Load session interaction history from database
 *
 * Used when Redis cache expires to rebuild conversation history.
 * This ensures users don't lose conversation context after cache TTL.
 *
 * PHASE 3: Two-tier read strategy
 * 1. Try conversations table (JSONB document) - FAST (5-10ms for 1000 messages)
 * 2. Fallback to interactions table - SLOW (150-200ms) but guarantees data exists
 *
 * This provides 10-20x faster cache miss recovery while maintaining data safety.
 *
 * @param sessionId - The session ID
 * @returns Interaction history in chronological order, or empty array if not found
 *
 * @remarks
 * The conversations table is the optimized read model for fast cache recovery.
 * The interactions table is the event-sourced source of truth.
 * Fallback ensures data is never lost if conversations table is out of sync.
 */
export async function loadHistoryFromDatabase(sessionId: string): Promise<InteractionEvent[]> {
  try {
    const startTime = performance.now();

    // PHASE 3: Try JSONB document model first (fast path)
    const conversationMessages = await loadConversation(sessionId);

    if (conversationMessages) {
      const duration = performance.now() - startTime;

      log.debug(
        {
          sessionId,
          eventCount: conversationMessages.length,
          durationMs: duration,
          source: "conversations",
        },
        "sessionRuntime:loadHistory:conversations"
      );

      return conversationMessages;
    }

    // Fallback: Load from interactions table if conversation document missing
    // This handles:
    // - Sessions created before Phase 2 (no conversations document yet)
    // - Dual-write failures during Phase 2 (rare)
    // - Migration edge cases
    log.warn(
      { sessionId, durationMs: performance.now() - startTime },
      "sessionRuntime:loadHistory:fallback:noConversation"
    );

    const { interactions } = await import("@journey/db");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, sessionId))
      .orderBy(interactions.timestamp);

    const fallbackDuration = performance.now() - startTime;

    if (rows.length > 0) {
      log.warn(
        {
          sessionId,
          eventCount: rows.length,
          durationMs: fallbackDuration,
          source: "interactions",
        },
        "sessionRuntime:loadHistory:interactions"
      );
    }

    const history: InteractionEvent[] = rows.flatMap((row) => {
      const typeResult = InteractionEventTypeSchema.safeParse(row.type);
      if (!typeResult.success) {
        log.warn({ sessionId, eventType: row.type }, "sessionRuntime:loadHistory:invalidEventType");
        return [];
      }

      const metadata = isRecord(row.metadata) ? row.metadata : undefined;

      return [
        {
          id: row.id,
          type: typeResult.data,
          payload: row.payload,
          timestamp: row.timestamp.toISOString(),
          nodeId: row.nodeId,
          ...(metadata !== undefined ? { metadata } : {}),
        },
      ];
    });

    return history;
  } catch (error) {
    log.error(
      { err: serializeError(error), sessionId },
      "sessionRuntime:loadHistoryFromDatabase:failed"
    );
    // Return empty array on error - allows session to continue without history
    return [];
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Persist session state to database
 *
 * Updates the session record with current node, status, and completion time.
 * This is the source of truth for session state.
 *
 * @param options - Persistence options
 */
export async function persistSessionState(options: PersistStateOptions): Promise<void> {
  const { sessionId, session, logger } = options;

  try {
    const services = createServicesForSystem();
    await services.channel.updateSession(sessionId, {
      currentNodeId: session.currentNodeId,
      status: session.status,
      completedAt: session.completedAt ? new Date(session.completedAt) : undefined,
    });

    logger.debug(
      { sessionId, currentNodeId: session.currentNodeId, status: session.status },
      "sessionRuntime:persistState:success"
    );
  } catch (error) {
    logger.error({ err: serializeError(error), sessionId }, "sessionRuntime:persistState:failed");
    throw error;
  }
}

/**
 * Persist node outputs to database
 *
 * Saves nodeOutputs for stateful handlers (Agent, Questionnaire) to database.
 * This allows recovery after cache expiry.
 *
 * @param sessionId - The session ID
 * @param nodeOutputs - Node outputs from engine session
 */
export async function persistNodeOutputs(
  sessionId: string,
  nodeOutputs: EnhancedUserJourney["nodeOutputs"]
): Promise<void> {
  const outputCount = nodeOutputs ? Object.keys(nodeOutputs).length : 0;

  if (outputCount === 0) {
    return;
  }

  try {
    await nodeOutputsStore.saveOutputs(sessionId, nodeOutputs);
    log.info({ sessionId, outputCount }, "sessionRuntime:persistNodeOutputs:success");
  } catch (error) {
    // CRITICAL: Node outputs are essential for session recovery and impersonate mode
    // Failure to persist means data loss - must surface this as an error
    log.error(
      { err: serializeError(error), sessionId, outputCount },
      "sessionRuntime:persistNodeOutputs:failed"
    );
    throw error; // Re-throw so caller can handle persistence failure
  }
}

/**
 * Load node outputs from database
 *
 * Retrieves nodeOutputs from database for cache miss recovery.
 *
 * @param sessionId - The session ID
 * @returns Node outputs or empty object
 */
export async function loadNodeOutputs(
  sessionId: string
): Promise<EnhancedUserJourney["nodeOutputs"]> {
  try {
    const outputs = await nodeOutputsStore.loadOutputs(sessionId);
    if (outputs && Object.keys(outputs).length > 0) {
      log.debug({ sessionId, outputCount: Object.keys(outputs).length }, "sessionRuntime:loadNodeOutputs:success");
    }
    return outputs || {};
  } catch (error) {
    log.warn({ err: serializeError(error), sessionId }, "sessionRuntime:loadNodeOutputs:failed");
    return {};
  }
}


// =============================================================================
// FINALIZATION
// =============================================================================

/**
 * Finalize session after processing
 *
 * Handles all post-processing state persistence:
 * - Updates database with final state
 * - Updates cache for active sessions
 * - Persists nodeOutputs for active sessions
 * - Clears Redis cache for completed sessions (keeps node outputs and conversations for historical access)
 *
 * @param options - Persistence options
 */
export async function finalizeSession(options: PersistStateOptions): Promise<void> {
  const { sessionId, session, logger, cacheMode } = options;

  // Always persist to database first
  await persistSessionState(options);

  // Handle cache and nodeOutputs based on session status
  if (session.status === "active") {
    // Active session - update cache and persist nodeOutputs
    await updateSessionCache(sessionId, session, cacheMode);

    // Persist node outputs - re-throw errors so they're visible and can be addressed
    // This is critical for session recovery and impersonate mode functionality
    try {
      await persistNodeOutputs(sessionId, session.nodeOutputs);
    } catch (error) {
      logger.error(
        { err: serializeError(error), sessionId },
        "sessionRuntime:finalize:nodeOutputsPersistenceFailed"
      );
      // Re-throw so the error propagates and can be handled at the handler level
      throw error;
    }
  } else if (session.status === "completed" || session.status === "dropped") {
    // Completed session - only clear Redis cache (temporary runtime state)
    // Keep node outputs and conversation documents for historical access
    await clearCache(sessionId);

    logger.info(
      { sessionId, status: session.status },
      "sessionRuntime:finalize:sessionEnded"
    );
  }
}
