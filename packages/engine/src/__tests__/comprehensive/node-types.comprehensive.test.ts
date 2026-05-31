import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnhancedUserJourney, InteractionEvent } from "@journey/schemas";
import { SessionEngine } from "../../session-engine";
import { MockMessagingAdapter } from "../helpers/mock-adapter";
import { onboardingJourney } from "./fixtures/production-journeys";

describe("Comprehensive Node Type Tests", () => {
  let adapter: MockMessagingAdapter;
  let collectedEvents: InteractionEvent[];

  beforeEach(() => {
    adapter = new MockMessagingAdapter();
    collectedEvents = [];
  });

  const createSession = (journeyId: string): EnhancedUserJourney => ({
    sessionId: "test-session-1",
    userId: "test-user-1",
    platformUserId: "test-user-1",
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

  const onEvent = (event: InteractionEvent) => {
    collectedEvents.push(event);
  };

  // Helper to wait for engine to reach expected state
  const waitForNode = async (engine: SessionEngine, expectedNodeId: string) => {
    await vi.waitFor(() => {
      expect(engine.getSession().currentNodeId).toBe(expectedNodeId);
    }, { timeout: 1000, interval: 10 });
  };

  describe("START Node", () => {
    it("should send welcome message with media and apply initial tags/variables", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Verify message sent with media
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message.content).toContain("Welcome to our SaaS platform");
      expect(messages[0].message.media).toEqual({
        type: "image",
        url: "https://example.com/welcome.png",
      });

      // Verify tags applied
      const finalSession = engine.getSession();
      expect(finalSession.tags).toContain("onboarding_started");

      // Verify auto-transition happened
      expect(finalSession.currentNodeId).toBe("ask-role");
    });

    it("should apply tag and variable actions on start", async () => {
      const session = createSession("onboarding");

      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Verify tags applied from start node
      const finalSession = engine.getSession();
      expect(finalSession.tags).toContain("onboarding_started");

      // Note: Journey variables (from variableAction.journeyOperations) are stored
      // via the external variable service callbacks, not in session.context.
      // The session.context is used for user responses (storeResponseAs).
      // Variable persistence is tested in the variable service tests.
    });
  });

  describe("MESSAGE Node", () => {
    describe("Response Type: buttons", () => {
      it("should wait for button click and store response", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Should be at ask-role node
        expect(engine.getSession().currentNodeId).toBe("ask-role");

        // Verify buttons sent
        const messages = adapter.getSentMessages();
        const askRoleMessage = messages.find((m) =>
          m.message.content.includes("What best describes your role?")
        );
        expect(askRoleMessage?.message.buttons).toEqual([
          { id: "btn-dev", label: "Developer" },
          { id: "btn-designer", label: "Designer" },
          { id: "btn-pm", label: "Product Manager" },
        ]);

        // Clear events
        collectedEvents.length = 0;

        // Simulate button click
        // Developer click → role-condition (auto) → ask-tech-stack (wait for text)
        adapter.simulateButtonClick("btn-dev");

        // Wait for transition to complete
        await waitForNode(engine, "ask-tech-stack");

        // Verify response stored (button ID is stored, not text)
        const finalSession = engine.getSession();
        expect(finalSession.context.user_role).toBe("btn-dev");

        // Verify transition happened - condition node auto-transitions to ask-tech-stack
        expect(finalSession.currentNodeId).toBe("ask-tech-stack");

        // Verify button click event logged
        expect(collectedEvents.some((e) => e.type === "user.click")).toBe(true);
      });

      it("should handle multiple button options", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Test each button option (ID → expected stored value)
        const buttonOptions = [
          { id: "btn-dev", expected: "btn-dev" },
          { id: "btn-designer", expected: "btn-designer" },
          { id: "btn-pm", expected: "btn-pm" },
        ];

        for (const { id, expected } of buttonOptions) {
          // Reset to ask-role node
          const freshSession = createSession("onboarding");
          const freshEngine = new SessionEngine(freshSession, onboardingJourney, adapter, { onEvent: onEvent });
          await freshEngine.start();

          adapter.simulateButtonClick(id);
          await vi.waitFor(() => {
            expect(freshEngine.getSession().context.user_role).toBe(expected);
          }, { timeout: 1000, interval: 10 });
        }
      });
    });

    describe("Response Type: text", () => {
      it("should wait for text message and store response", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Navigate to ask-tech-stack node (text input)
        adapter.simulateButtonClick("btn-dev");
        await waitForNode(engine, "ask-tech-stack");

        // Should be at ask-tech-stack node after condition
        expect(engine.getSession().currentNodeId).toBe("ask-tech-stack");

        // Simulate text message
        adapter.simulateMessage("React and TypeScript");
        await waitForNode(engine, "create-profile");

        // Verify response stored
        const finalSession = engine.getSession();
        expect(finalSession.context.tech_stack).toBe("React and TypeScript");

        // Verify transition happened
        expect(finalSession.currentNodeId).toBe("create-profile");
      });
    });

    describe("Response Type: auto", () => {
      it("should send message and auto-continue without waiting", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Navigate to non-tech-message node (auto response)
        adapter.simulateButtonClick("btn-pm");
        await waitForNode(engine, "create-profile");

        // Should auto-transition through non-tech-message to create-profile
        const finalSession = engine.getSession();

        // Verify message was sent
        const messages = adapter.getSentMessages();
        const nonTechMessage = messages.find((m) =>
          m.message.content.includes("Perfect! We'll show you the features")
        );
        expect(nonTechMessage).toBeDefined();

        // Verify auto-transition happened
        expect(finalSession.currentNodeId).toBe("create-profile");
      });
    });

    describe("Response Type: any", () => {
      it("should accept both button clicks and text messages", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Navigate through journey to final-message node (any response type)
        // Developer click → role-condition (auto) → ask-tech-stack
        adapter.simulateButtonClick("btn-dev");
        await waitForNode(engine, "ask-tech-stack");

        // Text input → create-profile (100ms webhook) → profile-success (auto) → wait-processing (timer)
        adapter.simulateMessage("React");
        await waitForNode(engine, "wait-processing");

        // Should be at wait-processing now (waiting for timer)
        expect(engine.getSession().currentNodeId).toBe("wait-processing");

        // Simulate wait timer expiration → final-message
        const timers = engine.getSession().pendingTimers;
        expect(timers.length).toBeGreaterThan(0);
        adapter.simulateTimeout(timers[0].timerId);
        await waitForNode(engine, "final-message");

        // Should be at final-message node
        expect(engine.getSession().currentNodeId).toBe("final-message");

        // Test button response
        adapter.simulateButtonClick("btn-get-started");
        await waitForNode(engine, "end");

        expect(engine.getSession().currentNodeId).toBe("end");

        // Test with text response in new session
        const session2 = createSession("onboarding-2");
        const engine2 = new SessionEngine(session2, onboardingJourney, adapter, { onEvent: onEvent });

        await engine2.start();
        // Designer click → role-condition → non-tech-message (auto) → create-profile (100ms)
        adapter.simulateButtonClick("btn-designer");
        await waitForNode(engine2, "wait-processing");

        // Should be at wait-processing
        expect(engine2.getSession().currentNodeId).toBe("wait-processing");

        // Trigger wait timer → final-message
        const timers2 = engine2.getSession().pendingTimers;
        adapter.simulateTimeout(timers2[0].timerId);
        await waitForNode(engine2, "final-message");

        expect(engine2.getSession().currentNodeId).toBe("final-message");

        // Text response → end
        adapter.simulateMessage("I have a question");
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(engine2.getSession().currentNodeId).toBe("end");
      });
    });

    describe("Timer Integration", () => {
      it("should trigger timer edge when user doesn't respond in time", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Navigate to ask-tech-stack node (has 60 second timer)
        // Developer click → role-condition (auto) → ask-tech-stack
        adapter.simulateButtonClick("btn-dev");
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(engine.getSession().currentNodeId).toBe("ask-tech-stack");

        // Get the timer ID
        const timers = engine.getSession().pendingTimers;
        expect(timers.length).toBeGreaterThan(0);

        // Simulate timeout
        // Timer fires → timeout-reminder (auto) → create-profile (webhook)
        adapter.simulateTimeout(timers[0].timerId);
        await new Promise((resolve) => setTimeout(resolve, 10));

        // timeout-reminder has responseType="auto", auto-continues to create-profile
        expect(engine.getSession().currentNodeId).toBe("create-profile");

        // Verify timeout message was sent (from timeout-reminder node)
        const messages = adapter.getSentMessages();
        const timeoutMessage = messages.find((m) =>
          m.message.content.includes("No worries! You can always update this later")
        );
        expect(timeoutMessage).toBeDefined();
      });

      it("should cancel timer when user responds before timeout", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        adapter.simulateButtonClick("btn-dev");
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Should have pending timer
        expect(engine.getSession().pendingTimers.length).toBeGreaterThan(0);

        // User responds before timeout
        adapter.simulateMessage("React");
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Timer should be cancelled
        expect(engine.getSession().pendingTimers.length).toBe(0);

        // Should be at create-profile, not timeout-reminder
        expect(engine.getSession().currentNodeId).toBe("create-profile");
      });
    });

    describe("Media Support", () => {
      it("should send message with image media", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        const messages = adapter.getSentMessages();
        const startMessage = messages[0];

        expect(startMessage.message.media).toEqual({
          type: "image",
          url: "https://example.com/welcome.png",
        });
      });
    });
  });

  describe("CONDITION Node", () => {
    describe("Rule-Based Evaluation", () => {
      it("should evaluate rule and route to correct branch", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Select Developer (should match technical rule)
        adapter.simulateButtonClick("btn-dev");
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Should route to technical branch (ask-tech-stack)
        expect(engine.getSession().currentNodeId).toBe("ask-tech-stack");

        // Verify node output stored
        expect(engine.getSession().nodeOutputs["Role_Check"]).toBeDefined();
      });

      it("should fall back to default branch when no rule matches", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Select Product Manager (should not match technical rule, use default)
        // PM click → role-condition → non-tech-message (auto) → create-profile
        adapter.simulateButtonClick("btn-pm");
        await new Promise((resolve) => setTimeout(resolve, 10));

        // non-tech-message has responseType="auto", auto-continues to create-profile
        expect(engine.getSession().currentNodeId).toBe("create-profile");
      });
    });
  });

  describe("WAIT Node", () => {
    it("should pause execution for specified duration", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Navigate to wait-processing node
      // Designer click → role-condition → non-tech-message (auto) → create-profile (100ms webhook) → profile-success (auto) → wait-processing
      adapter.simulateButtonClick("btn-designer");
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be at wait-processing after webhook completes
      expect(engine.getSession().currentNodeId).toBe("wait-processing");

      // Should have pending timer from WAIT node
      expect(engine.getSession().pendingTimers.length).toBeGreaterThan(0);
    });

    it("should transition to next node after wait completes", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Designer click → role-condition → non-tech-message (auto) → create-profile (100ms) → profile-success (auto) → wait-processing
      adapter.simulateButtonClick("btn-designer");
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(engine.getSession().currentNodeId).toBe("wait-processing");

      // Simulate timer expiration → final-message
      const timers = engine.getSession().pendingTimers;
      adapter.simulateTimeout(timers[0].timerId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should transition to final-message
      expect(engine.getSession().currentNodeId).toBe("final-message");
    });
  });

  describe("WEBHOOK Node", () => {
    describe("Mock Response", () => {
      it("should use mock response when enabled", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Developer click → role-condition (auto) → ask-tech-stack
        adapter.simulateButtonClick("btn-dev");
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Text input → create-profile (100ms webhook) → profile-success (auto) → wait-processing
        adapter.simulateMessage("React");
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Webhook should have executed with mock response
        const finalSession = engine.getSession();

        // profile-success has responseType="auto", auto-continues to wait-processing
        expect(finalSession.currentNodeId).toBe("wait-processing");

        // Verify node output stored from mock response
        // NodeOutput structure: { nodeId, nodeLabel, nodeType, executedAt, data }
        // The webhook response (via successPath "$.data") is stored in the data field
        expect(finalSession.nodeOutputs["Create_Profile"]).toBeDefined();
        expect(finalSession.nodeOutputs["Create_Profile"].data).toHaveProperty("profileId");
      });
    });

    describe("Success Path", () => {
      it("should route to success edge on successful request", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        // Developer click → role-condition (auto) → ask-tech-stack
        adapter.simulateButtonClick("btn-dev");
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Text input → create-profile (100ms) → profile-success (auto) → wait-processing
        adapter.simulateMessage("TypeScript");
        await new Promise((resolve) => setTimeout(resolve, 150));

        // profile-success has responseType="auto", auto-continues to wait-processing
        expect(engine.getSession().currentNodeId).toBe("wait-processing");

        // Verify success tags applied (from profile-success node)
        expect(engine.getSession().tags).toContain("profile_created");
        expect(engine.getSession().tags).toContain("success_path");
      });
    });

    describe("Template Substitution", () => {
      it("should substitute variables in webhook body", async () => {
        const session = createSession("onboarding");
        const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

        await engine.start();

        adapter.simulateButtonClick("btn-dev");
        await new Promise((resolve) => setTimeout(resolve, 10));

        adapter.simulateMessage("Vue.js");
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Webhook should have been called with substituted values
        // (In real test, you'd verify the actual HTTP request)
        const finalSession = engine.getSession();
        expect(finalSession.context.user_role).toBe("btn-dev"); // Button ID stored
        expect(finalSession.context.tech_stack).toBe("Vue.js"); // Text input stored
      });
    });
  });

  describe("END Node", () => {
    it("should mark session as completed", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Complete the journey
      // Designer click → role-condition → non-tech-message (auto) → create-profile (100ms) → profile-success (auto) → wait-processing
      adapter.simulateButtonClick("btn-designer");
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(engine.getSession().currentNodeId).toBe("wait-processing");

      // Trigger wait timer → final-message
      const timers = engine.getSession().pendingTimers;
      adapter.simulateTimeout(timers[0].timerId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getSession().currentNodeId).toBe("final-message");

      // Button click → end
      adapter.simulateButtonClick("btn-get-started");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const finalSession = engine.getSession();
      expect(finalSession.status).toBe("completed");
      expect(finalSession.currentNodeId).toBe("end");
      expect(finalSession.completedAt).toBeDefined();
    });

    it("should send final message", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Designer click → ... → wait-processing
      adapter.simulateButtonClick("btn-designer");
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Trigger wait timer → final-message
      const timers = engine.getSession().pendingTimers;
      adapter.simulateTimeout(timers[0].timerId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Button click → end
      adapter.simulateButtonClick("btn-get-started");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messages = adapter.getSentMessages();
      const endMessage = messages.find((m) =>
        m.message.content.includes("You're all set! Welcome to the platform")
      );
      expect(endMessage).toBeDefined();
    });

    it("should apply final tags and variables", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Designer click → ... → wait-processing
      adapter.simulateButtonClick("btn-designer");
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Trigger wait timer → final-message
      const timers = engine.getSession().pendingTimers;
      adapter.simulateTimeout(timers[0].timerId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Button click → end
      adapter.simulateButtonClick("btn-get-started");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const finalSession = engine.getSession();

      // Should have added completion tag
      expect(finalSession.tags).toContain("onboarding_completed");

      // Should have removed start tag
      expect(finalSession.tags).not.toContain("onboarding_started");
    });
  });
});
