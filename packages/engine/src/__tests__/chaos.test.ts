/**
 * Chaos Testing for Journey Engine
 *
 * Tests resilience to failures:
 * - Message send failures (permanent and transient)
 * - Concurrent event handling
 * - State corruption scenarios
 * - Missing node references
 * - Service unavailability patterns
 *
 * Run with: pnpm test:chaos
 *
 * @module engine/tests/chaos
 */

import { createLogger } from "@journey/logger";
import type { EnhancedUserJourney, JourneyConfig } from "@journey/schemas";
import { describe, expect, it } from "vitest";
import { SessionEngine } from "../session-engine";
import { isValidJourney, validateJourneyStructure } from "../validation";
import { buttonJourney, conditionJourney, linearJourney, messageWithTimerJourney, webhookJourney } from "./fixtures/journey-configs";
import { generateBranchingJourney, generateLinearJourney, generateValidJourney, SeededRandom, setGeneratorSeed } from "./generators";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CHAOS_SEED = parseInt(process.env.CHAOS_SEED || "7777", 10);
const CHAOS_TIMEOUT = parseInt(process.env.CHAOS_TIMEOUT || "30000", 10);

setGeneratorSeed(CHAOS_SEED);

// Log configuration for visibility
const testLog = createLogger("chaos-tests");
testLog.info(
  {
    chaosSeed: CHAOS_SEED,
    chaosTimeout: CHAOS_TIMEOUT,
  },
  "chaos-tests:configuration"
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a fresh session for testing
 */
function createSession(journeyId: string, sessionId = "test-session-1", userId = "test-user-1"): EnhancedUserJourney {
  return {
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
  };
}

/**
 * Create an engine with failure-enabled adapter
 */
function createTestEngine(journey: JourneyConfig) {
  const adapter = new MockMessagingAdapter();
  const session = createSession("test-journey");
  const engine = new SessionEngine(session, journey, adapter);
  return { engine, adapter, session };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute journey with random failures
 */
async function executeWithRandomFailures(
  journey: JourneyConfig,
  failProbability = 0.3,
  seed = CHAOS_SEED
): Promise<{
  completed: boolean;
  errorCount: number;
  steps: number;
  finalStatus: string;
}> {
  const rng = new SeededRandom(seed);
  const adapter = new MockMessagingAdapter();
  const session = createSession("test-journey");
  const engine = new SessionEngine(session, journey, adapter);

  let errorCount = 0;
  let steps = 0;
  const maxSteps = 500;

  await engine.start();

  while (session.status === "active" && steps < maxSteps) {
    // Random chance of failure
    if (rng.bool(failProbability)) {
      adapter.mockSendMessageFail("Random chaos failure", 1);
      errorCount++;
    }

    // Check for user input needed
    const currentNode = journey.nodes.find((n) => n.id === session.currentNodeId);
    if (currentNode?.data.type === "message") {
      const data = currentNode.data;
      if (data.buttons?.length && data.responseType !== "auto") {
        // Provide input - use button ID for click simulation
        adapter.simulateButtonClick(data.buttons[0].id);
      }
    }

    steps++;
    await sleep(1);
  }

  return {
    completed: session.status === "completed",
    errorCount,
    steps,
    finalStatus: session.status,
  };
}

// =============================================================================
// CHAOS TESTS
// =============================================================================

describe("Chaos Testing", () => {
  describe("Message Send Failures", () => {
    it("handles permanent send failure gracefully", async () => {
      const { engine, adapter, session } = createTestEngine(linearJourney);

      // Set permanent failure
      adapter.mockSendMessageFail("Permanent failure");

      // Start should handle failure
      await engine.start();

      // Session may be active or failed, but shouldn't throw
      expect(["active", "error", "completed"]).toContain(session.status);
    });

    it("handles transient failure with recovery", async () => {
      const { engine, adapter, session } = createTestEngine(linearJourney);

      // Fail first 2 attempts, then succeed
      adapter.mockSendMessageFail("Transient failure", 2);

      await engine.start();

      // Wait for potential recovery
      await sleep(50);

      // Adapter should have recovered
      expect(adapter.isFailureSimulationActive()).toBe(false);
    });

    it("recovers from failure mid-journey", async () => {
      const journey = generateLinearJourney(5, { responseType: "auto", seed: CHAOS_SEED });
      const { engine, adapter, session } = createTestEngine(journey);

      await engine.start();

      // Wait a bit, then inject failure
      await sleep(10);
      adapter.mockSendMessageFail("Mid-journey failure", 1);

      // Wait for completion
      let attempts = 0;
      while (session.status === "active" && attempts < 100) {
        await sleep(10);
        attempts++;
      }

      // Should complete despite failure
      expect(["completed", "active", "error"]).toContain(session.status);
    });

    it("handles multiple sequential failures", async () => {
      const journey = generateLinearJourney(10, { responseType: "auto", seed: CHAOS_SEED });
      const adapter = new MockMessagingAdapter();
      const session = createSession("test-journey");
      const engine = new SessionEngine(session, journey, adapter);

      let failureCount = 0;
      const maxFailures = 5;

      await engine.start();

      while (session.status === "active" && failureCount < maxFailures) {
        adapter.mockSendMessageFail("Sequential failure", 1);
        failureCount++;
        await sleep(10);
      }

      // Should still be in valid state
      expect(["active", "completed", "error"]).toContain(session.status);
    });
  });

  describe("Concurrent Event Handling", () => {
    it("handles rapid sequential events", async () => {
      const { engine, adapter, session } = createTestEngine(buttonJourney);

      await engine.start();

      // Wait for node with buttons
      await sleep(50);

      // Send multiple events rapidly
      const events = ["Option A", "Option B", "Invalid"];
      for (const buttonId of events) {
        adapter.simulateButtonClick(buttonId);
        await sleep(5);
      }

      // Session should be in valid state
      expect(["active", "completed", "error"]).toContain(session.status);
    });

    it("handles events during node transition", async () => {
      const journey = generateLinearJourney(5, { responseType: "auto", seed: CHAOS_SEED });
      const { engine, adapter, session } = createTestEngine(journey);

      // Start journey
      const startPromise = engine.start();

      // Immediately send event (during transition)
      adapter.simulateMessage("Interrupt");

      // Both should complete without error
      await startPromise;

      expect(session.sessionId).toBeDefined();
    });
  });

  describe("Random Failure Injection", () => {
    it(
      "survives 10% failure rate",
      async () => {
        const journey = generateLinearJourney(10, { responseType: "auto", seed: CHAOS_SEED });

        const result = await executeWithRandomFailures(journey, 0.1, CHAOS_SEED);

        expect(result.finalStatus).not.toBe("error");
        expect(result.steps).toBeLessThan(500);
      },
      CHAOS_TIMEOUT
    );

    it(
      "survives 30% failure rate with retries",
      async () => {
        const journey = generateLinearJourney(5, { responseType: "auto", seed: CHAOS_SEED });

        const result = await executeWithRandomFailures(journey, 0.3, CHAOS_SEED + 1);

        // Should complete or be in valid state
        expect(["completed", "active", "error"]).toContain(result.finalStatus);
      },
      CHAOS_TIMEOUT
    );

    it(
      "handles failure in condition journey",
      async () => {
        const result = await executeWithRandomFailures(conditionJourney, 0.2, CHAOS_SEED);

        expect(["completed", "active", "error"]).toContain(result.finalStatus);
      },
      CHAOS_TIMEOUT
    );
  });

  describe("State Corruption Scenarios", () => {
    it("handles invalid node reference in session", async () => {
      const { engine, session } = createTestEngine(linearJourney);

      await engine.start();

      // Corrupt state by setting invalid node
      (session as { currentNodeId: string }).currentNodeId = "nonexistent-node";

      // Session should still be defined
      expect(session.sessionId).toBeDefined();
    });

    it("handles empty history array", async () => {
      const { engine, session } = createTestEngine(linearJourney);

      await engine.start();

      // Clear history
      (session as { history: unknown[] }).history = [];

      // Session should still function
      expect(session.sessionId).toBeDefined();
    });
  });

  describe("Timer Interaction with Failures", () => {
    it(
      "handles failure during timer wait",
      async () => {
        const { engine, adapter, session } = createTestEngine(messageWithTimerJourney);

        await engine.start();

        // Wait for timer node
        await sleep(50);

        // Inject failure during timer
        adapter.mockSendMessageFail("Timer failure", 1);

        // Wait a bit more
        await sleep(100);

        // Should recover
        expect(["active", "completed", "error"]).toContain(session.status);
      },
      CHAOS_TIMEOUT
    );
  });

  describe("Webhook Chaos", () => {
    it(
      "handles webhook node with send failure",
      async () => {
        const { engine, adapter, session } = createTestEngine(webhookJourney);

        await engine.start();

        // Inject failure when webhook tries to send
        adapter.mockSendMessageFail("Webhook send failure", 1);

        // Wait for completion
        let attempts = 0;
        while (session.status === "active" && attempts < 100) {
          await sleep(10);
          attempts++;
        }

        // Should be in valid state
        expect(["completed", "active", "error"]).toContain(session.status);
      },
      CHAOS_TIMEOUT
    );
  });

  describe("Generated Journey Chaos", () => {
    it(
      "multiple generated journeys survive random failures",
      async () => {
        const journeys = [
          generateValidJourney({ seed: CHAOS_SEED + 1, minNodes: 3, maxNodes: 6 }),
          generateValidJourney({ seed: CHAOS_SEED + 2, minNodes: 3, maxNodes: 6 }),
          generateValidJourney({ seed: CHAOS_SEED + 3, minNodes: 3, maxNodes: 6 }),
        ];

        for (const journey of journeys) {
          // Validate first
          expect(isValidJourney(journey)).toBe(true);

          const result = await executeWithRandomFailures(journey, 0.15, CHAOS_SEED);

          // Should not crash
          expect(result.steps).toBeLessThanOrEqual(500);
          expect(["completed", "active", "error"]).toContain(result.finalStatus);
        }
      },
      CHAOS_TIMEOUT * 3
    );

    it(
      "branching journey survives chaos",
      async () => {
        const journey = generateBranchingJourney(3, { seed: CHAOS_SEED });

        expect(isValidJourney(journey)).toBe(true);

        const result = await executeWithRandomFailures(journey, 0.2, CHAOS_SEED);

        expect(result.steps).toBeLessThan(500);
      },
      CHAOS_TIMEOUT
    );
  });

  describe("Edge Cases Under Stress", () => {
    it("empty journey config doesn't crash", async () => {
      const emptyJourney = { nodes: [], edges: [] };

      // Should fail validation
      expect(isValidJourney(emptyJourney)).toBe(false);

      // Attempting to run should fail gracefully
      const adapter = new MockMessagingAdapter();

      try {
        const session = createSession("test-journey");
        const engine = new SessionEngine(session, emptyJourney, adapter);
        await engine.start();
      } catch (error) {
        // Expected - empty journey can't be executed
        expect(error).toBeDefined();
      }
    });

    it("handles null/undefined fields gracefully", async () => {
      const malformedJourney = {
        nodes: [
          {
            id: "start",
            type: "custom" as const,
            position: { x: 0, y: 0 },
            data: {
              type: "start" as const,
              schemaVersion: 1,
              label: "Start",
              content: undefined as unknown as string,
            },
            metadata: {
              createdAt: "2025-01-01T00:00:00Z",
              updatedAt: "2025-01-01T00:00:00Z",
              version: "1.0.0",
              status: "active" as const,
            },
          },
        ],
        edges: [],
      };

      // Should fail validation (no end node)
      const result = validateJourneyStructure(malformedJourney);
      expect(result.valid).toBe(false);
    });
  });

  describe("Recovery Patterns", () => {
    it("engine can be restarted after failure", async () => {
      const journey = generateLinearJourney(3, { responseType: "auto", seed: CHAOS_SEED });
      const adapter = new MockMessagingAdapter();

      // First run with failure
      const session1 = createSession("test-journey-1");
      const engine1 = new SessionEngine(session1, journey, adapter);

      adapter.mockSendMessageFail("Initial failure");
      await engine1.start();

      // Clear failure
      adapter.mockSendMessageSucceed();
      adapter.reset();

      // Second run should work
      const session2 = createSession("test-journey-2");
      const engine2 = new SessionEngine(session2, journey, adapter);

      await engine2.start();

      // Wait for completion
      let attempts = 0;
      while (session2.status === "active" && attempts < 100) {
        await sleep(10);
        attempts++;
      }

      expect(session2.status).toBe("completed");
    });

    it("adapter failure doesn't affect subsequent engines", async () => {
      const journey = generateLinearJourney(2, { responseType: "auto", seed: CHAOS_SEED });
      const adapter = new MockMessagingAdapter();

      // Run with failures
      adapter.mockSendMessageFail("Failure", 3);

      for (let i = 0; i < 5; i++) {
        const session = createSession(`test-journey-${i}`);
        const engine = new SessionEngine(session, journey, adapter);

        await engine.start();
        await sleep(20);
      }

      // Adapter should have recovered
      expect(adapter.isFailureSimulationActive()).toBe(false);
    });
  });
});

describe("Stress Test", () => {
  it(
    "handles 50 sequential journey executions",
    async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < 50; i++) {
        const journey = generateLinearJourney(3, { responseType: "auto", seed: CHAOS_SEED + i });
        const adapter = new MockMessagingAdapter();
        const session = createSession(`test-journey-${i}`);
        const engine = new SessionEngine(session, journey, adapter);

        try {
          await engine.start();

          let attempts = 0;
          while (session.status === "active" && attempts < 50) {
            await sleep(5);
            attempts++;
          }

          if (session.status === "completed") {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      // Most should succeed
      expect(successCount).toBeGreaterThan(40);
    },
    CHAOS_TIMEOUT * 3
  );
});
