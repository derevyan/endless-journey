/**
 * Mock Session Factory
 *
 * Provides reusable mock implementations of EnhancedUserJourney for testing.
 *
 * @example
 * ```ts
 * const session = createMockSession({ userId: "custom-user" });
 * session.context = { score: 100 };
 * ```
 */

import type { EnhancedUserJourney, InteractionEvent, InteractionEventType } from "@journey/schemas";

/**
 * Options for creating a mock session
 */
export interface MockSessionOptions {
  sessionId?: string;
  userId?: string;
  platformUserId?: string;
  journeyId?: string;
  currentNodeId?: string;
  status?: "active" | "paused" | "completed" | "error";
  context?: Record<string, unknown>;
  tags?: string[];
  nodeOutputs?: EnhancedUserJourney["nodeOutputs"];
  history?: InteractionEvent[];
  pendingTimers?: EnhancedUserJourney["pendingTimers"];
  pendingPluginFollowUps?: EnhancedUserJourney["pendingPluginFollowUps"];
}

/**
 * Create mock EnhancedUserJourney for testing
 *
 * Provides sensible defaults that can be overridden.
 */
export function createMockSession(options: MockSessionOptions = {}): EnhancedUserJourney {
  return {
    sessionId: options.sessionId ?? "test-session",
    userId: options.userId ?? "test-user",
    platformUserId: options.platformUserId ?? "test-platform-user",
    journeyId: options.journeyId ?? "test-journey",
    currentNodeId: options.currentNodeId ?? "test-node",
    status: options.status ?? "active",
    context: options.context ?? {},
    tags: options.tags ?? [],
    nodeOutputs: options.nodeOutputs ?? {},
    pendingTimers: options.pendingTimers ?? [],
    pendingPluginFollowUps: options.pendingPluginFollowUps ?? [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    hasStarted: false,
    history: options.history ?? [],
  };
}

/**
 * Create a history event for testing
 */
export function createHistoryEvent(
  type: InteractionEventType,
  payload: { text?: string; content?: string; buttonId?: string },
  nodeId = "test-node"
): InteractionEvent {
  return {
    id: `event-${Math.random().toString(36).slice(2)}`,
    nodeId,
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}
