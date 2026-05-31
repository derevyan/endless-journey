import type { EnhancedUserJourney, InteractionEvent } from "@journey/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionEngine } from "../session-engine";
import type { SessionEngineConfig } from "../types";
import {
  anyResponseJourney,
  buttonJourney,
  complexJourney,
  conditionExpressionJourney,
  conditionJourney,
  conditionRulesJourney,
  linearJourney,
  messageWithTimerJourney,
  noStartNodeJourney,
  responseStorageJourney,
  tagActionJourney,
  textResponseJourney,
  variableActionJourney,
  waitJourney,
  webhookJourney,
  webhookMockErrorJourney,
  webhookMockJourney,
} from "./fixtures/journey-configs";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

describe("SessionEngine Integration Tests", () => {
  let adapter: MockMessagingAdapter;
  let collectedEvents: InteractionEvent[];

  beforeEach(() => {
    adapter = new MockMessagingAdapter();
    collectedEvents = [];
  });

  const createSession = (journeyId: string, sessionId = "test-session-1", userId = "test-user-1"): EnhancedUserJourney => ({
    sessionId,
    userId,
    platformUserId: userId,
    journeyId,
    currentNodeId: "",
    status: "active",
    context: {},
    tags: [],
    pendingTimers: [],
    pendingPluginFollowUps: [],
    nodeOutputs: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    hasStarted: false,
    history: [],
  });

  const onEventCallback = (event: InteractionEvent) => {
    collectedEvents.push(event);
  };

  // Helper to wait for engine to reach expected state
  const waitForNode = async (engine: SessionEngine, expectedNodeId: string) => {
    await vi.waitFor(
      () => {
        expect(engine.getSession().currentNodeId).toBe(expectedNodeId);
      },
      { timeout: 1000, interval: 10 }
    );
  };

  describe("Linear Journey Flow", () => {
    it("should execute start → message → end sequence", async () => {
      const session = createSession("linear-journey");
      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Verify messages sent
      const messages = adapter.getSentMessages();
      expect(messages).toHaveLength(3); // start, msg-1, end

      expect(messages[0].message.content).toBe("Welcome to the journey!");
      expect(messages[1].message.content).toBe("This is an informational message.");
      expect(messages[2].message.content).toBe("Journey completed!");

      // Verify session state
      const finalSession = engine.getSession();
      expect(finalSession.currentNodeId).toBe("end");
      expect(finalSession.status).toBe("completed");
      expect(finalSession.completedAt).toBeDefined();

      // Verify event history
      expect(collectedEvents.length).toBeGreaterThan(0);
      expect(collectedEvents.some((e) => e.type === "engine.transition")).toBe(true);
      expect(collectedEvents.some((e) => e.type === "engine.message")).toBe(true);
    });
  });

  describe("Button-Based Navigation", () => {
    it("should handle button click for Option A", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Should be at msg-with-buttons
      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");

      // Clear events and messages from start
      collectedEvents.length = 0;
      adapter.clearMessages();

      // Simulate button click for Option A
      adapter.simulateButtonClick("btn-opt-a");

      // Wait for async handling
      await waitForNode(engine, "end");

      // Journey auto-transitions to end, verify message for option-a was sent
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      // Verify message sent
      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "You selected Option A!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Thank you!")).toBe(true);

      // Verify user click event logged
      expect(collectedEvents.some((e) => e.type === "user.click")).toBe(true);
    });

    it("should handle button click for Option B", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");

      adapter.clearMessages();
      collectedEvents.length = 0;

      // Simulate button click for Option B
      adapter.simulateButtonClick("btn-opt-b");

      await waitForNode(engine, "end");

      // Journey auto-transitions to end, verify message for option-b was sent
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "You selected Option B!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Thank you!")).toBe(true);
    });
  });

  describe("Timer Management", () => {
    it("should schedule timer for wait node", async () => {
      const session = createSession("wait-journey");
      const engine = new SessionEngine(session, waitJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Should be at wait node
      expect(engine.getSession().currentNodeId).toBe("wait");

      // Verify timer was scheduled
      const timers = adapter.getScheduledTimers();
      expect(timers).toHaveLength(1);
      expect(timers[0].delayMs).toBe(2000); // 2 seconds
    });

    it("should transition after timer expires", async () => {
      const session = createSession("wait-journey");
      const engine = new SessionEngine(session, waitJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("wait");

      const timers = adapter.getScheduledTimers();
      const timerId = timers[0].timerId;

      adapter.clearMessages();

      // Simulate timer expiration
      adapter.simulateTimeout(timerId);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Journey auto-transitions to end after timer
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "Wait completed!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Done!")).toBe(true);
    });

    it("should cancel timer when user clicks button", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("msg-with-timer");

      // Timer should be scheduled
      expect(adapter.getTimerCount()).toBe(1);
      const initialTimerId = adapter.getScheduledTimers()[0].timerId;

      adapter.clearMessages();

      // User clicks Continue button
      adapter.simulateButtonClick("btn-continue");

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Journey auto-transitions to end
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      // Timer should be cancelled
      expect(adapter.hasTimer(initialTimerId)).toBe(false);

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "You clicked the button!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Done!")).toBe(true);
    });

    it("should follow timer path when timeout occurs", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("msg-with-timer");

      const timers = adapter.getScheduledTimers();
      const timerId = timers[0].timerId;

      adapter.clearMessages();

      // Simulate timeout
      adapter.simulateTimeout(timerId);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Journey auto-transitions to end
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "Time expired, moving forward.")).toBe(true);
      expect(messages.some((m) => m.message.content === "Done!")).toBe(true);
    });
  });

  describe("Condition Nodes", () => {
    it("should take default branch in condition node", async () => {
      const session = createSession("condition-journey");
      const engine = new SessionEngine(session, conditionJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Condition node auto-transitions to default branch then to end
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "Condition was false!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Done!")).toBe(true);
    });

    it("should evaluate expression and take high branch when score > 50", async () => {
      const session = createSession("condition-expression-journey");
      session.context = { score: 75 }; // Set context with high score
      const engine = new SessionEngine(session, conditionExpressionJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "Your score is high!")).toBe(true);
    });

    it("should evaluate expression and take low branch when score <= 50", async () => {
      const session = createSession("condition-expression-journey");
      session.context = { score: 30 }; // Set context with low score
      const engine = new SessionEngine(session, conditionExpressionJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "Your score is low.")).toBe(true);
    });

    it("should evaluate rules and take premium branch when tier equals premium", async () => {
      const session = createSession("condition-rules-journey");
      session.context = { tier: "premium" }; // Set context with premium tier
      const engine = new SessionEngine(session, conditionRulesJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "Welcome, premium user!")).toBe(true);
    });

    it("should evaluate rules and take standard branch when tier is not premium", async () => {
      const session = createSession("condition-rules-journey");
      session.context = { tier: "basic" }; // Set context with non-premium tier
      const engine = new SessionEngine(session, conditionRulesJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "Welcome, standard user!")).toBe(true);
    });
  });

  describe("Webhook Nodes", () => {
    it("should transition through webhook node", async () => {
      const session = createSession("webhook-journey");
      const engine = new SessionEngine(session, webhookJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Webhook auto-transitions through to end
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "API call completed!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Done!")).toBe(true);
    });

    it("should use mock response and store result in context", async () => {
      const session = createSession("webhook-mock-journey");
      const engine = new SessionEngine(session, webhookMockJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Wait for mock delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      // Verify result was stored in node output
      expect(engine.getSession().nodeOutputs["API_Call"]).toBeDefined();
      expect(engine.getSession().nodeOutputs["API_Call"].data).toBe("John Doe");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "API returned successfully!")).toBe(true);
    });

    it("should handle mock error response and continue", async () => {
      const session = createSession("webhook-mock-error-journey");
      const engine = new SessionEngine(session, webhookMockErrorJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "API call failed, but continuing...")).toBe(true);

      // Verify error was logged
      expect(collectedEvents.some((e) => e.type === "engine.error")).toBe(true);
    });

    it("should substitute template variables in webhook URL", async () => {
      const session = createSession("webhook-mock-journey");
      session.context = { customId: "user-123" };
      const engine = new SessionEngine(session, webhookMockJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Wait for mock delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The webhook should complete successfully even with template substitution
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");
    });
  });

  describe("Event Sourcing", () => {
    it("should log all interaction events", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Clear collected events
      collectedEvents.length = 0;

      // User clicks button
      adapter.simulateButtonClick("btn-opt-a");

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have logged events
      expect(collectedEvents.length).toBeGreaterThan(0);

      // Check for user.click event (buttonId is the button's ID, not text)
      const clickEvent = collectedEvents.find((e) => e.type === "user.click");
      expect(clickEvent).toBeDefined();
      expect(clickEvent?.payload).toHaveProperty("buttonId", "btn-opt-a");

      // Check for engine.transition event
      const transitionEvent = collectedEvents.find((e) => e.type === "engine.transition");
      expect(transitionEvent).toBeDefined();
      expect(transitionEvent?.payload).toHaveProperty("to", "option-a");

      // Check for engine.message event
      const messageEvent = collectedEvents.find((e) => e.type === "engine.message");
      expect(messageEvent).toBeDefined();
    });

    it("should accumulate events in session history", async () => {
      const session = createSession("linear-journey");
      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      const finalSession = engine.getSession();
      expect(finalSession.history.length).toBeGreaterThan(0);

      // Check for engine.transition events
      const transitions = finalSession.history.filter((e: InteractionEvent) => e.type === "engine.transition");
      expect(transitions.length).toBeGreaterThan(0);

      // Check for engine.message events
      const messages = finalSession.history.filter((e: InteractionEvent) => e.type === "engine.message");
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should NOT fallback when multiple edges exist (ambiguous)", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");

      collectedEvents.length = 0;
      adapter.clearMessages();

      // Click a button that doesn't exist (Option C)
      // Engine should NOT fallback because there are multiple buttons (Option A, Option B)
      adapter.simulateButtonClick("Option C");

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should stay on current node
      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");
      expect(engine.getSession().status).toBe("active");

      // Should NOT have sent any new messages
      const messages = adapter.getSentMessages();
      expect(messages.length).toBe(0);
    });
  });

  describe("Complex Journey Flow", () => {
    it("should handle multi-step journey with various node types", async () => {
      const session = createSession("complex-journey");
      const engine = new SessionEngine(session, complexJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Should be at question-1
      expect(engine.getSession().currentNodeId).toBe("question-1");

      adapter.clearMessages();

      // User clicks Yes
      adapter.simulateButtonClick("btn-yes");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be at wait-node after clicking Yes
      expect(engine.getSession().currentNodeId).toBe("wait-node");

      // Timer should be scheduled
      expect(adapter.getTimerCount()).toBeGreaterThan(0);
      const timerId = adapter.getScheduledTimers()[0].timerId;

      adapter.clearMessages();

      // Simulate timer expiration
      adapter.simulateTimeout(timerId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be at question-2 after timer
      expect(engine.getSession().currentNodeId).toBe("question-2");

      adapter.clearMessages();

      // User selects Path A
      adapter.simulateButtonClick("btn-path-a");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Journey auto-transitions to end
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "You chose Path A!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Journey completed!")).toBe(true);
    });

    it("should handle declined path in complex journey", async () => {
      const session = createSession("complex-journey");
      const engine = new SessionEngine(session, complexJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("question-1");

      adapter.clearMessages();

      // User clicks No
      adapter.simulateButtonClick("btn-no");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Journey auto-transitions to end after declined message
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "You declined to continue.")).toBe(true);
      expect(messages.some((m) => m.message.content === "Journey completed!")).toBe(true);
    });
  });

  describe("Response Type and Storage Features", () => {
    it("should store button click in context.userResponse", async () => {
      const session = createSession("response-storage-journey");
      const engine = new SessionEngine(session, responseStorageJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("question");

      // User clicks a button
      adapter.simulateButtonClick("btn-pro");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify context.userResponse is set
      const finalSession = engine.getSession();
      expect(finalSession.context.userResponse).toBeDefined();
      expect(finalSession.context.userResponse).toEqual({
        type: "button",
        value: "btn-pro", // Button ID is stored, not text
      });
    });

    it("should store button click in custom variable via storeResponseAs", async () => {
      const session = createSession("response-storage-journey");
      const engine = new SessionEngine(session, responseStorageJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("question");

      // User clicks a button
      adapter.simulateButtonClick("btn-enterprise");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify custom variable is set (button ID is stored, not text)
      const finalSession = engine.getSession();
      expect(finalSession.context.selectedPlan).toBe("btn-enterprise");
    });

    it("should store text message in context.userResponse", async () => {
      const session = createSession("text-response-journey");
      const engine = new SessionEngine(session, textResponseJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("text-input");

      // User sends a text message
      adapter.simulateMessage("I need help with project management");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify context.userResponse is set
      const finalSession = engine.getSession();
      expect(finalSession.context.userResponse).toBeDefined();
      expect(finalSession.context.userResponse).toEqual({
        type: "text",
        value: "I need help with project management",
        inputType: "text",
      });
    });

    it("should store text message in custom variable via storeResponseAs", async () => {
      const session = createSession("text-response-journey");
      const engine = new SessionEngine(session, textResponseJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("text-input");

      // User sends a text message
      adapter.simulateMessage("My main challenge is team collaboration");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify custom variable is set
      const finalSession = engine.getSession();
      expect(finalSession.context.userChallenge).toBe("My main challenge is team collaboration");
    });

    it("should handle 'any' response type with button click", async () => {
      const session = createSession("any-response-journey");
      const engine = new SessionEngine(session, anyResponseJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("flexible-input");

      // User clicks a button (anyResponseJourney has btn-any-a, btn-any-b)
      adapter.simulateButtonClick("btn-any-a");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify response stored (button ID is stored, not text)
      const finalSession = engine.getSession();
      expect(finalSession.context.userResponse).toEqual({
        type: "button",
        value: "btn-any-a",
      });
      expect(finalSession.context.userChoice).toBe("btn-any-a");

      // Journey should continue
      expect(finalSession.currentNodeId).toBe("end");
    });

    it("should handle 'any' response type with text message", async () => {
      const session = createSession("any-response-journey");
      const engine = new SessionEngine(session, anyResponseJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("flexible-input");

      // User sends a text message instead of clicking button
      adapter.simulateMessage("I prefer something custom");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify response stored
      const finalSession = engine.getSession();
      expect(finalSession.context.userResponse).toEqual({
        type: "text",
        value: "I prefer something custom",
        inputType: "text",
      });
      expect(finalSession.context.userChoice).toBe("I prefer something custom");

      // Journey should continue
      expect(finalSession.currentNodeId).toBe("end");
    });

    it("should auto-continue for responseType 'auto' without user input", async () => {
      const session = createSession("response-storage-journey");
      const engine = new SessionEngine(session, responseStorageJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // User at question node
      expect(engine.getSession().currentNodeId).toBe("question");

      // Click button to move forward
      adapter.simulateButtonClick("btn-basic");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should auto-continue through confirmation (responseType: auto) to end
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      // Verify all messages were sent including auto-continue one
      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content === "You selected a plan!")).toBe(true);
      expect(messages.some((m) => m.message.content === "Done!")).toBe(true);
    });

    it("should maintain context across multiple interactions", async () => {
      const session = createSession("response-storage-journey");
      session.context = { existingData: "preserved" }; // Pre-existing context
      const engine = new SessionEngine(session, responseStorageJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // User clicks button
      adapter.simulateButtonClick("btn-pro");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify existing context is preserved alongside new data (button ID is stored)
      const finalSession = engine.getSession();
      expect(finalSession.context.existingData).toBe("preserved");
      expect(finalSession.context.selectedPlan).toBe("btn-pro");
      expect(finalSession.context.userResponse).toEqual({
        type: "button",
        value: "btn-pro",
      });
    });
  });

  describe("Tag Action Integration", () => {
    it("should invoke tag callback with correct clientId and operations", async () => {
      const tagOperationCalls: Array<{ clientId: string; operations: unknown }> = [];
      const onTagOperation = vi.fn().mockImplementation((clientId, operations) => {
        tagOperationCalls.push({ clientId, operations });
        return Promise.resolve();
      });

      const session = createSession("tag-action-journey", "session-123", "user-456");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onTagOperation,
      };
      const engine = new SessionEngine(session, tagActionJourney, adapter, config);

      await engine.start();

      // Verify tag callback was invoked
      expect(tagOperationCalls.length).toBeGreaterThan(0);

      // Tags should use userId as clientId
      expect(tagOperationCalls.some((c) => c.clientId === "user-456")).toBe(true);

      // Verify operations structure
      expect(tagOperationCalls.some((c) => (c.operations as { add?: string[] }).add?.includes("new_user"))).toBe(true);
    });

    it("should log session.tags events for tag actions", async () => {
      const onTagOperation = vi.fn().mockResolvedValue(undefined);

      const session = createSession("tag-action-journey");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onTagOperation,
      };
      const engine = new SessionEngine(session, tagActionJourney, adapter, config);

      await engine.start();

      // Verify session.tags events were logged
      const tagEvents = collectedEvents.filter((e) => e.type === "session.tags");
      expect(tagEvents.length).toBeGreaterThan(0);
    });

    it("should apply tags to session.tags in fallback mode (no callback)", async () => {
      const session = createSession("tag-action-journey");
      const engine = new SessionEngine(session, tagActionJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Verify tags were updated (fallback mode stores in session.tags)
      const finalSession = engine.getSession();
      expect(finalSession.tags).toContain("finished");
    });
  });

  describe("Variable Action Integration", () => {
    it("should invoke variable callback with correct scope for journey operations", async () => {
      const variableOperationCalls: Array<{ scope: string; scopeId: string; operations: unknown }> = [];
      const onVariableOperation = vi.fn().mockImplementation((scope, scopeId, operations) => {
        variableOperationCalls.push({ scope, scopeId, operations });
        return Promise.resolve();
      });

      const session = createSession("variable-action-journey", "session-123", "user-456");
      session.journeyId = "journey-789";
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onVariableOperation,
        organizationId: "org-111",
      };
      const engine = new SessionEngine(session, variableActionJourney, adapter, config);

      await engine.start();

      // Verify variable callback was invoked for journey operations
      const journeyCalls = variableOperationCalls.filter((c) => c.scope === "journey");
      expect(journeyCalls.length).toBeGreaterThan(0);

      // Journey operations should use journeyId as scopeId
      expect(journeyCalls.some((c) => c.scopeId === "journey-789")).toBe(true);
    });

    it("should invoke variable callback with correct scope for global operations", async () => {
      const variableOperationCalls: Array<{ scope: string; scopeId: string; operations: unknown }> = [];
      const onVariableOperation = vi.fn().mockImplementation((scope, scopeId, operations) => {
        variableOperationCalls.push({ scope, scopeId, operations });
        return Promise.resolve();
      });

      const session = createSession("variable-action-journey", "session-123", "user-456");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onVariableOperation,
        organizationId: "org-111",
      };
      const engine = new SessionEngine(session, variableActionJourney, adapter, config);

      await engine.start();

      // Verify variable callback was invoked for global operations
      const globalCalls = variableOperationCalls.filter((c) => c.scope === "global");
      expect(globalCalls.length).toBeGreaterThan(0);

      // Global operations should use organizationId as scopeId
      expect(globalCalls.some((c) => c.scopeId === "org-111")).toBe(true);
    });

    it("should invoke user variable callback for user operations", async () => {
      const userVariableCalls: Array<{ userId: string; operations: unknown }> = [];
      const onUserVariableOperation = vi.fn().mockImplementation((userId, operations) => {
        userVariableCalls.push({ userId, operations });
        return Promise.resolve();
      });

      const session = createSession("variable-action-journey", "session-123", "user-456");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onUserVariableOperation,
      };
      const engine = new SessionEngine(session, variableActionJourney, adapter, config);

      await engine.start();

      // Verify user variable callback was invoked
      expect(userVariableCalls.length).toBeGreaterThan(0);

      // User operations should use userId
      expect(userVariableCalls.some((c) => c.userId === "user-456")).toBe(true);
    });

    it("should log session.variables events for variable actions", async () => {
      const onVariableOperation = vi.fn().mockResolvedValue(undefined);

      const session = createSession("variable-action-journey");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onVariableOperation,
        organizationId: "org-111",
      };
      const engine = new SessionEngine(session, variableActionJourney, adapter, config);

      await engine.start();

      // Verify session.variables events were logged
      const variableEvents = collectedEvents.filter((e) => e.type === "session.variables");
      expect(variableEvents.length).toBeGreaterThan(0);
    });
  });

  describe("SessionEngine Edge Cases", () => {
    it("should throw error when no start node exists", async () => {
      const session = createSession("no-start-journey");
      const engine = new SessionEngine(session, noStartNodeJourney, adapter, { onEvent: onEventCallback });

      await expect(engine.start()).rejects.toThrow("No start node found in journey");
    });

    it("should throw error when start node ID not found", async () => {
      const session = createSession("linear-journey");
      session.currentNodeId = "nonexistent-node-id";
      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });

      await expect(engine.start()).rejects.toThrow("Start node nonexistent-node-id not found in journey");
    });

    it("should return current session state via getSession()", async () => {
      const session = createSession("linear-journey", "my-session", "my-user");
      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });

      const currentSession = engine.getSession();

      expect(currentSession.sessionId).toBe("my-session");
      expect(currentSession.userId).toBe("my-user");
      expect(currentSession.journeyId).toBe("linear-journey");
    });

    it("should resume journey from existing currentNodeId without re-executing node", async () => {
      const session = createSession("linear-journey");
      session.currentNodeId = "msg-1"; // Already at this node from previous execution
      // Add history to simulate a session that has already executed (resume detection checks history.length)
      session.history = [
        {
          id: "evt_1",
          timestamp: new Date().toISOString(),
          type: "engine.transition",
          nodeId: "start",
          payload: { from: null, to: "start", trigger: "start" },
        },
      ];
      session.hasStarted = true;
      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Resume should NOT re-execute the node - just wait for events
      // This prevents duplicate message sending when engine is recreated for same session
      expect(engine.getSession().currentNodeId).toBe("msg-1");
      expect(engine.getSession().status).toBe("active");

      // No messages should be sent on resume
      const messages = adapter.getSentMessages();
      expect(messages.length).toBe(0);
    });

    it("should handle forceEdgeTransition for valid edge", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("msg-with-timer");

      adapter.clearMessages();

      // Force transition through the timer edge
      await engine.forceEdgeTransition("e3"); // Timer edge to timeout node

      // Should have transitioned to timeout node
      expect(engine.getSession().currentNodeId).toBe("end");
    });

    it("should not transition for invalid edge ID in forceEdgeTransition", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      const currentNodeId = engine.getSession().currentNodeId;

      // Try to force transition with invalid edge
      await engine.forceEdgeTransition("nonexistent-edge");

      // Should not have changed node
      expect(engine.getSession().currentNodeId).toBe(currentNodeId);
    });

    it("should not transition for edge from different node in forceEdgeTransition", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("msg-with-timer");

      // Try to force transition with edge from different node (e4 is from "clicked" node)
      await engine.forceEdgeTransition("e4");

      // Should not have changed node
      expect(engine.getSession().currentNodeId).toBe("msg-with-timer");
    });
  });

  describe("onMessageSent Callback Integration", () => {
    it("should invoke onMessageSent callback with correct parameters when message is sent", async () => {
      const sentMessageCalls: Array<{
        sessionId: string;
        nodeId: string;
        platform: string;
        chatId: string;
        content?: string;
        messages: Array<{ platformMessageId: string; messageType: string }>;
      }> = [];

      const onMessageSent = vi.fn().mockImplementation((params) => {
        sentMessageCalls.push(params);
        return Promise.resolve();
      });

      const session = createSession("linear-journey", "session-123", "user-456");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onMessageSent,
      };
      const engine = new SessionEngine(session, linearJourney, adapter, config);

      await engine.start();

      expect(onMessageSent).toHaveBeenCalled();
      expect(sentMessageCalls.length).toBeGreaterThan(0);

      const call = sentMessageCalls[0];
      expect(call.sessionId).toBe("session-123");
      expect(call.platform).toBe("mock");
      expect(call.chatId).toBe("user-456");
      expect(call.content).toBeDefined();
      expect(call.messages).toHaveLength(1);
      expect(call.messages[0]).toHaveProperty("platformMessageId");
      expect(call.messages[0]).toHaveProperty("messageType");
    });

    it("should call onMessageSent for each message node in journey", async () => {
      const sentMessageCalls: Array<{
        sessionId: string;
        nodeId: string;
        platform: string;
        chatId: string;
        content?: string;
        messages: Array<{ platformMessageId: string; messageType: string }>;
      }> = [];
      const onMessageSent = vi.fn().mockImplementation((params) => {
        sentMessageCalls.push(params);
        return Promise.resolve();
      });

      const session = createSession("linear-journey");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onMessageSent,
      };
      const engine = new SessionEngine(session, linearJourney, adapter, config);

      await engine.start();

      // Should match number of messages sent via adapter
      const adapterMessages = adapter.getSentMessages();
      expect(sentMessageCalls.length).toBe(adapterMessages.length);
    });

    it("should include correct nodeId in callback", async () => {
      const sentMessageCalls: Array<{
        sessionId: string;
        nodeId: string;
        platform: string;
        chatId: string;
        content?: string;
        messages: Array<{ platformMessageId: string; messageType: string }>;
      }> = [];
      const onMessageSent = vi.fn().mockImplementation((params) => {
        sentMessageCalls.push(params);
        return Promise.resolve();
      });

      const session = createSession("linear-journey");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onMessageSent,
      };
      const engine = new SessionEngine(session, linearJourney, adapter, config);

      await engine.start();

      // Each call should have a valid nodeId from the journey
      for (const call of sentMessageCalls) {
        expect(call.nodeId).toBeDefined();
        expect(call.nodeId).not.toBe("");
      }
    });

    it("should include message content matching adapter output", async () => {
      const sentMessageCalls: Array<{
        sessionId: string;
        nodeId: string;
        platform: string;
        chatId: string;
        content?: string;
        messages: Array<{ platformMessageId: string; messageType: string }>;
      }> = [];
      const onMessageSent = vi.fn().mockImplementation((params) => {
        sentMessageCalls.push(params);
        return Promise.resolve();
      });

      const session = createSession("linear-journey");
      const config: SessionEngineConfig = {
        onEvent: onEventCallback,
        onMessageSent,
      };
      const engine = new SessionEngine(session, linearJourney, adapter, config);

      await engine.start();

      // Content in callback should match what adapter sent
      const adapterMessages = adapter.getSentMessages();
      for (let i = 0; i < sentMessageCalls.length; i++) {
        expect(sentMessageCalls[i].content).toBe(adapterMessages[i].message.content);
      }
    });
  });

  describe("Resume vs New Session Edge Cases", () => {
    it("should treat session with empty history as new session and execute start node", async () => {
      // Simulates: User deleted, new session created - history is empty
      const session = createSession("linear-journey");
      session.currentNodeId = "start"; // Points to start node
      session.history = []; // Empty history = new session

      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // Should have executed start node and sent welcome message
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message.content).toBe("Welcome to the journey!");
    });

    it("should treat session with history as resume and NOT re-execute current node", async () => {
      // Simulates: Server restart, engine cache miss for existing session
      const session = createSession("linear-journey");
      session.currentNodeId = "msg-1"; // At message node from previous execution
      session.history = [
        {
          id: "evt_1",
          timestamp: new Date().toISOString(),
          type: "engine.transition",
          nodeId: "start",
          payload: { from: null, to: "start", trigger: "start" },
        },
        {
          id: "evt_2",
          timestamp: new Date().toISOString(),
          type: "engine.transition",
          nodeId: "msg-1",
          payload: { from: "start", to: "msg-1", trigger: "automatic" },
        },
      ];
      session.hasStarted = true;

      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // Should NOT send any messages on resume - just wait for user input
      const messages = adapter.getSentMessages();
      expect(messages.length).toBe(0);
    });

    it("should allow handling events on resumed session", async () => {
      // Simulates: Cache miss, user clicks button on resumed session
      // Use buttonJourney because it waits for user input (unlike linearJourney which auto-completes)
      const session = createSession("button-journey");
      session.currentNodeId = "msg-with-buttons"; // Node that has button response type
      session.history = [
        {
          id: "evt_1",
          timestamp: new Date().toISOString(),
          type: "engine.transition",
          nodeId: "start",
          payload: { from: null, to: "start", trigger: "start" },
        },
      ];
      session.hasStarted = true;

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // No messages on resume - engine just waits
      expect(adapter.getSentMessages().length).toBe(0);

      // Now simulate button click - Option A leads to "option-a" node then auto-transitions to "end"
      adapter.simulateButtonClick("btn-opt-a");

      // Wait for journey to complete (button click → option-a → end)
      await waitForNode(engine, "end");

      // Should have sent messages: option-a content + end content
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.message.content === "You selected Option A!")).toBe(true);
    });

    it("should execute start node for brand new session with no currentNodeId", async () => {
      // Simulates: Completely fresh session
      const session = createSession("linear-journey");
      session.currentNodeId = ""; // Empty = new session, engine will find start
      session.history = [];

      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // Should find and execute start node
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message.content).toBe("Welcome to the journey!");
      expect(engine.getSession().currentNodeId).not.toBeNull();
    });

    it("should detect resume correctly even with single history event", async () => {
      // Edge case: Session has exactly one history event
      const session = createSession("linear-journey");
      session.currentNodeId = "msg-1";
      session.history = [
        {
          id: "evt_1",
          timestamp: new Date().toISOString(),
          type: "engine.transition",
          nodeId: "start",
          payload: { from: null, to: "start", trigger: "start" },
        },
      ];
      session.hasStarted = true;

      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // Even with just one history event, should be treated as resume
      expect(adapter.getSentMessages().length).toBe(0);
    });

    it("should correctly start fresh session after user data deletion", async () => {
      // Simulates the exact bug scenario: user deleted, new session created
      // The session factory creates a new session with currentNodeId and history both empty/null
      // Use buttonJourney which waits for user input (doesn't auto-complete)

      const session = createSession("button-journey");
      // These are the initial values for a newly created session (post user deletion)
      session.currentNodeId = ""; // Empty = new session
      session.history = [];
      session.status = "active";
      session.context = {};

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // User should receive messages (start message + button message)
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);

      // Session should have progressed to the button node and be waiting for input
      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");
      expect(engine.getSession().status).toBe("active");
    });
  });
});
