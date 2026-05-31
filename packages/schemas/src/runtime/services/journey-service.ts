/**
 * Journey Service Interface
 *
 * Provides journey routing and session management capabilities for AI agents
 * and engine nodes. Enables routing users between journeys programmatically.
 *
 * Key Safety Features:
 * - Allowlist-based permissions (each journey defines allowed transfer targets)
 * - Empty/undefined allowlist = no transfers allowed (explicit opt-in)
 * - Session pausing (users can be in multiple journeys)
 * - Audit logging for all transfer attempts
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for starting a user in a journey
 */
export interface StartJourneyOptions {
  /** Resume existing paused session if found (default: false = create new) */
  resumeExisting?: boolean;
  /** Preserve context/variables from current session */
  preserveContext?: boolean;
  /** How to handle current session: "pause" (default) or "end" */
  currentSessionAction?: "pause" | "end";
  /** Reason for transfer (for audit log and AI context) */
  reason?: string;
}

/**
 * Result of starting a user in a journey
 */
export interface StartJourneyResult {
  /** Whether the transfer was successful */
  success: boolean;
  /** New session ID in target journey (if successful) */
  sessionId?: string;
  /** Previous session ID that was paused/ended */
  previousSessionId?: string;
  /** Error type if failed */
  error?: "not_in_allowlist" | "journey_not_found" | "journey_inactive" | "session_error" | "no_current_journey";
  /** Human-readable error message */
  errorMessage?: string;
}

/**
 * User's active journey session info
 */
export interface UserJourneySession {
  /** Session ID */
  sessionId: string;
  /** Journey ID */
  journeyId: string;
  /** Journey name for display */
  journeyName: string;
  /** Session status */
  status: "active" | "paused";
  /** Current node ID in the journey */
  currentNodeId: string;
  /** When the session started */
  startedAt: Date;
}

/**
 * Journey metadata for discovery
 */
export interface JourneyInfo {
  /** Journey UUID */
  id: string;
  /** URL-friendly slug */
  slug: string | null;
  /** Display name */
  name: string;
  /** Description for AI routing decisions */
  description: string | null;
  /** Current status */
  status: "draft" | "active" | "inactive" | "archived";
}

/**
 * Filters for listing journeys
 */
export interface JourneyListFilters {
  /** Only show journeys in current journey's allowlist (default: true) */
  allowlistOnly?: boolean;
  /** Filter by name/description search term */
  search?: string;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Options for ending a session
 */
export interface EndSessionOptions {
  /** Reason for ending (for audit log) */
  reason?: string;
  /** Status to set: "completed" (default) or "dropped" */
  status?: "completed" | "dropped";
}

// =============================================================================
// INTERFACE
// =============================================================================

/**
 * Journey Service Interface
 *
 * Provides journey routing capabilities for AI agents and engine nodes.
 * Requires a current journey context (only works within journeys).
 *
 * @example
 * ```typescript
 * // Start user in a different journey (validates allowlist)
 * const result = await services.journey?.startUserInJourney(userId, "sales-journey", {
 *   preserveContext: true,
 *   reason: "User requested sales information"
 * });
 *
 * if (!result?.success) {
 *   log.warn({ errorMessage: result?.errorMessage }, "journey:transferFailed");
 * }
 *
 * // List available journeys (filtered by allowlist)
 * const journeys = await services.journey?.listJourneys({ allowlistOnly: true });
 *
 * // Check user's active journey sessions
 * const sessions = await services.journey?.getUserActiveJourneys(userId);
 * ```
 */
export interface IJourneyService {
  // =========================================================================
  // Core Operations (Required)
  // =========================================================================

  /**
   * Start a user in a journey.
   *
   * - Validates that target journey is in current journey's allowlist
   * - Pauses current session (or ends it based on options)
   * - Creates new session in target journey
   * - Logs transfer attempt to audit table
   *
   * @param userId - Client/user ID
   * @param journeyId - Target journey ID or slug
   * @param options - Transfer options
   * @returns Result with new session ID or error
   */
  startUserInJourney(userId: string, journeyId: string, options?: StartJourneyOptions): Promise<StartJourneyResult>;

  /**
   * Get all active/paused journey sessions for a user.
   *
   * Returns sessions across all journeys where the user has active
   * or paused sessions. Useful for AI context and conflict detection.
   *
   * @param userId - Client/user ID
   * @returns Array of active/paused sessions
   */
  getUserActiveJourneys(userId: string): Promise<UserJourneySession[]>;

  /**
   * List available journeys for routing.
   *
   * By default, only returns journeys in the current journey's allowlist.
   * Used by AI agents to discover available routing targets.
   *
   * @param filters - Optional filters
   * @returns Array of journey metadata
   */
  listJourneys(filters?: JourneyListFilters): Promise<JourneyInfo[]>;

  // =========================================================================
  // Advanced Operations (Optional)
  // =========================================================================

  /**
   * End a user's session in a journey.
   *
   * @param userId - Client/user ID
   * @param journeyId - Journey ID to end session in
   * @param options - End options
   * @returns Whether session was ended
   */
  endUserSession?(userId: string, journeyId: string, options?: EndSessionOptions): Promise<boolean>;

  /**
   * Get metadata about a specific journey.
   *
   * @param journeyId - Journey ID or slug
   * @returns Journey info or null if not found
   */
  getJourneyInfo?(journeyId: string): Promise<JourneyInfo | null>;

  /**
   * Check if a user has completed a specific journey.
   *
   * @param userId - Client/user ID
   * @param journeyId - Journey ID
   * @returns Whether user has a completed session in this journey
   */
  hasUserCompletedJourney?(userId: string, journeyId: string): Promise<boolean>;
}
