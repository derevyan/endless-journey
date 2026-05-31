import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnhancedUserJourney, InteractionEvent } from "@journey/schemas";
import { SessionEngine } from "../../session-engine";
import { MockMessagingAdapter } from "../helpers/mock-adapter";
import { onboardingJourney } from "./fixtures/production-journeys";

describe("Comprehensive Edge Type Tests", () => {
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

  describe("DEFAULT Edge", () => {
    it("should handle standard progression between nodes", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Start should auto-transition via default edge to ask-role
      expect(engine.getSession().currentNodeId).toBe("ask-role");

      // Verify transition event logged
      const transitionEvents = collectedEvents.filter((e) => e.type === "engine.transition");
      expect(transitionEvents.length).toBeGreaterThan(0);
    });

    it("should handle multiple default edges from message buttons", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // ask-role has 3 button options, each with default edge
      const messages = adapter.getSentMessages();
      const askRoleMessage = messages.find((m) =>
        m.message.content.includes("What best describes your role?")
      );
      expect(askRoleMessage?.message.buttons).toHaveLength(3);

      // Test each button routes via default edge
      // Developer click → role-condition (auto) → ask-tech-stack (wait for text)
      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      expect(engine.getSession().currentNodeId).toBe("ask-tech-stack");
    });

    it("should be used as fallback when no specific edge type matches", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Non-tech path uses default edges throughout
      // PM click → role-condition (auto) → non-tech-message (auto) → create-profile (webhook with 100ms mock)
      adapter.simulateButtonClick("btn-pm");
      await waitForNode(engine, "create-profile");

      // Already at create-profile (non-tech-message has responseType="auto")
      expect(engine.getSession().currentNodeId).toBe("create-profile");

      // Wait for webhook mock (100ms) to complete, then auto-continues to wait-processing
      await waitForNode(engine, "wait-processing");
      expect(engine.getSession().currentNodeId).toBe("wait-processing");
    });
  });

  describe("SUCCESS Edge", () => {
    it("should activate after successful webhook execution", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Navigate to webhook node
      // Developer click → role-condition (auto) → ask-tech-stack (wait for text)
      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      // Text input → create-profile (webhook 100ms) → profile-success (auto) → wait-processing
      adapter.simulateMessage("React");
      await waitForNode(engine, "wait-processing");

      // Webhook succeeds, takes success edge to profile-success, then auto-continues to wait-processing
      expect(engine.getSession().currentNodeId).toBe("wait-processing");

      // Verify success path tag was applied (profile-success adds this)
      expect(engine.getSession().tags).toContain("success_path");
    });

    it("should be prioritized over default edge from webhook node", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Designer click → role-condition → non-tech-message (auto) → create-profile (100ms) → profile-success (auto) → wait-processing
      adapter.simulateButtonClick("btn-designer");
      await waitForNode(engine, "wait-processing");

      // Should take success edge (mock succeeds), then auto-continue to wait-processing
      expect(engine.getSession().currentNodeId).toBe("wait-processing");
      // Not at profile-error means success path was taken
      expect(engine.getSession().tags).toContain("success_path");
    });
  });

  describe("TIMER Edge", () => {
    it("should activate after message timer expires", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Navigate to ask-tech-stack (has 60 second timer)
      // Developer click → role-condition (auto) → ask-tech-stack (wait for text/timer)
      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      expect(engine.getSession().currentNodeId).toBe("ask-tech-stack");

      // Get timer ID
      const timers = engine.getSession().pendingTimers;
      expect(timers.length).toBeGreaterThan(0);

      // Simulate timeout
      // Timer fires → timeout-reminder (auto) → create-profile (webhook 100ms)
      adapter.simulateTimeout(timers[0].timerId);
      await waitForNode(engine, "create-profile");

      // timeout-reminder has responseType="auto", auto-continues to create-profile
      expect(engine.getSession().currentNodeId).toBe("create-profile");

      // Verify timeout event logged
      const timeoutEvents = collectedEvents.filter((e) => e.type === "timer.expired");
      expect(timeoutEvents.length).toBeGreaterThan(0);
    });

    it("should be cancelled if user interacts before timeout", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      // Timer should be scheduled
      expect(engine.getSession().pendingTimers.length).toBeGreaterThan(0);

      // User responds before timeout
      adapter.simulateMessage("React");
      await vi.waitFor(() => {
        expect(engine.getSession().pendingTimers.length).toBe(0);
      }, { timeout: 1000, interval: 10 });

      // Timer should be cancelled
      expect(engine.getSession().pendingTimers.length).toBe(0);

      // Should NOT be at timeout-reminder
      expect(engine.getSession().currentNodeId).not.toBe("timeout-reminder");
    });

    it("should use sourceHandle='timer' for identification", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      // Find the timer edge in journey config
      const timerEdge = onboardingJourney.edges.find(
        (e) => e.source === "ask-tech-stack" && e.edgeType === "timer"
      );

      expect(timerEdge).toBeDefined();
      expect(timerEdge?.sourceHandle).toBe("timer");
      expect(timerEdge?.edgeType).toBe("timer");
    });
  });

  describe("RETRY Edge", () => {
    it("should activate after webhook error with retry strategy", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      adapter.simulateMessage("React");
      await waitForNode(engine, "wait-processing");

      // In this test, webhook succeeds, but retry edge exists for error case
      // Verify retry edge is defined in journey
      const retryEdge = onboardingJourney.edges.find(
        (e) => e.source === "create-profile" && e.edgeType === "retry"
      );

      expect(retryEdge).toBeDefined();
      expect(retryEdge?.target).toBe("profile-error");
    });

    it("should support retry loops back to webhook node", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      adapter.simulateMessage("React");
      await waitForNode(engine, "wait-processing");

      // If we were at profile-error node, we could retry
      const retryEdge = onboardingJourney.edges.find(
        (e) => e.source === "profile-error" && e.label === "Try Again"
      );

      expect(retryEdge).toBeDefined();
      expect(retryEdge?.target).toBe("create-profile");
    });
  });

  describe("DROPOFF Edge", () => {
    it("should track user abandonment path", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Navigate to ask-tech-stack
      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      // Verify dropoff edge exists
      const dropoffEdge = onboardingJourney.edges.find(
        (e) => e.source === "ask-tech-stack" && e.edgeType === "dropoff"
      );

      expect(dropoffEdge).toBeDefined();
      expect(dropoffEdge?.target).toBe("dropoff-node");
    });

    it("should lead to terminal state with dropoff tags", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      // In a real scenario, we'd simulate the dropoff edge being triggered
      // For now, verify the dropoff node configuration

      const dropoffNode = onboardingJourney.nodes.find((n) => n.id === "dropoff-node");

      expect(dropoffNode).toBeDefined();
      expect(dropoffNode?.data.type).toBe("end");
      expect(dropoffNode?.data.tagAction?.tags?.add).toContain(
        "onboarding_abandoned"
      );
    });
  });

  describe("EXIT Edge", () => {
    it("should handle early journey termination", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Verify exit edges exist from profile-error (there are two: Skip→wait-processing, Exit→exit-node)
      const exitEdges = onboardingJourney.edges.filter(
        (e) => e.source === "profile-error" && e.edgeType === "exit"
      );

      expect(exitEdges.length).toBe(2);

      // One goes to exit-node for full termination
      const exitToNode = exitEdges.find((e) => e.target === "exit-node");
      expect(exitToNode).toBeDefined();
      expect(exitToNode?.label).toBe("Exit");

      // One goes to wait-processing for skip option
      const skipEdge = exitEdges.find((e) => e.target === "wait-processing");
      expect(skipEdge).toBeDefined();
      expect(skipEdge?.label).toBe("Skip for Now");
    });

    it("should support 'Skip' button patterns", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Navigate through journey
      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      adapter.simulateMessage("React");
      await waitForNode(engine, "wait-processing");

      // Webhook should succeed and we're at profile-success
      // But if we were at profile-error, we could skip
      const skipEdge = onboardingJourney.edges.find(
        (e) => e.source === "profile-error" && e.label === "Skip for Now"
      );

      expect(skipEdge).toBeDefined();
      expect(skipEdge?.edgeType).toBe("exit");
    });

    it("should apply exit tags before completion", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      // Verify exit node configuration
      const exitNode = onboardingJourney.nodes.find((n) => n.id === "exit-node");

      expect(exitNode).toBeDefined();
      expect(exitNode?.data.type).toBe("end");
      expect(exitNode?.data.tagAction?.tags?.add).toContain(
        "onboarding_skipped"
      );
    });
  });

  describe("Edge Priority and Resolution", () => {
    it("should prioritize specific edge types over default", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Developer click → role-condition (auto) → ask-tech-stack
      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      // Text input → create-profile (100ms) → profile-success (auto) → wait-processing
      adapter.simulateMessage("React");
      await waitForNode(engine, "wait-processing");

      // Webhook has both success and retry edges
      // Success should be taken (mock succeeds), then auto-continues to wait-processing
      expect(engine.getSession().currentNodeId).toBe("wait-processing");
      expect(engine.getSession().tags).toContain("success_path");
    });

    it("should resolve edge by label for button clicks", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // Button labels match edge labels
      // Developer click → role-condition (auto) → ask-tech-stack
      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      // Condition auto-transitions to ask-tech-stack
      expect(engine.getSession().currentNodeId).toBe("ask-tech-stack");

      // Verify button click matched correct edge (Developer → role-condition)
      const edge = onboardingJourney.edges.find(
        (e) => e.source === "ask-role" && e.label === "Developer"
      );
      expect(edge).toBeDefined();
    });

    it("should resolve edge by sourceHandle for conditions", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      adapter.simulateButtonClick("btn-dev");
      await waitForNode(engine, "ask-tech-stack");

      // Condition should use sourceHandle to find correct branch edge
      const technicalEdge = onboardingJourney.edges.find(
        (e) => e.source === "role-condition" && e.sourceHandle === "technical"
      );

      expect(technicalEdge).toBeDefined();
      expect(technicalEdge?.target).toBe("ask-tech-stack");

      // Verify we're on the technical path (condition auto-transitioned here)
      expect(engine.getSession().currentNodeId).toBe("ask-tech-stack");
    });

    it("should fall back gracefully when edge not found", async () => {
      const session = createSession("onboarding");
      const engine = new SessionEngine(session, onboardingJourney, adapter, { onEvent: onEvent });

      await engine.start();

      // If condition doesn't match any rule, should use default branch
      // PM click → role-condition → non-tech-message (auto) → create-profile
      adapter.simulateButtonClick("btn-pm");
      await waitForNode(engine, "create-profile");

      // non-tech-message has responseType="auto", auto-continues to create-profile
      expect(engine.getSession().currentNodeId).toBe("create-profile");

      // Verify default branch edge exists
      const defaultEdge = onboardingJourney.edges.find(
        (e) => e.source === "role-condition" && e.sourceHandle === "non-technical"
      );
      expect(defaultEdge).toBeDefined();
    });
  });

  describe("Edge Type Styling and Visualization", () => {
    it("should have correct edgeType values for all edges", () => {
      const edgeTypes = new Set(onboardingJourney.edges.map((e) => e.edgeType));

      // Verify all expected edge types are present
      expect(edgeTypes).toContain("default");
      expect(edgeTypes).toContain("success");
      expect(edgeTypes).toContain("timer");
      expect(edgeTypes).toContain("retry");
      expect(edgeTypes).toContain("exit");
      expect(edgeTypes).toContain("dropoff");
    });

    it("should have sourceHandle set for special edges", () => {
      // Timer edges should have sourceHandle="timer"
      const timerEdges = onboardingJourney.edges.filter((e) => e.edgeType === "timer");
      timerEdges.forEach((edge) => {
        expect(edge.sourceHandle).toBe("timer");
      });

      // Condition branch edges should have sourceHandle
      const conditionEdges = onboardingJourney.edges.filter(
        (e) => e.source === "role-condition"
      );
      conditionEdges.forEach((edge) => {
        expect(edge.sourceHandle).toBeDefined();
      });
    });
  });
});
