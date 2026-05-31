/**
 * Questionnaire Integration Tests
 *
 * End-to-end tests for questionnaire node functionality:
 * - Basic questionnaire flow (intro → questions → completion → transition)
 * - Text and button responses
 * - Back navigation
 * - Timeout handling
 * - Skip conditions
 * - Response storage (per-question and consolidated)
 * - Question shuffling
 *
 * Run with: pnpm test --filter @journey/engine -- questionnaire.integration
 */

import type { EnhancedUserJourney, InteractionEvent, QuestionnaireState } from "@journey/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionEngine } from "../session-engine";
import {
  questionnaireJourney,
  questionnaireShuffleJourney,
  questionnaireWithBackJourney,
  questionnaireWithSkipJourney,
  questionnaireWithTimeoutJourney,
} from "./fixtures/journey-configs";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

describe("Questionnaire Integration Tests", () => {
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
      { timeout: 2000, interval: 10 }
    );
  };

  // Helper to get questionnaire state from session
  // Uses the __state_${nodeId} key pattern that createStateMethods uses
  const getQuestionnaireState = (engine: SessionEngine, nodeId: string): QuestionnaireState | undefined => {
    const stateKey = `__state_${nodeId}`;
    const output = engine.getSession().nodeOutputs?.[stateKey];
    return output?.data as QuestionnaireState | undefined;
  };

  describe("Basic Questionnaire Flow", () => {
    it("should execute start → questionnaire (3 questions) → end sequence", async () => {
      const session = createSession("questionnaire-journey");
      const engine = new SessionEngine(session, questionnaireJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Should be at questionnaire node waiting for first question response
      expect(engine.getSession().currentNodeId).toBe("questionnaire");

      // Verify messages sent: start welcome + intro + first question
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // Check intro message was sent
      expect(messages.some((m) => m.message.content?.includes("Welcome to our customer survey"))).toBe(true);

      // Check first question was sent
      expect(messages.some((m) => m.message.content?.includes("What is your name?"))).toBe(true);

      // Clear messages before simulating responses
      adapter.clearMessages();

      // Answer Q1 (text response)
      adapter.simulateMessage("John Doe");
      await vi.waitFor(() => {
        const msgs = adapter.getSentMessages();
        return msgs.some((m) => m.message.content?.includes("favorite color"));
      }, { timeout: 1000 });

      // Answer Q2 (button response)
      adapter.clearMessages();
      adapter.simulateButtonClick("btn-blue");
      await vi.waitFor(() => {
        const msgs = adapter.getSentMessages();
        return msgs.some((m) => m.message.content?.includes("rate our service"));
      }, { timeout: 1000 });

      // Answer Q3 (button response)
      adapter.clearMessages();
      adapter.simulateButtonClick("btn-great");

      // Wait for completion and transition to end
      await waitForNode(engine, "end");

      // Verify completion message was sent
      const allMessages = adapter.getSentMessages();
      expect(allMessages.some((m) => m.message.content?.includes("Thank you for completing"))).toBe(true);

      // Verify session completed
      expect(engine.getSession().status).toBe("completed");
    });

    it("should store responses in session context using storeResponseAs", async () => {
      const session = createSession("questionnaire-journey");
      const engine = new SessionEngine(session, questionnaireJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Answer Q1 (text response - stored as userName)
      // Use await on simulateMessage to ensure the handler completes
      await adapter.simulateMessage("Alice");
      // Give state time to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Text responses are stored directly
      expect(engine.getSession().context?.userName).toBe("Alice");

      // Answer Q2 (button - stored as favoriteColor with button ID)
      await adapter.simulateButtonClick("btn-red");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Button responses store the button ID
      expect(engine.getSession().context?.favoriteColor).toBe("btn-red");

      // Answer Q3
      await adapter.simulateButtonClick("btn-good");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(engine.getSession().context?.rating).toBe("btn-good");
      expect(engine.getSession().currentNodeId).toBe("end");
    });

    it("should store all responses using storeAllAs", async () => {
      const session = createSession("questionnaire-journey");
      const engine = new SessionEngine(session, questionnaireJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Answer all questions
      adapter.simulateMessage("Bob");
      await vi.waitFor(() => adapter.getSentMessages().some((m) => m.message.content?.includes("favorite color")), { timeout: 1000 });

      adapter.simulateButtonClick("btn-green");
      await vi.waitFor(() => adapter.getSentMessages().some((m) => m.message.content?.includes("rate our service")), { timeout: 1000 });

      adapter.simulateButtonClick("btn-poor");
      await waitForNode(engine, "end");

      // Verify consolidated responses stored as node output (storeAllAs key)
      const surveyResponses = engine.getSession().nodeOutputs?.surveyResponses?.data as Record<
        string,
        { answer: string; answerLabel?: string; questionText: string; answeredAt: string }
      >;
      expect(surveyResponses).toBeDefined();
      expect(surveyResponses.q1.answer).toBe("Bob");
      expect(surveyResponses.q2.answer).toBe("btn-green");
      expect(surveyResponses.q2.answerLabel).toBe("Green"); // Button label
      expect(surveyResponses.q3.answer).toBe("btn-poor");
      expect(surveyResponses.q3.answerLabel).toBe("Poor"); // Button label
    });
  });

  describe("Back Navigation", () => {
    it("should allow going back to previous questions when allowBack is true", async () => {
      const session = createSession("questionnaire-back-journey");
      const engine = new SessionEngine(session, questionnaireWithBackJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Answer Q1
      await adapter.simulateButtonClick("btn-q1-a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Get state - should be on Q2
      let state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.currentIndex).toBe(1);
      expect(state?.responses).toHaveLength(1);

      // Verify Q2 message was sent with back button
      // The message format uses 'label' not 'text' for buttons in JourneyMessage
      const q2Msg = adapter.getSentMessages().find((m) => m.message.content?.includes("Question 2"));
      expect(q2Msg).toBeDefined();
      expect(q2Msg?.message.buttons).toBeDefined();
      // Back button should be first (id: "__back__", label: "← Back")
      expect(q2Msg?.message.buttons?.[0]?.id).toBe("__back__");

      // Go back to Q1
      adapter.clearMessages();
      await adapter.simulateButtonClick("__back__");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify state updated - back on Q1
      state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.currentIndex).toBe(0);
      expect(state?.responses).toHaveLength(0); // Response removed

      // Answer Q1 again with different choice
      adapter.clearMessages();
      await adapter.simulateButtonClick("btn-q1-b");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Complete questionnaire
      await adapter.simulateButtonClick("btn-q2-a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      await adapter.simulateButtonClick("btn-q3-a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      await waitForNode(engine, "end");

      // Verify final state has correct responses
      state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.responses[0].value).toBe("btn-q1-b"); // Changed answer
    });

    it("should not go back past the first question", async () => {
      const session = createSession("questionnaire-back-journey");
      const engine = new SessionEngine(session, questionnaireWithBackJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // On first question, back button shouldn't be shown
      const state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.currentIndex).toBe(0);

      // Q1 message should NOT have back button (we're on first question)
      const q1Msg = adapter.getSentMessages().find((m) => m.message.content?.includes("Question 1"));
      expect(q1Msg).toBeDefined();
      // Check that first button is NOT a back button
      expect(q1Msg?.message.buttons?.[0]?.id).not.toBe("__back__");

      // Complete the questionnaire normally
      await adapter.simulateButtonClick("btn-q1-a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      await adapter.simulateButtonClick("btn-q2-a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      await adapter.simulateButtonClick("btn-q3-a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(engine.getSession().currentNodeId).toBe("end");
    });
  });

  describe("Timeout Handling", () => {
    it("should schedule timeout timer on questionnaire start", async () => {
      const session = createSession("questionnaire-timeout-journey");
      const engine = new SessionEngine(session, questionnaireWithTimeoutJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Verify timer was scheduled
      const timers = adapter.getScheduledTimers();
      expect(timers.length).toBeGreaterThan(0);

      // Timer should be for 60 seconds (60000 ms)
      const timer = timers[0];
      expect(timer.delayMs).toBe(60000);

      // State should have timerId
      const state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.timerId).toBeDefined();
    });

    it("should route to timeout handler when timeout fires", async () => {
      const session = createSession("questionnaire-timeout-journey");
      const engine = new SessionEngine(session, questionnaireWithTimeoutJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Verify at questionnaire node
      expect(engine.getSession().currentNodeId).toBe("questionnaire");

      // Get timer ID before any user action
      const timers = adapter.getScheduledTimers();
      expect(timers.length).toBeGreaterThan(0);
      const timerId = timers[0].timerId;

      // Clear messages to isolate timeout messages
      adapter.clearMessages();

      // Simulate timeout firing (without answering any questions)
      await adapter.simulateTimeout(timerId);
      // Give time for transition to timeout-handler and its message to be sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have transitioned to timeout-handler which sends the message
      // Then auto-transitions to end
      const messages = adapter.getSentMessages();

      // Check that we transitioned - either to timeout-handler or end
      const currentNode = engine.getSession().currentNodeId;
      expect(["timeout-handler", "end"]).toContain(currentNode);

      // The timeout handler message should have been sent
      expect(messages.some((m) => m.message.content?.includes("time is up"))).toBe(true);
    });

    it("should cancel timeout timer when questionnaire completes normally", async () => {
      const session = createSession("questionnaire-timeout-journey");
      const engine = new SessionEngine(session, questionnaireWithTimeoutJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Get timer ID before completing
      const timersBefore = adapter.getScheduledTimers();
      expect(timersBefore.length).toBeGreaterThan(0);
      const timerId = timersBefore[0].timerId;

      // Complete questionnaire
      await adapter.simulateButtonClick("btn-q1-yes");
      await new Promise((resolve) => setTimeout(resolve, 50));

      await adapter.simulateButtonClick("btn-q2-yes");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(engine.getSession().currentNodeId).toBe("end");

      // Timer should have been cancelled (removed from scheduled timers)
      expect(adapter.hasTimer(timerId)).toBe(false);
    });
  });

  describe("Skip Conditions", () => {
    it("should skip question when skipIf condition evaluates to true", async () => {
      const session = createSession("questionnaire-skip-journey");
      const engine = new SessionEngine(session, questionnaireWithSkipJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Answer Q1 "Do you have a team?" with "No" - button ID is btn-no
      await adapter.simulateButtonClick("btn-no");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify Q2 was skipped - skipIf condition "hasTeam == 'btn-no'" should be true
      const state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.skipped).toContain("q2");
      expect(state?.currentIndex).toBe(2); // Skipped from index 1 (Q2) to 2 (Q3)

      // Should be showing Q3 (budget) now
      const q3Msg = adapter.getSentMessages().find((m) => m.message.content?.includes("budget"));
      expect(q3Msg).toBeDefined();

      // Complete questionnaire
      await adapter.simulateButtonClick("btn-high");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(engine.getSession().currentNodeId).toBe("end");

      // Verify only 2 responses (Q1 and Q3)
      const finalState = getQuestionnaireState(engine, "questionnaire");
      expect(finalState?.responses).toHaveLength(2);
    });

    it("should not skip question when skipIf condition evaluates to false", async () => {
      const session = createSession("questionnaire-skip-journey");
      const engine = new SessionEngine(session, questionnaireWithSkipJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Answer Q1 "Do you have a team?" with "Yes"
      await adapter.simulateButtonClick("btn-yes");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify Q2 not skipped
      const state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.skipped).not.toContain("q2");
      expect(state?.currentIndex).toBe(1);

      // Should show Q2 (team size) - not skipped
      const q2Msg = adapter.getSentMessages().find((m) => m.message.content?.includes("large is your team"));
      expect(q2Msg).toBeDefined();

      // Complete questionnaire
      await adapter.simulateButtonClick("btn-medium");
      await new Promise((resolve) => setTimeout(resolve, 50));

      await adapter.simulateButtonClick("btn-low");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(engine.getSession().currentNodeId).toBe("end");

      // Verify 3 responses
      const finalState = getQuestionnaireState(engine, "questionnaire");
      expect(finalState?.responses).toHaveLength(3);
    });
  });

  describe("Question Shuffling", () => {
    it("should shuffle question order when shuffle is enabled", async () => {
      // Run multiple times to statistically verify shuffling
      const orders: string[][] = [];

      for (let i = 0; i < 10; i++) {
        const session = createSession("questionnaire-shuffle-journey", `session-${i}`);
        const engine = new SessionEngine(session, questionnaireShuffleJourney, adapter, { onEvent: onEventCallback });

        await engine.start();

        const state = getQuestionnaireState(engine, "questionnaire");
        orders.push([...state!.questionOrder]);

        // Clean up for next iteration
        adapter.clearMessages();
        adapter.clearTimers();
      }

      // Check that at least some orders are different (shuffled)
      // With 5 questions and 10 runs, probability of all being identical is extremely low
      const uniqueOrders = new Set(orders.map((o) => o.join(",")));

      // Should have at least 2 different orders (likely more)
      // Note: There's a small probability this could fail randomly, but it's very unlikely
      expect(uniqueOrders.size).toBeGreaterThan(1);
    });

    it("should complete questionnaire with shuffled questions", async () => {
      const session = createSession("questionnaire-shuffle-journey");
      const engine = new SessionEngine(session, questionnaireShuffleJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      const state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.questionOrder).toHaveLength(5);

      // Answer all questions (text responses)
      for (let i = 0; i < 5; i++) {
        adapter.simulateMessage(`Answer ${i + 1}`);

        if (i < 4) {
          // Wait for next question
          await vi.waitFor(() => {
            const newState = getQuestionnaireState(engine, "questionnaire");
            return newState?.currentIndex === i + 1;
          }, { timeout: 1000 });
        }
      }

      await waitForNode(engine, "end");

      const finalState = getQuestionnaireState(engine, "questionnaire");
      expect(finalState?.responses).toHaveLength(5);
    });
  });

  describe("Text Response Handling", () => {
    it("should accept text responses for text-type questions", async () => {
      const session = createSession("questionnaire-journey");
      const engine = new SessionEngine(session, questionnaireJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Q1 is text type
      adapter.simulateMessage("This is my text response");

      await vi.waitFor(() => {
        const state = getQuestionnaireState(engine, "questionnaire");
        return state?.responses.length === 1;
      }, { timeout: 1000 });

      const state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.responses[0].value).toBe("This is my text response");
      expect(state?.responses[0].buttonId).toBeUndefined();
    });
  });

  describe("Event Logging", () => {
    it("should log questionnaire events in session history", async () => {
      const session = createSession("questionnaire-journey");
      const engine = new SessionEngine(session, questionnaireJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Answer all questions
      adapter.simulateMessage("Test User");
      await vi.waitFor(() => adapter.getSentMessages().some((m) => m.message.content?.includes("favorite color")), { timeout: 1000 });

      adapter.simulateButtonClick("btn-blue");
      await vi.waitFor(() => adapter.getSentMessages().some((m) => m.message.content?.includes("rate our service")), { timeout: 1000 });

      adapter.simulateButtonClick("btn-great");
      await waitForNode(engine, "end");

      // Verify events were logged
      expect(collectedEvents.length).toBeGreaterThan(0);

      // Should have engine.message events for questions
      const messageEvents = collectedEvents.filter((e) => e.type === "engine.message");
      expect(messageEvents.length).toBeGreaterThan(0);

      // Should have transition events
      const transitionEvents = collectedEvents.filter((e) => e.type === "engine.transition");
      expect(transitionEvents.length).toBeGreaterThan(0);

      // Should have user click events
      const clickEvents = collectedEvents.filter((e) => e.type === "user.click");
      expect(clickEvents.length).toBeGreaterThanOrEqual(2); // At least 2 button clicks
    });
  });

  describe("Validation Handling (P0 Fix)", () => {
    // Journey with text validation - inline fixture
    const questionnaireWithValidationJourney = {
      nodes: [
        {
          id: "start",
          type: "custom" as const,
          position: { x: 0, y: 0 },
          data: {
            type: "start" as const,
            schemaVersion: 1,
            label: "Start",
            content: "Starting validation test",
          },
          metadata: { createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", version: "1.0.0", status: "active" as const },
        },
        {
          id: "questionnaire",
          type: "custom" as const,
          position: { x: 0, y: 100 },
          data: {
            type: "questionnaire" as const,
            schemaVersion: 1,
            label: "Validated Survey",
            questions: [
              {
                id: "q1",
                content: "Enter your full name (at least 5 characters)",
                responseType: "text" as const,
                required: true,
                validation: { minLength: 5 },
              },
            ],
            allowBack: false,
            shuffle: false,
          },
          metadata: { createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", version: "1.0.0", status: "active" as const },
        },
        {
          id: "end",
          type: "custom" as const,
          position: { x: 0, y: 200 },
          data: {
            type: "end" as const,
            schemaVersion: 1,
            label: "End",
            content: "Done!",
          },
          metadata: { createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", version: "1.0.0", status: "active" as const },
        },
      ],
      edges: [
        { id: "edge-1", source: "start", target: "questionnaire" },
        { id: "edge-2", source: "questionnaire", target: "end" },
      ],
    };

    it("should not store invalid response in session.context (P0 fix)", async () => {
      const session = createSession("validation-journey");
      const engine = new SessionEngine(session, questionnaireWithValidationJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Should be at questionnaire node
      expect(engine.getSession().currentNodeId).toBe("questionnaire");
      adapter.clearMessages();

      // Send invalid response (too short - less than minLength: 5)
      await adapter.simulateMessage("Hi");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Session should still be on questionnaire node (didn't advance)
      expect(engine.getSession().currentNodeId).toBe("questionnaire");

      // P0 FIX: session.context.userResponse should NOT be set
      // Before the fix, invalid responses were stored in session.context
      expect(engine.getSession().context.userResponse).toBeUndefined();

      // Questionnaire state should not have advanced
      const state = getQuestionnaireState(engine, "questionnaire");
      expect(state?.currentIndex).toBe(0);
      expect(state?.responses).toHaveLength(0);

      // Validation error message should have been sent
      const messages = adapter.getSentMessages();
      expect(messages.some((m) => m.message.content?.toLowerCase().includes("character"))).toBe(true);
    });
  });
});
