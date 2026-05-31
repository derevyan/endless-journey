/**
 * Mock Services Factory
 *
 * Provides reusable mock implementations of EngineServices for testing.
 * All mocks use vi.fn() for spy/assertion capabilities.
 *
 * @example
 * ```ts
 * const services = createMockServices();
 * // Override specific mock behavior
 * services.messenger.sendMessage.mockResolvedValue({ success: false, messageIds: [], error: "fail" });
 * ```
 */

import { vi } from "vitest";
import type { EngineServices } from "../../types";

/**
 * Create mock EngineServices for testing
 *
 * All methods are vi.fn() mocks with sensible defaults.
 * Override specific mocks as needed for your test scenario.
 */
export function createMockServices(overrides: Partial<EngineServices> = {}): EngineServices {
  return {
    messenger: {
      sendMessage: vi.fn().mockResolvedValue({ success: true, messageIds: [] }),
      ...overrides.messenger,
    },
    timer: {
      scheduleTimer: vi.fn().mockReturnValue("timer-1"),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn(),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      // Plugin follow-up methods
      schedulePluginFollowUpTimer: vi.fn().mockResolvedValue("plugin-followup-timer-1"),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn(),
      cancelAllPluginFollowUps: vi.fn(),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
      ...overrides.timer,
    },
    eventLogger: {
      logEvent: vi.fn(),
      ...overrides.eventLogger,
    },
    conditionEvaluator: {
      evaluate: vi.fn().mockReturnValue("yes"),
      ...overrides.conditionEvaluator,
    },
    webhookExecutor: {
      execute: vi.fn().mockResolvedValue({ success: true }),
      executeRequest: vi.fn().mockResolvedValue({ statusCode: 200, body: { success: true }, headers: {} }),
      ...overrides.webhookExecutor,
    },
    template: {
      substitute: vi.fn((t: string) => t),
      ...overrides.template,
    },
    tag: {
      executeTagAction: vi.fn().mockResolvedValue(undefined),
      getTags: vi.fn().mockResolvedValue([]),
      ...overrides.tag,
    },
    variable: {
      executeAction: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue({}),
      ...overrides.variable,
    },
    conversationHistory: {
      buildFromEvents: vi.fn().mockReturnValue([]),
      getLastUserMessage: vi.fn().mockReturnValue(""),
      hasRecentUserMessage: vi.fn().mockReturnValue(false),
      ...overrides.conversationHistory,
    },
    mindstate: overrides.mindstate,
    crm: overrides.crm,
    agentWorkflow: overrides.agentWorkflow,
    workflowEventEmitter: overrides.workflowEventEmitter,
    followUpAI: overrides.followUpAI,
    has: overrides.has ?? (() => false),
  };
}

/**
 * Create mock logger for testing
 *
 * All log methods are vi.fn() spies for assertions.
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ReturnType<typeof import("@journey/logger").createLogger>;
}
