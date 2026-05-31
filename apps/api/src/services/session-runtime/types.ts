/**
 * Session Runtime Types
 *
 * Common types and interfaces for session operations.
 *
 * @module services/session-runtime/types
 */

import type { MessagingAdapter } from "@journey/engine";
import type { EnhancedUserJourney, JourneyConfig } from "@journey/schemas";
import type { createLogger } from "@journey/logger";
import type { BotRecord, ChannelSessionRecord, ClientRecord } from "@journey/schemas";

// =============================================================================
// SESSION CONTEXT
// =============================================================================

/**
 * Context for session operations
 *
 * This provides all the information needed to start or resume a session.
 */
export interface SessionContext {
  /** Organization ID for multi-tenancy */
  organizationId: string;
  /** Journey configuration */
  journeyConfig: JourneyConfig;
  /** Session record from database */
  session: ChannelSessionRecord;
  /** Client/user data */
  clientData?: ClientRecord;
  /** Logging context */
  logger: ReturnType<typeof createLogger>;
}

// =============================================================================
// START SESSION
// =============================================================================

/**
 * Options for starting a new session
 */
export interface StartSessionOptions {
  /** Journey ID to start */
  journeyId: string;
  /** Client ID */
  clientId: string;
  /** Optional channel ID (for Telegram) */
  channelId?: string;
  /** Optional bot record (for Telegram) */
  bot?: BotRecord;
  /** Optional custom adapter (for simulator/no-op) */
  adapter?: MessagingAdapter;
  /** Adapter type identifier */
  adapterType?: "telegram" | "timer" | "simulator";
  /** Additional context to inject into session */
  customContext?: Record<string, unknown>;
  /** Additional metadata for events */
  eventMetadata?: Record<string, unknown>;
  /** Logger instance */
  logger: ReturnType<typeof createLogger>;
}

/**
 * Result of starting a session
 */
export interface StartSessionResult {
  /** Session ID */
  sessionId: string;
  /** Organization ID */
  organizationId: string;
  /** Final node ID after start */
  currentNodeId: string;
  /** Session status */
  status: EnhancedUserJourney["status"];
  /** Whether session completed immediately */
  completedAt: string | null;
}

// =============================================================================
// RESUME SESSION
// =============================================================================

/**
 * Options for resuming an existing session
 */
export interface ResumeSessionOptions {
  /** Session ID to resume */
  sessionId: string;
  /** Channel ID (for Telegram timers) */
  channelId?: string;
  /** Edge ID that triggered the resume (for timers) */
  edgeId?: string;
  /** Timer ID (for tracing) */
  timerId?: string;
  /** Adapter type */
  adapterType?: "telegram" | "timer" | "simulator";
  /** Logger instance */
  logger: ReturnType<typeof createLogger>;
}

/**
 * Result of resuming a session
 */
export interface ResumeSessionResult {
  /** Session ID */
  sessionId: string;
  /** Organization ID */
  organizationId: string;
  /** Final node ID after resume */
  currentNodeId: string;
  /** Session status */
  status: EnhancedUserJourney["status"];
  /** Whether session completed */
  completedAt: string | null;
}

// =============================================================================
// STATE PERSISTENCE
// =============================================================================

/**
 * Session state for caching
 */
export interface CachedSessionState {
  nodeOutputs?: EnhancedUserJourney["nodeOutputs"];
  pendingTimers?: EnhancedUserJourney["pendingTimers"];
  pendingPluginFollowUps?: EnhancedUserJourney["pendingPluginFollowUps"];
  history?: EnhancedUserJourney["history"];
  activeButtons?: EnhancedUserJourney["activeButtons"];
  context?: EnhancedUserJourney["context"];
}

/**
 * Options for persisting session state
 */
export interface PersistStateOptions {
  /** Session ID */
  sessionId: string;
  /** Current session state from engine */
  session: EnhancedUserJourney;
  /** Logger instance */
  logger: ReturnType<typeof createLogger>;
  /**
   * Cache mode for active sessions.
   * - "set" for new sessions (adds journey index)
   * - "update" for existing sessions
   */
  cacheMode?: "set" | "update";
}

// =============================================================================
// EVENT EMISSION
// =============================================================================

/**
 * Context for emitting session events
 */
export interface SessionEventContext {
  organizationId: string;
  clientId: string;
  sessionId: string;
  journeyId: string;
  channelId?: string;
  source?: "webhook" | "automation" | "timer" | "teleport" | "simulator";
  journeyName?: string;
  startNodeId?: string;
  finalNodeId?: string;
}
