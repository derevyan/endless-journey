/**
 * Session State Manager
 *
 * Encapsulates session state mutations for the journey engine.
 * Provides typed methods instead of direct property access.
 *
 * Benefits:
 * - Single source of truth for state mutations
 * - Version tracking for cache conflict detection
 * - Validation of state transitions
 * - Event emission on state changes (future extensibility)
 *
 * @module engine/state/session-state-manager
 */

import type { EnhancedUserJourney } from "@journey/schemas";

/**
 * Session status type (extracted from EnhancedUserJourney)
 */
export type SessionStatus = EnhancedUserJourney["status"];

/**
 * Pending timer type (extracted from EnhancedUserJourney)
 */
export type PendingTimer = EnhancedUserJourney["pendingTimers"][number];

/**
 * Pending plugin follow-up type (extracted from EnhancedUserJourney)
 */
export type PendingPluginFollowUp = EnhancedUserJourney["pendingPluginFollowUps"][number];

/**
 * Active button type (extracted from EnhancedUserJourney)
 */
export type ActiveButton = NonNullable<EnhancedUserJourney["activeButtons"]>[number];

/**
 * Node output type (extracted from EnhancedUserJourney)
 */
export type NodeOutput = NonNullable<EnhancedUserJourney["nodeOutputs"]>[string];

/**
 * Session state update result
 */
export interface StateUpdateResult {
  /** Whether the update was applied */
  applied: boolean;
  /** New version number after update */
  version: number;
  /** Reason for rejection if not applied */
  reason?: string;
}

/**
 * Configuration for SessionStateManager
 */
export interface SessionStateManagerConfig {
  /** Enable strict mode - throws on invalid state transitions */
  strictMode?: boolean;
}

/**
 * Session State Manager
 *
 * Wraps an EnhancedUserJourney and provides typed mutation methods.
 * Tracks version number for each mutation to support cache conflict detection.
 *
 * @example
 * ```ts
 * const manager = new SessionStateManager(session);
 *
 * // Transition to a new node
 * manager.transitionToNode("message-1");
 *
 * // Update context
 * manager.updateContext({ userName: "Alice" });
 *
 * // Check version for cache sync
 * const version = manager.getVersion();
 * ```
 */
export class SessionStateManager {
  private readonly session: EnhancedUserJourney;
  private readonly config: SessionStateManagerConfig;
  private version: number = 0;

  constructor(session: EnhancedUserJourney, config: SessionStateManagerConfig = {}) {
    this.session = session;
    this.config = config;
  }

  // ===========================================================================
  // READ ACCESSORS
  // ===========================================================================

  /**
   * Get the current session state (readonly snapshot)
   */
  getSession(): EnhancedUserJourney {
    return this.session;
  }

  /**
   * Get current version number
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get current node ID
   */
  getCurrentNodeId(): string {
    return this.session.currentNodeId;
  }

  /**
   * Get session status
   */
  getStatus(): SessionStatus {
    return this.session.status;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.session.status === "active";
  }

  /**
   * Check if session is completed
   */
  isCompleted(): boolean {
    return this.session.status === "completed";
  }

  // ===========================================================================
  // STATE MUTATIONS
  // ===========================================================================

  /**
   * Transition to a new node
   *
   * @param nodeId - Target node ID
   * @returns State update result
   */
  transitionToNode(nodeId: string): StateUpdateResult {
    // Validate: can't transition if session is completed/dropped
    if (this.session.status === "completed" || this.session.status === "dropped") {
      const reason = `Cannot transition: session status is ${this.session.status}`;
      if (this.config.strictMode) {
        throw new Error(reason);
      }
      return { applied: false, version: this.version, reason };
    }

    this.session.currentNodeId = nodeId;
    return this.incrementVersion();
  }

  /**
   * Update session status
   *
   * @param status - New status
   * @returns State update result
   */
  setStatus(status: SessionStatus): StateUpdateResult {
    // Validate status transitions
    const currentStatus = this.session.status;
    if (!this.isValidStatusTransition(currentStatus, status)) {
      const reason = `Invalid status transition: ${currentStatus} -> ${status}`;
      if (this.config.strictMode) {
        throw new Error(reason);
      }
      return { applied: false, version: this.version, reason };
    }

    this.session.status = status;

    // Set completion timestamp for terminal states
    if (status === "completed" || status === "dropped") {
      this.session.completedAt = new Date().toISOString();
    }

    return this.incrementVersion();
  }

  /**
   * Initialize session (called once at start)
   * Sets hasStarted = true for deterministic resume detection
   */
  initializeSession(startNodeId: string): StateUpdateResult {
    this.session.currentNodeId = startNodeId;
    this.session.status = "active";
    this.session.startedAt = new Date().toISOString();
    this.session.hasStarted = true;
    return this.incrementVersion();
  }

  /**
   * Check if session has been started (first node executed)
   * Used for deterministic resume detection
   */
  isStarted(): boolean {
    return this.session.hasStarted ?? false;
  }

  /**
   * Update session context with new values
   *
   * @param updates - Context updates to merge
   * @returns State update result
   */
  updateContext(updates: Record<string, unknown>): StateUpdateResult {
    this.session.context = {
      ...this.session.context,
      ...updates,
    } as EnhancedUserJourney["context"];
    return this.incrementVersion();
  }

  /**
   * Set a specific context value
   *
   * @param key - Context key
   * @param value - Context value
   * @returns State update result
   */
  setContextValue(key: string, value: unknown): StateUpdateResult {
    (this.session.context as Record<string, unknown>)[key] = value;
    return this.incrementVersion();
  }

  /**
   * Delete a specific context key
   *
   * Used for cleaning up temporary context values (e.g., invalid userResponse).
   * No-op if the key doesn't exist.
   *
   * @param key - Context key to delete
   * @returns State update result
   */
  deleteContextKey(key: string): StateUpdateResult {
    const context = this.session.context as Record<string, unknown>;
    if (!(key in context)) {
      return { applied: false, version: this.version, reason: "Context key not found" };
    }
    delete context[key];
    return this.incrementVersion();
  }

  // ===========================================================================
  // TIMER MANAGEMENT
  // ===========================================================================

  /**
   * Add a pending timer
   *
   * @param timer - Timer to add
   * @returns State update result
   */
  addPendingTimer(timer: PendingTimer): StateUpdateResult {
    // Don't add duplicate timers
    const exists = this.session.pendingTimers.some((t) => t.timerId === timer.timerId);
    if (exists) {
      return { applied: false, version: this.version, reason: "Timer already exists" };
    }

    this.session.pendingTimers.push(timer);
    return this.incrementVersion();
  }

  /**
   * Remove a pending timer by ID
   *
   * @param timerId - Timer ID to remove
   * @returns State update result
   */
  removePendingTimer(timerId: string): StateUpdateResult {
    const initialLength = this.session.pendingTimers.length;
    this.session.pendingTimers = this.session.pendingTimers.filter((t) => t.timerId !== timerId);

    if (this.session.pendingTimers.length === initialLength) {
      return { applied: false, version: this.version, reason: "Timer not found" };
    }

    return this.incrementVersion();
  }

  /**
   * Remove pending timers by edge IDs
   *
   * @param edgeIds - Set of edge IDs whose timers should be removed
   * @returns State update result with count of removed timers
   */
  removePendingTimersByEdges(edgeIds: Set<string>): StateUpdateResult & { removedCount: number } {
    const initialLength = this.session.pendingTimers.length;
    this.session.pendingTimers = this.session.pendingTimers.filter(
      (timer) => !edgeIds.has(timer.targetEdgeId)
    );
    const removedCount = initialLength - this.session.pendingTimers.length;

    if (removedCount === 0) {
      return { applied: false, version: this.version, reason: "No matching timers", removedCount: 0 };
    }

    return { ...this.incrementVersion(), removedCount };
  }

  /**
   * Get pending timers for a specific edge
   *
   * @param edgeId - Edge ID to filter by
   * @returns Array of pending timers
   */
  getPendingTimersForEdge(edgeId: string): PendingTimer[] {
    return this.session.pendingTimers.filter((t) => t.targetEdgeId === edgeId);
  }

  /**
   * Clear all pending timers
   *
   * @returns State update result
   */
  clearAllPendingTimers(): StateUpdateResult {
    if (this.session.pendingTimers.length === 0) {
      return { applied: false, version: this.version, reason: "No timers to clear" };
    }

    this.session.pendingTimers = [];
    return this.incrementVersion();
  }

  // ===========================================================================
  // PLUGIN FOLLOW-UP MANAGEMENT
  // ===========================================================================

  /**
   * Add a pending plugin follow-up
   *
   * @param followUp - Plugin follow-up to add
   * @returns State update result
   */
  addPendingPluginFollowUp(followUp: PendingPluginFollowUp): StateUpdateResult {
    // Don't add duplicate follow-ups
    const exists = this.session.pendingPluginFollowUps?.some((pfu) => pfu.timerId === followUp.timerId);
    if (exists) {
      return { applied: false, version: this.version, reason: "Plugin follow-up already exists" };
    }

    this.session.pendingPluginFollowUps = this.session.pendingPluginFollowUps || [];
    this.session.pendingPluginFollowUps.push(followUp);
    return this.incrementVersion();
  }

  /**
   * Remove a pending plugin follow-up by timer ID
   *
   * @param timerId - Timer ID to remove
   * @returns State update result
   */
  removePendingPluginFollowUp(timerId: string): StateUpdateResult {
    const followUps = this.session.pendingPluginFollowUps || [];
    const initialLength = followUps.length;
    this.session.pendingPluginFollowUps = followUps.filter((pfu) => pfu.timerId !== timerId);

    if (this.session.pendingPluginFollowUps.length === initialLength) {
      return { applied: false, version: this.version, reason: "Plugin follow-up not found" };
    }

    return this.incrementVersion();
  }

  /**
   * Clear all pending plugin follow-ups
   *
   * @returns State update result
   */
  clearAllPendingPluginFollowUps(): StateUpdateResult {
    const followUps = this.session.pendingPluginFollowUps || [];
    if (followUps.length === 0) {
      return { applied: false, version: this.version, reason: "No plugin follow-ups to clear" };
    }

    this.session.pendingPluginFollowUps = [];
    return this.incrementVersion();
  }

  /**
   * Remove pending plugin follow-ups by parent node ID
   *
   * @param parentNodeId - Parent node ID to filter by
   * @returns State update result with count of removed follow-ups
   */
  removePendingPluginFollowUpsByParentNode(parentNodeId: string): StateUpdateResult & { removedCount: number } {
    const followUps = this.session.pendingPluginFollowUps || [];
    const initialLength = followUps.length;
    this.session.pendingPluginFollowUps = followUps.filter((pfu) => pfu.parentNodeId !== parentNodeId);
    const removedCount = initialLength - this.session.pendingPluginFollowUps.length;

    if (removedCount === 0) {
      return { applied: false, version: this.version, reason: "No matching plugin follow-ups", removedCount: 0 };
    }

    return { ...this.incrementVersion(), removedCount };
  }

  // ===========================================================================
  // TAGS MANAGEMENT
  // ===========================================================================

  /**
   * Set tags array
   *
   * @param tags - Tags array to set
   * @returns State update result
   */
  setTags(tags: string[]): StateUpdateResult {
    this.session.tags = tags;
    return this.incrementVersion();
  }

  // ===========================================================================
  // ACTIVE BUTTONS MANAGEMENT
  // ===========================================================================

  /**
   * Set active buttons
   *
   * @param buttons - Buttons to set, or undefined to clear
   * @returns State update result
   */
  setActiveButtons(buttons: ActiveButton[] | undefined): StateUpdateResult {
    this.session.activeButtons = buttons;
    return this.incrementVersion();
  }

  /**
   * Clear active buttons
   *
   * @returns State update result
   */
  clearActiveButtons(): StateUpdateResult {
    if (!this.session.activeButtons) {
      return { applied: false, version: this.version, reason: "No active buttons to clear" };
    }
    this.session.activeButtons = undefined;
    return this.incrementVersion();
  }

  // ===========================================================================
  // NODE OUTPUTS MANAGEMENT
  // ===========================================================================

  /**
   * Set a node output
   *
   * @param key - Output key (sanitized label or state key)
   * @param output - Output data to store
   * @returns State update result
   */
  setNodeOutput(key: string, output: NodeOutput): StateUpdateResult {
    if (!this.session.nodeOutputs) {
      this.session.nodeOutputs = {};
    }
    this.session.nodeOutputs[key] = output;
    return this.incrementVersion();
  }

  /**
   * Clear a node output
   *
   * @param key - Output key to clear
   * @returns State update result
   */
  clearNodeOutput(key: string): StateUpdateResult {
    if (!this.session.nodeOutputs || !(key in this.session.nodeOutputs)) {
      return { applied: false, version: this.version, reason: "Node output not found" };
    }
    delete this.session.nodeOutputs[key];
    return this.incrementVersion();
  }

  /**
   * Clear all node outputs
   *
   * @returns State update result
   */
  clearAllNodeOutputs(): StateUpdateResult {
    if (!this.session.nodeOutputs || Object.keys(this.session.nodeOutputs).length === 0) {
      return { applied: false, version: this.version, reason: "No node outputs to clear" };
    }
    this.session.nodeOutputs = {};
    return this.incrementVersion();
  }

  /**
   * Add event to session history
   *
   * Note: History is an audit log, not execution state, so version is not incremented.
   * However, updatedAt is still updated to track session liveness.
   *
   * @param event The event to add to history
   */
  addHistoryEvent(event: import("@journey/schemas").InteractionEvent): void {
    this.session.history.push(event);
    this.session.updatedAt = new Date().toISOString();
    // Note: Version NOT incremented (history is append-only audit log)
  }

  /**
   * Trim history to prevent unbounded growth
   * Keeps most recent N events (default: 1000)
   *
   * @param maxEvents Maximum number of history events to keep
   */
  trimHistory(maxEvents: number = 1000): void {
    if (this.session.history.length > maxEvents) {
      this.session.history = this.session.history.slice(-maxEvents);
      this.session.updatedAt = new Date().toISOString();
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Increment version, update timestamp, and return result
   * Centralizes timestamp update to avoid repetition in every mutation method
   */
  private incrementVersion(): StateUpdateResult {
    this.session.updatedAt = new Date().toISOString();
    this.version++;
    return { applied: true, version: this.version };
  }

  /**
   * Check if a status transition is valid
   */
  private isValidStatusTransition(from: SessionStatus, to: SessionStatus): boolean {
    // Same status is always valid (no-op)
    if (from === to) return true;

    // Valid transitions
    const validTransitions: Record<SessionStatus, SessionStatus[]> = {
      active: ["completed", "dropped", "paused", "error"],
      paused: ["active", "dropped"],
      completed: [], // Terminal state
      dropped: [], // Terminal state
      error: ["active", "dropped"], // Can recover or drop
    };

    return validTransitions[from]?.includes(to) ?? false;
  }
}

/**
 * Factory function for creating SessionStateManager
 */
export function createSessionStateManager(
  session: EnhancedUserJourney,
  config?: SessionStateManagerConfig
): SessionStateManager {
  return new SessionStateManager(session, config);
}
