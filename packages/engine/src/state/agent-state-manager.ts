/**
 * Agent State Manager
 *
 * Encapsulates agent node state management for the journey engine.
 * Provides typed methods for state access and mutations during agent execution.
 *
 * Benefits:
 * - Centralized state management for agent nodes
 * - Type-safe state access and mutations
 * - Clear separation from handler logic
 * - Reusable state operations across handlers
 *
 * @module engine/state/agent-state-manager
 */

import type { AgentState } from "@journey/schemas";

/**
 * Usage result from a workflow execution
 */
export interface WorkflowUsage {
  totalTokens: number;
  totalCostUSD: number;
}

/**
 * Agent State Manager
 *
 * Wraps agent state and provides typed methods for state operations.
 * Used during agent node execution to track conversation state.
 *
 * @example
 * ```ts
 * const manager = createAgentStateManager(initialState, setState);
 *
 * // Check if workflow has been initialized
 * if (!manager.isWorkflowInitialized()) {
 *   // First execution logic...
 * }
 *
 * // Record workflow execution
 * manager.markWorkflowInitialized();
 * manager.accumulateUsage({ totalTokens: 500, totalCostUSD: 0.01 });
 * manager.incrementMessageCount();
 * ```
 */
export class AgentStateManager {
  private readonly state: AgentState;
  private readonly persistState: (state: AgentState) => void;

  constructor(state: AgentState, persistState: (state: AgentState) => void) {
    this.state = state;
    this.persistState = persistState;
  }

  // ===========================================================================
  // READ ACCESSORS
  // ===========================================================================

  /**
   * Get the current state (readonly snapshot)
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Check if workflow has been initialized (first execution happened)
   */
  isWorkflowInitialized(): boolean {
    return this.state.workflowInitialized;
  }

  /**
   * Check if initial greeting has been sent (for welcome_first mode)
   */
  isInitialGreetingSent(): boolean {
    return this.state.initialGreetingSent;
  }

  /**
   * Get the current timer ID (if scheduled)
   */
  getTimerId(): string | undefined {
    return this.state.timerId;
  }

  /**
   * Check if a timer is already scheduled
   */
  hasTimer(): boolean {
    return !!this.state.timerId;
  }

  /**
   * Get current message count
   */
  getMessageCount(): number {
    return this.state.messageCount;
  }

  /**
   * Get total accumulated tokens
   */
  getTotalTokens(): number {
    return this.state.totalTokens;
  }

  /**
   * Get total accumulated cost in USD
   */
  getTotalCostUSD(): number {
    return this.state.totalCostUSD;
  }

  // ===========================================================================
  // STATE MUTATIONS
  // ===========================================================================

  /**
   * Mark workflow as initialized after first execution
   */
  markWorkflowInitialized(): void {
    this.state.workflowInitialized = true;
    this.persist();
  }

  /**
   * Mark initial greeting as sent (for welcome_first mode)
   */
  markInitialGreetingSent(): void {
    this.state.initialGreetingSent = true;
    this.persist();
  }

  /**
   * Set the timer ID when a timeout timer is scheduled
   *
   * @param timerId - The scheduled timer ID
   */
  setTimerId(timerId: string): void {
    this.state.timerId = timerId;
    this.persist();
  }

  /**
   * Increment message count after each turn
   */
  incrementMessageCount(): void {
    this.state.messageCount += 1;
    this.persist();
  }

  /**
   * Accumulate usage from a workflow execution
   *
   * @param usage - Token and cost usage from the workflow
   */
  accumulateUsage(usage: WorkflowUsage): void {
    this.state.totalTokens += usage.totalTokens;
    this.state.totalCostUSD += usage.totalCostUSD;
    this.state.lastTurnTokens = usage.totalTokens;
    this.state.lastTurnCostUSD = usage.totalCostUSD;
    this.persist();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Persist state changes to the execution context
   */
  private persist(): void {
    this.persistState(this.state);
  }
}

/**
 * Create default agent state for initial execution.
 * Called when a session first enters an agent node.
 */
export function createDefaultAgentState(): AgentState {
  return {
    conversationStartedAt: new Date().toISOString(),
    messageCount: 0,
    initialGreetingSent: false,
    workflowInitialized: false,
    totalTokens: 0,
    totalCostUSD: 0,
    lastTurnTokens: 0,
    lastTurnCostUSD: 0,
  };
}

/**
 * Factory function for creating AgentStateManager
 *
 * @param state - Current agent state (or undefined for initial state)
 * @param setState - Function to persist state changes
 * @returns AgentStateManager instance with state operations
 *
 * @example
 * ```ts
 * const manager = createAgentStateManager(
 *   context.getState<AgentState>(),
 *   context.setState
 * );
 *
 * if (!manager.isWorkflowInitialized()) {
 *   // Handle first execution
 *   manager.markWorkflowInitialized();
 * }
 * ```
 */
export function createAgentStateManager(
  state: AgentState | undefined,
  setState: (state: AgentState) => void
): AgentStateManager {
  const resolvedState = state ?? createDefaultAgentState();
  return new AgentStateManager(resolvedState, setState);
}
