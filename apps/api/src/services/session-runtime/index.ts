/**
 * Session Runtime Module
 *
 * Provides unified session lifecycle management for journey execution.
 * Consolidates duplicated patterns from webhook, timer, automation, and teleport handlers.
 *
 * This module provides:
 * - Session state persistence (cache + database)
 * - Session lifecycle event emission
 * - Centralized types for session operations
 *
 * @module services/session-runtime
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  SessionContext,
  StartSessionOptions,
  StartSessionResult,
  ResumeSessionOptions,
  ResumeSessionResult,
  CachedSessionState,
  PersistStateOptions,
  SessionEventContext,
} from "./types";

// =============================================================================
// STATE PERSISTENCE
// =============================================================================

export {
  // Cache operations
  getSessionCache,
  updateSessionCache,
  clearCache,
  // Database operations
  persistSessionState,
  persistNodeOutputs,
  loadNodeOutputs,
  // Combined finalization
  finalizeSession,
} from "./state-persistence";

// =============================================================================
// EVENT EMISSION
// =============================================================================

export {
  emitSessionStarted,
  emitSessionCompleted,
} from "./event-emission";
