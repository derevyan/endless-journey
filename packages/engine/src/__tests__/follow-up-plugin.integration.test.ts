/**
 * Follow-Up Plugin Handler Integration Tests
 *
 * Tests real-world scenarios for the follow-up plugin system.
 * No trivial tests - each test validates behavior that could break in production.
 *
 * With embedded plugins, handlers receive FollowUpPluginData directly (not wrapped in PluginNode).
 * Plugin identification uses parentNodeId + pluginIndex.
 *
 * Run with: pnpm vitest run src/__tests__/follow-up-plugin.integration.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FollowUpPluginData, EnhancedUserJourney, FollowUpSequence, FollowUpAiConfig } from "@journey/schemas";
import { PluginTypes } from "@journey/schemas";
import { createFollowUpPluginHandler, type FollowUpPluginHandler } from "../plugins/follow-up-plugin-handler";
import type { FollowUpAIService, FollowUpAIGenerationResult } from "../types";
import type { PluginExecutionContext, PluginService, PluginFollowUpTimerContext } from "../plugins/types";
import { generatePluginId, parsePluginId } from "../plugins/types";
import { createSessionStateManager, type SessionStateManager } from "../state/session-state-manager";
import type { MessagingAdapter, EngineServices } from "../types";
import { createMockSession } from "./helpers/mock-session";
import { createMockServices, createMockLogger } from "./helpers/mock-services";

// =============================================================================
// TEST FIXTURES
// =============================================================================

// Default test values
const DEFAULT_PARENT_NODE_ID = "message-node-1";
const DEFAULT_PLUGIN_INDEX = 0;

/**
 * Create test plugin data (embedded in node.data.plugins)
 * With embedded plugins, we work with FollowUpPluginData directly, not PluginNode
 */
function createTestPluginData(overrides: Partial<FollowUpPluginData> = {}): FollowUpPluginData {
  return {
    pluginType: PluginTypes.FOLLOWUP,
    enabled: true,
    steps: [
      {
        id: "step-1",
        delay: { minutes: 1 },
        content: "Hey, still thinking about your choice?",
        exitOnTimeout: false,
      },
      {
        id: "step-2",
        delay: { minutes: 5 },
        content: "Last chance! This offer expires soon.",
        exitOnTimeout: false,
      },
    ],
    cancelOnAnyResponse: true,
    ...overrides,
  };
}

function createPluginDataWithButtons(): FollowUpPluginData {
  return createTestPluginData({
    steps: [
      {
        id: "step-1",
        delay: { minutes: 1 },
        content: "Need help deciding?",
        exitOnTimeout: false,
        buttons: [
          { id: "btn-help", text: "Yes, help me", targetNodeId: "help-node" },
          { id: "btn-skip", text: "No thanks", targetNodeId: "" }, // No routing target
        ],
      },
    ],
  });
}

function createPluginDataWithExitPath(): FollowUpPluginData {
  return createTestPluginData({
    steps: [
      { id: "step-1", delay: { minutes: 1 }, content: "First follow-up", exitOnTimeout: false },
      { id: "step-2", delay: { minutes: 2 }, content: "Final follow-up", exitOnTimeout: false },
    ],
    exitPath: { nodeId: "thank-you-node" },
  });
}

function createPluginDataWithExitOnTimeout(): FollowUpPluginData {
  return createTestPluginData({
    steps: [
      { id: "step-1", delay: { minutes: 1 }, content: "First follow-up", exitOnTimeout: false },
      { id: "step-2", delay: { minutes: 2 }, content: "Early exit", exitOnTimeout: true },
      { id: "step-3", delay: { minutes: 3 }, content: "Never reached", exitOnTimeout: false },
    ],
    exitPath: { nodeId: "timeout-exit-node" },
  });
}

/**
 * Create plugin data with AI generation enabled.
 * The content field becomes AI instructions, not the actual message.
 */
function createPluginDataWithAi(options?: {
  aiConfig?: FollowUpAiConfig;
  fallbackContent?: string;
}): FollowUpPluginData {
  return createTestPluginData({
    steps: [
      {
        id: "step-1",
        delay: { minutes: 1 },
        content: "Send a friendly reminder about their order",  // AI instructions
        fallbackContent: options?.fallbackContent,
        exitOnTimeout: false,
      },
    ],
    ai: options?.aiConfig ?? { enabled: true, includeUserProfile: true, includeNodeContext: true, includeSessionContext: false },
  });
}

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock FollowUpAIService for AI generation tests
const mockFollowUpAI: FollowUpAIService = {
  generateContent: vi.fn(),
};

interface TestContext {
  handler: FollowUpPluginHandler;
  session: EnhancedUserJourney;
  stateManager: SessionStateManager;
  adapter: MessagingAdapter;
  services: EngineServices;
  log: ReturnType<typeof createMockLogger>;
  pluginService: PluginService;
  timerIdCounter: number;
}

function createTestContext(): TestContext {
  let timerIdCounter = 0;

  const session = createMockSession({
    userId: "user-123",
    currentNodeId: "message-node-1",
  });

  const services = createMockServices({
    timer: {
      scheduleTimer: vi.fn().mockImplementation(() => `timer-${++timerIdCounter}`),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn(),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      // schedulePluginFollowUpTimer simulates the real implementation:
      // - Returns a timer ID
      // - Adds to session.pendingPluginFollowUps (just like the real timer service does)
      schedulePluginFollowUpTimer: vi.fn().mockImplementation(
        (pluginId: string, parentNodeId: string, stepIndex: number, delayMs: number, sequence: FollowUpSequence, timerType: "send" | "response" = "send") => {
          const timerId = `timer-${++timerIdCounter}`;
          // Extract pluginIndex from synthetic pluginId format: {parentNodeId}-plugin-{index}
          const parsed = parsePluginId(pluginId);
          const pluginIndex = parsed?.pluginIndex ?? 0;
          session.pendingPluginFollowUps = session.pendingPluginFollowUps || [];
          session.pendingPluginFollowUps.push({
            timerId,
            pluginId,
            parentNodeId,
            pluginIndex,
            stepIndex,
            sequence,
            triggersAt: new Date(Date.now() + delayMs).toISOString(),
            timerType,
          });
          return Promise.resolve(timerId);
        }
      ),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn(),
      cancelAllPluginFollowUps: vi.fn(),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    },
    // Include the mock FollowUpAI service for AI generation tests
    followUpAI: mockFollowUpAI,
  });

  const adapter: MessagingAdapter = {
    adapterType: "mock",
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn(),
    scheduleTimer: vi.fn().mockImplementation(() => Promise.resolve(`adapter-timer-${++timerIdCounter}`)),
    cancelTimer: vi.fn().mockResolvedValue(true),
  };

  const log = createMockLogger();

  // Plugin service that reads from session.pendingPluginFollowUps
  const pluginService: PluginService = {
    getPluginsForNode: vi.fn().mockReturnValue([]),
    getPluginFollowUpContext: vi.fn().mockImplementation((timerId: string) => {
      const pending = session.pendingPluginFollowUps || [];
      const found = pending.find((p) => p.timerId === timerId);
      if (!found) return undefined;
      return {
        pluginId: found.pluginId,
        parentNodeId: found.parentNodeId,
        pluginIndex: found.pluginIndex,
        stepIndex: found.stepIndex,
        sequence: found.sequence,
        timerType: found.timerType,
      } as PluginFollowUpTimerContext;
    }),
    hasPluginFollowUp: vi.fn().mockImplementation((timerId: string) => {
      const pending = session.pendingPluginFollowUps || [];
      return pending.some((p) => p.timerId === timerId);
    }),
  };

  const stateManager = createSessionStateManager(session);

  return {
    handler: createFollowUpPluginHandler(),
    session,
    stateManager,
    adapter,
    services,
    log,
    pluginService,
    timerIdCounter,
  };
}

function createExecutionContext(ctx: TestContext): PluginExecutionContext {
  return {
    session: ctx.session,
    stateManager: ctx.stateManager,
    adapter: ctx.adapter,
    services: ctx.services,
    log: ctx.log,
    pluginService: ctx.pluginService,
    organizationId: "test-org", // Required for AI usage tracking
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("FollowUpPluginHandler Integration", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  // ---------------------------------------------------------------------------
  // 1. Multi-Step Sequence Fires in Order
  // ---------------------------------------------------------------------------
  describe("sequence execution", () => {
    it("fires all steps in order with correct delays and content", async () => {
      const pluginData = createTestPluginData();
      const executionContext = createExecutionContext(ctx);
      const syntheticPluginId = generatePluginId(DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX);

      // Step 1: Parent executes - schedules first timer
      const result = await ctx.handler.onParentExecute(
        pluginData,
        DEFAULT_PARENT_NODE_ID,
        DEFAULT_PLUGIN_INDEX,
        executionContext
      );

      expect(result).toEqual({ action: "scheduled", timerId: "timer-1" });
      expect(ctx.services.timer.schedulePluginFollowUpTimer).toHaveBeenCalledWith(
        syntheticPluginId,
        DEFAULT_PARENT_NODE_ID,
        0,
        60000,
        expect.objectContaining({ enabled: true, steps: expect.any(Array) })
      );
      expect(ctx.session.pendingPluginFollowUps).toHaveLength(1);
      expect(ctx.session.pendingPluginFollowUps[0]).toMatchObject({
        timerId: "timer-1",
        pluginId: syntheticPluginId,
        stepIndex: 0,
      });

      // Step 2: First timer fires - sends message, schedules next
      const timeoutResult1 = await ctx.handler.onTimeout!("timer-1", executionContext);

      expect(timeoutResult1).toEqual({ action: "continue" });
      // Now uses messenger service instead of adapter directly
      expect(ctx.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Hey, still thinking about your choice?",
        undefined, // no buttons
        undefined  // no media
      );
      expect(ctx.services.timer.schedulePluginFollowUpTimer).toHaveBeenCalledWith(
        syntheticPluginId,
        DEFAULT_PARENT_NODE_ID,
        1,
        300000,
        expect.objectContaining({ enabled: true, steps: expect.any(Array) })
      );
      expect(ctx.session.pendingPluginFollowUps).toHaveLength(1);
      expect(ctx.session.pendingPluginFollowUps[0].stepIndex).toBe(1);

      // Step 3: Second timer fires - sends final message, no more scheduled
      const timeoutResult2 = await ctx.handler.onTimeout!("timer-2", executionContext);

      expect(timeoutResult2).toEqual({ action: "continue" });
      // Now uses messenger service instead of adapter directly
      expect(ctx.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Last chance! This offer expires soon.",
        undefined, // no buttons
        undefined  // no media
      );
      expect(ctx.session.pendingPluginFollowUps).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Button Click Routes to Target Node
  // ---------------------------------------------------------------------------
  describe("button routing", () => {
    it("sets activeButtons with source=plugin for unified routing", async () => {
      const pluginData = createPluginDataWithButtons();
      const executionContext = createExecutionContext(ctx);

      // Schedule and fire the step with buttons
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Verify message sent with buttons via messenger service
      expect(ctx.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Need help deciding?",
        [
          { id: "btn-help", text: "Yes, help me" },
          { id: "btn-skip", text: "No thanks" },
        ],
        undefined // no media
      );

      // Verify activeButtons set for routing (only buttons with targetNodeId)
      expect(ctx.session.activeButtons).toEqual([
        {
          id: "btn-help",
          text: "Yes, help me",
          targetNodeId: "help-node",
          source: "plugin",
        },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Sequence Completes with Exit Path Transition (Two-Stage Process)
  // ---------------------------------------------------------------------------
  describe("sequence completion", () => {
    it("schedules response timeout after last step, then transitions when response times out", async () => {
      const pluginData = createPluginDataWithExitPath();
      const executionContext = createExecutionContext(ctx);

      // Schedule and fire both send steps
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Last send step fires - should schedule response timer instead of immediate exit
      const afterLastSend = await ctx.handler.onTimeout!("timer-2", executionContext);
      expect(afterLastSend).toEqual({ action: "continue" });

      // Should have scheduled a response timer (timer-3)
      expect(ctx.services.timer.schedulePluginFollowUpTimer).toHaveBeenLastCalledWith(
        expect.anything(),
        DEFAULT_PARENT_NODE_ID,
        1, // stepIndex
        59000, // default 59 second timeout
        expect.anything(),
        "response" // response timer type
      );
      expect(ctx.session.pendingPluginFollowUps).toHaveLength(1);
      expect(ctx.session.pendingPluginFollowUps[0].timerType).toBe("response");

      // Response timer fires - NOW transitions to exit path
      const finalResult = await ctx.handler.onTimeout!("timer-3", executionContext);
      expect(finalResult).toEqual({
        action: "transition",
        targetNodeId: "thank-you-node",
        trigger: "followup_plugin_exit",
      });
      expect(ctx.session.pendingPluginFollowUps).toHaveLength(0);
    });

    // ---------------------------------------------------------------------------
    // 6. exitOnTimeout Mid-Sequence (Two-Stage Process)
    // ---------------------------------------------------------------------------
    it("schedules response timeout when step has exitOnTimeout, then transitions", async () => {
      const pluginData = createPluginDataWithExitOnTimeout();
      const executionContext = createExecutionContext(ctx);
      const syntheticPluginId = generatePluginId(DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX);

      // Schedule and fire first step (no exit)
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Second step fires with exitOnTimeout - should schedule response timer
      const afterExitOnTimeout = await ctx.handler.onTimeout!("timer-2", executionContext);
      expect(afterExitOnTimeout).toEqual({ action: "continue" });

      // Should have scheduled a response timer, NOT step 3
      expect(ctx.services.timer.schedulePluginFollowUpTimer).toHaveBeenLastCalledWith(
        syntheticPluginId,
        DEFAULT_PARENT_NODE_ID,
        1, // stepIndex (exit on step 2 = index 1)
        59000, // default 59 second timeout
        expect.anything(),
        "response" // response timer type
      );

      // Response timer fires - NOW transitions
      const earlyExitResult = await ctx.handler.onTimeout!("timer-3", executionContext);
      expect(earlyExitResult).toEqual({
        action: "transition",
        targetNodeId: "timeout-exit-node",
        trigger: "followup_plugin_exit",
      });

      // Step 3 should never be scheduled (only steps 0, 1, and response timer)
      expect(ctx.services.timer.schedulePluginFollowUpTimer).toHaveBeenCalledTimes(3);
      expect(ctx.services.timer.schedulePluginFollowUpTimer).not.toHaveBeenCalledWith(
        syntheticPluginId,
        DEFAULT_PARENT_NODE_ID,
        2, // step 3
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  // ---------------------------------------------------------------------------
  // AI Generation Tests
  // Tests the 3 decision branches in AI mode:
  // 1. AI success → uses AI response
  // 2. AI failure with fallbackContent → uses fallbackContent
  // 3. AI failure without fallbackContent → uses step.content
  // ---------------------------------------------------------------------------
  describe("AI generation", () => {
    beforeEach(() => {
      // Reset AI service mock between tests
      vi.mocked(mockFollowUpAI.generateContent).mockReset();
    });

    it("uses AI-generated content when ai.enabled and AI service succeeds", async () => {
      // Given: plugin with ai.enabled = true with customContext
      const pluginData = createPluginDataWithAi({
        aiConfig: { enabled: true, includeUserProfile: true, includeNodeContext: true, includeSessionContext: false, customContext: "Customer tier: VIP" },
        fallbackContent: "Your order is processing!",
      });
      const executionContext = createExecutionContext(ctx);

      // Mock AI service to return AI-generated message
      vi.mocked(mockFollowUpAI.generateContent).mockResolvedValueOnce({
        content: "Hey Sarah! 👋 Just checking in - your order is on the way!",
        modelUsed: "gemini-3-flash",
      });

      // When: parent executes and timer fires
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Then: AI-generated message is sent (not step.content or fallbackContent)
      expect(ctx.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Hey Sarah! 👋 Just checking in - your order is on the way!",
        undefined,
        undefined
      );
      expect(mockFollowUpAI.generateContent).toHaveBeenCalledOnce();

      // Validate AI service was called with proper architecture:
      // - System prompt = default persona + context (NOT task instructions)
      // - User message = task instructions (step.content)
      const [systemPrompt, userMessage, config] = vi.mocked(mockFollowUpAI.generateContent).mock.calls[0];
      expect(systemPrompt).toContain("notification assistant"); // Default persona
      expect(systemPrompt).toContain("Customer tier: VIP"); // Custom context included
      expect(systemPrompt).not.toContain("Send a friendly reminder"); // Task NOT in system prompt
      expect(userMessage).toBe("Send a friendly reminder about their order"); // Task instructions as user message
      expect(config?.organizationId).toBe("test-org"); // Usage tracking enabled
    });

    it("uses fallbackContent when AI fails and fallback exists", async () => {
      // Given: plugin with ai.enabled = true AND fallbackContent set
      const pluginData = createPluginDataWithAi({
        aiConfig: { enabled: true, includeUserProfile: true, includeNodeContext: true, includeSessionContext: false },
        fallbackContent: "Your order is processing!",  // Human-written fallback
      });
      const executionContext = createExecutionContext(ctx);

      // Mock AI service to throw error
      vi.mocked(mockFollowUpAI.generateContent).mockRejectedValueOnce(new Error("LLM rate limited"));

      // When: parent executes and timer fires
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Then: fallbackContent is used (not step.content)
      expect(ctx.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Your order is processing!",
        undefined,
        undefined
      );
    });

    it("uses step.content as last resort when AI fails and no fallback", async () => {
      // Given: plugin with ai.enabled = true but NO fallbackContent
      const pluginData = createPluginDataWithAi({
        aiConfig: { enabled: true, includeUserProfile: true, includeNodeContext: true, includeSessionContext: false },
        // No fallbackContent - step.content becomes the fallback
      });
      const executionContext = createExecutionContext(ctx);

      // Mock AI service to throw error
      vi.mocked(mockFollowUpAI.generateContent).mockRejectedValueOnce(new Error("LLM unavailable"));

      // When: parent executes and timer fires
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Then: step.content (the AI instructions) is used as last resort
      expect(ctx.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Send a friendly reminder about their order",
        undefined,
        undefined
      );
    });

    it("uses fallbackContent when AI service is not injected (graceful degradation)", async () => {
      // Given: plugin with ai.enabled = true AND fallbackContent set
      // BUT FollowUpAI service is NOT available (undefined)
      const pluginData = createPluginDataWithAi({
        aiConfig: { enabled: true, includeUserProfile: true, includeNodeContext: true, includeSessionContext: false },
        fallbackContent: "Your order is on the way!",
      });

      // Create context WITHOUT followUpAI service (simulates engine without @journey/llm)
      const servicesWithoutAI = createMockServices({
        timer: ctx.services.timer,
        followUpAI: undefined, // Service not available
      });
      const executionContext: PluginExecutionContext = {
        session: ctx.session,
        stateManager: ctx.stateManager,
        adapter: ctx.adapter,
        services: servicesWithoutAI,
        log: ctx.log,
        pluginService: ctx.pluginService,
        organizationId: "test-org",
      };

      // When: parent executes and timer fires
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Then: fallbackContent is used (AI service not called since not available)
      expect(servicesWithoutAI.messenger.sendMessage).toHaveBeenCalledWith(
        "Your order is on the way!",
        undefined,
        undefined
      );
      // AI service should not have been called since it's not injected
      expect(mockFollowUpAI.generateContent).not.toHaveBeenCalled();
    });

    it("uses step.content when AI service not injected and no fallbackContent", async () => {
      // Given: plugin with ai.enabled but service not available and no fallback
      const pluginData = createPluginDataWithAi({
        aiConfig: { enabled: true, includeUserProfile: true, includeNodeContext: true, includeSessionContext: false },
        // No fallbackContent
      });

      // Create context WITHOUT followUpAI service
      const servicesWithoutAI = createMockServices({
        timer: ctx.services.timer,
        followUpAI: undefined,
      });
      const executionContext: PluginExecutionContext = {
        session: ctx.session,
        stateManager: ctx.stateManager,
        adapter: ctx.adapter,
        services: servicesWithoutAI,
        log: ctx.log,
        pluginService: ctx.pluginService,
        organizationId: "test-org",
      };

      // When: parent executes and timer fires
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Then: step.content is used as last resort
      expect(servicesWithoutAI.messenger.sendMessage).toHaveBeenCalledWith(
        "Send a friendly reminder about their order",
        undefined,
        undefined
      );
    });

    it("uses parent node's output for context, not most recent node by timestamp", async () => {
      // Given: plugin with ai.enabled and includeNodeContext = true
      const pluginData = createPluginDataWithAi({
        aiConfig: { enabled: true, includeUserProfile: false, includeNodeContext: true, includeSessionContext: false },
      });

      // Set up nodeOutputs with multiple entries - parent node has OLDER timestamp
      ctx.session.nodeOutputs = {
        // Parent node output (message-node-1) - OLDER timestamp
        "Parent_Message": {
          nodeId: DEFAULT_PARENT_NODE_ID, // "message-node-1"
          nodeLabel: "Welcome Message",
          nodeType: "message",
          executedAt: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
          data: { selectedButtonLabel: "Learn More" },
        },
        // Another node output - NEWER timestamp (should NOT be used)
        "Other_Node": {
          nodeId: "other-node-99",
          nodeLabel: "Webhook Handler",
          nodeType: "webhook",
          executedAt: new Date().toISOString(), // Now (most recent)
          data: { apiResponse: "irrelevant webhook data" },
        },
      };

      const executionContext = createExecutionContext(ctx);

      // Mock AI to capture what context it receives
      vi.mocked(mockFollowUpAI.generateContent).mockResolvedValueOnce({
        content: "Generated follow-up message",
        modelUsed: "gemini-3-flash",
      });

      // When: parent executes and timer fires
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Then: AI should receive parent node's context, not the most recent
      expect(mockFollowUpAI.generateContent).toHaveBeenCalledOnce();
      const [systemPrompt] = vi.mocked(mockFollowUpAI.generateContent).mock.calls[0];

      // Parent node context should be included
      expect(systemPrompt).toContain("Welcome Message"); // Parent node label
      expect(systemPrompt).toContain("Learn More"); // Parent node data

      // Other node context should NOT be included
      expect(systemPrompt).not.toContain("Webhook Handler");
      expect(systemPrompt).not.toContain("irrelevant webhook data");
    });

    it("falls back to most recent output when parent node has no output stored", async () => {
      // Given: plugin with ai.enabled and includeNodeContext = true
      // BUT parent node has no output in nodeOutputs
      const pluginData = createPluginDataWithAi({
        aiConfig: { enabled: true, includeUserProfile: false, includeNodeContext: true, includeSessionContext: false },
      });

      // Set up nodeOutputs WITHOUT parent node - only other nodes exist
      ctx.session.nodeOutputs = {
        "Other_Node_A": {
          nodeId: "other-node-1",
          nodeLabel: "Previous Agent",
          nodeType: "agent",
          executedAt: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
          data: { conversation: "Some previous conversation" },
        },
        "Other_Node_B": {
          nodeId: "other-node-2",
          nodeLabel: "Most Recent Node",
          nodeType: "message",
          executedAt: new Date().toISOString(), // Now (most recent)
          data: { selectedButtonLabel: "Fallback Data" },
        },
      };

      const executionContext = createExecutionContext(ctx);

      // Mock AI
      vi.mocked(mockFollowUpAI.generateContent).mockResolvedValueOnce({
        content: "Generated message with fallback context",
        modelUsed: "gemini-3-flash",
      });

      // When: parent executes and timer fires
      await ctx.handler.onParentExecute(pluginData, DEFAULT_PARENT_NODE_ID, DEFAULT_PLUGIN_INDEX, executionContext);
      await ctx.handler.onTimeout!("timer-1", executionContext);

      // Then: AI should receive most recent node's context as fallback
      expect(mockFollowUpAI.generateContent).toHaveBeenCalledOnce();
      const [systemPrompt] = vi.mocked(mockFollowUpAI.generateContent).mock.calls[0];

      // Most recent node context should be used as fallback
      expect(systemPrompt).toContain("Most Recent Node");
      expect(systemPrompt).toContain("Fallback Data");
    });
  });
});
