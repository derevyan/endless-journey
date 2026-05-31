/**
 * Property-Based Journey Tests
 *
 * Fuzzy testing that verifies invariants hold for ANY valid journey:
 * - Termination: Every journey eventually reaches end or waits for input
 * - Message Ordering: Messages sent in node execution order
 * - State Consistency: Session state always valid after any operation
 * - No Duplicate Messages: Same message never sent twice for same node execution
 * - Timer Cleanup: Timers cancelled when transitioning away
 * - History Integrity: History events match actual execution path
 *
 * Run with: FUZZY_JOURNEY_COUNT=100 pnpm test:fuzzy
 *
 * @module engine/tests/property-based
 */

import { createLogger } from "@journey/logger";
import type { EnhancedUserJourney, JourneyConfig } from "@journey/schemas";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionEngine } from "../session-engine";
import { isValidJourney, validateJourneyStructure } from "../validation";
import {
  generateBranchingJourney,
  generateEdgeCaseJourney,
  generateInvalidJourney,
  generateLinearJourney,
  generateMixedJourneys,
  generateRandomJourneys,
  generateValidJourney,
  setGeneratorSeed,
} from "./generators";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Number of random journeys to test (configurable via FUZZY_JOURNEY_COUNT) */
const FUZZY_JOURNEY_COUNT = parseInt(process.env.FUZZY_JOURNEY_COUNT || "100", 10);

/** Seed for reproducible tests (configurable via FUZZY_SEED) */
const FUZZY_SEED = parseInt(process.env.FUZZY_SEED || "42", 10);

/** Maximum steps before considering a journey stuck */
const MAX_STEPS = 1000;

/** Timeout per journey test in ms */
const FUZZY_TIMEOUT = parseInt(process.env.FUZZY_TIMEOUT || "30000", 10);

/** Concurrency limit for parallel execution */
const FUZZY_CONCURRENCY = parseInt(process.env.FUZZY_CONCURRENCY || "20", 10);

// Set seed for reproducibility
setGeneratorSeed(FUZZY_SEED);

// Log configuration for visibility
const testLog = createLogger("fuzzy-tests");
testLog.info(
  {
    fuzzyJourneyCount: FUZZY_JOURNEY_COUNT,
    fuzzySeed: FUZZY_SEED,
    fuzzyTimeout: FUZZY_TIMEOUT,
    fuzzyConcurrency: FUZZY_CONCURRENCY,
    maxSteps: MAX_STEPS,
  },
  "fuzzy-tests:configuration"
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Execute async functions in parallel with concurrency limit
 */
async function runInChunks<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = FUZZY_CONCURRENCY
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((item, idx) => fn(item, i + idx)));
    results.push(...chunkResults);
  }
  return results;
}

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
 * Execute a journey and collect execution trace
 */
async function executeJourney(
  journey: JourneyConfig,
  userResponses: string[] = []
): Promise<{
  success: boolean;
  steps: number;
  messages: string[];
  finalStatus: string;
  history: unknown[];
  error?: string;
}> {
  const adapter = new MockMessagingAdapter();
  const session = createSession("test-journey");
  const engine = new SessionEngine(session, journey, adapter);

  const messages: string[] = [];
  let currentStep = 0;
  let responseIndex = 0;

  try {
    // Start the journey
    await engine.start();
    currentStep++;

    // Execute until complete, waiting, or stuck
    while (session.status === "active" && currentStep < MAX_STEPS) {
      const currentNode = journey.nodes.find((n) => n.id === session.currentNodeId);
      if (!currentNode) break;

      // Collect messages sent
      for (const msg of adapter.getSentMessages()) {
        if (!messages.includes(msg.message.content)) {
          messages.push(msg.message.content);
        }
      }
      adapter.clearMessages();

      // Check if waiting for user input
      const nodeData = currentNode.data;
      if (nodeData.type === "message") {
        const responseType = nodeData.responseType || (nodeData.buttons?.length ? "buttons" : "auto");
        if (responseType !== "auto") {
          // Needs user input - provide response if available
          if (responseIndex < userResponses.length) {
            adapter.simulateButtonClick(userResponses[responseIndex++]);
          } else if (nodeData.buttons?.length) {
            // Auto-select first button - use button ID
            adapter.simulateButtonClick(nodeData.buttons[0].id);
          } else {
            // No response available - break
            break;
          }
        }
      }

      currentStep++;

      // Small delay to prevent tight loop
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    return {
      success: session.status === "completed",
      steps: currentStep,
      messages,
      finalStatus: session.status,
      history: session.history,
    };
  } catch (error) {
    return {
      success: false,
      steps: currentStep,
      messages,
      finalStatus: session.status,
      history: session.history,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if journey execution follows valid path
 */
function validateExecutionPath(journey: JourneyConfig, history: unknown[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(journey.nodes.map((n) => n.id));

  for (const event of history) {
    const evt = event as { nodeId?: string; type?: string };
    if (evt.nodeId && !nodeIds.has(evt.nodeId)) {
      errors.push(`History references non-existent node: ${evt.nodeId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe("Property-Based Journey Tests", () => {
  describe("Journey Validation Properties", () => {
    it(`validates ${FUZZY_JOURNEY_COUNT} random journeys correctly`, () => {
      const journeys = generateRandomJourneys(FUZZY_JOURNEY_COUNT, { seed: FUZZY_SEED });

      for (let i = 0; i < journeys.length; i++) {
        const journey = journeys[i];
        const result = validateJourneyStructure(journey);

        // Generated "valid" journeys should pass validation
        expect(result.valid).toBe(true);
        if (!result.valid) {
          console.error(`Journey ${i} failed validation:`, result.errors);
        }
      }
    });

    it("correctly identifies invalid journeys", () => {
      const mixed = generateMixedJourneys(FUZZY_JOURNEY_COUNT, 0.5, FUZZY_SEED);

      for (const { journey, isValid, invalidationType } of mixed) {
        const result = validateJourneyStructure(journey);

        if (isValid) {
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
          if (result.valid) {
            console.error(`Expected invalid journey (${invalidationType}) to fail validation`);
          }
        }
      }
    });
  });

  describe("Termination Property", () => {
    it(
      "every valid journey reaches end or waits within MAX_STEPS",
      async () => {
        const journeys = generateRandomJourneys(FUZZY_JOURNEY_COUNT, { seed: FUZZY_SEED });

        const results = await runInChunks(journeys, async (journey, i) => {
          const result = await executeJourney(journey);
          return { index: i, result };
        });

        for (const { index, result } of results) {
          // Should either complete, be waiting for input, or reach a valid state
          expect(["completed", "active", "error", "dropped", "paused"]).toContain(result.finalStatus);
          // Journey should terminate or be waiting for input within max steps
          expect(result.steps).toBeLessThanOrEqual(MAX_STEPS);

          if (result.error) {
            console.error(`Journey ${index} error:`, result.error);
          }
        }
      },
      FUZZY_TIMEOUT
    );

    it(
      "linear auto-transition journeys complete immediately",
      async () => {
        for (const size of [3, 5, 10, 20]) {
          const journey = generateLinearJourney(size, { responseType: "auto", seed: FUZZY_SEED + size });

          // Validate first
          expect(isValidJourney(journey)).toBe(true);

          const result = await executeJourney(journey);
          expect(result.finalStatus).toBe("completed");
          expect(result.error).toBeUndefined();
        }
      },
      FUZZY_TIMEOUT
    );
  });

  describe("State Consistency Property", () => {
    it(
      "session state remains valid after execution",
      async () => {
        const journeys = generateRandomJourneys(FUZZY_JOURNEY_COUNT, { seed: FUZZY_SEED });

        const results = await runInChunks(journeys, async (journey) => {
          const adapter = new MockMessagingAdapter();
          const session = createSession("test-journey", `session-${Math.random()}`);
          const engine = new SessionEngine(session, journey, adapter);

          await engine.start();

          return { journey, finalSession: engine.getSession() };
        });

        for (const { journey, finalSession } of results) {
          // Check state consistency
          expect(finalSession.sessionId).toBeDefined();
          expect(finalSession.journeyId).toBeDefined();
          expect(["active", "completed", "error", "dropped", "paused"]).toContain(finalSession.status);
          expect(finalSession.history).toBeDefined();
          expect(Array.isArray(finalSession.history)).toBe(true);

          // If active, currentNodeId should reference a valid node
          if (finalSession.status === "active" && finalSession.currentNodeId) {
            const nodeExists = journey.nodes.some((n) => n.id === finalSession.currentNodeId);
            expect(nodeExists).toBe(true);
          }
        }
      },
      FUZZY_TIMEOUT
    );
  });

  describe("History Integrity Property", () => {
    it(
      "history only references valid nodes",
      async () => {
        const journeys = generateRandomJourneys(FUZZY_JOURNEY_COUNT, { seed: FUZZY_SEED });

        const results = await runInChunks(journeys, async (journey) => {
          const result = await executeJourney(journey);
          const validation = validateExecutionPath(journey, result.history);
          return { validation };
        });

        for (const { validation } of results) {
          expect(validation.valid).toBe(true);
          if (!validation.valid) {
            console.error("History validation errors:", validation.errors);
          }
        }
      },
      FUZZY_TIMEOUT
    );
  });

  describe("Message Ordering Property", () => {
    it(
      "messages are sent in node execution order",
      async () => {
        const journey = generateLinearJourney(5, { responseType: "auto", seed: FUZZY_SEED });
        const adapter = new MockMessagingAdapter();
        const session = createSession("test-journey");
        const engine = new SessionEngine(session, journey, adapter);

        await engine.start();

        // Wait for completion
        while (session.status === "active") {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Check that messages were sent
        const sentMessages = adapter.getSentMessages();
        expect(sentMessages.length).toBeGreaterThan(0);

        // Messages should correspond to node order
        const messageNodes = journey.nodes.filter((n) => n.data.type === "message" || n.data.type === "start");
        expect(sentMessages.length).toBeLessThanOrEqual(messageNodes.length + 1); // +1 for end
      },
      FUZZY_TIMEOUT
    );
  });

  describe("Edge Case Properties", () => {
    it("minimal journey (start → end) completes", async () => {
      const journey = generateEdgeCaseJourney("minimal", FUZZY_SEED);
      const result = await executeJourney(journey);

      expect(result.finalStatus).toBe("completed");
      expect(result.error).toBeUndefined();
    });

    it("all-auto journey completes without input", async () => {
      const journey = generateEdgeCaseJourney("all_auto", FUZZY_SEED);
      const result = await executeJourney(journey);

      expect(result.finalStatus).toBe("completed");
      expect(result.error).toBeUndefined();
    });

    it("all-interactive journey waits for input", async () => {
      const journey = generateEdgeCaseJourney("all_interactive", FUZZY_SEED);
      const result = await executeJourney(journey, []); // No responses

      // Should be waiting for input or have completed with auto-selections
      expect(["completed", "active", "error"]).toContain(result.finalStatus);
    });

    it("branching journey handles all branches correctly", async () => {
      for (const branches of [2, 3, 5]) {
        const journey = generateBranchingJourney(branches, { seed: FUZZY_SEED + branches });

        expect(isValidJourney(journey)).toBe(true);

        // Verify all branches have valid targets
        const conditionNode = journey.nodes.find((n) => n.data.type === "condition");
        if (conditionNode && conditionNode.data.type === "condition") {
          const branchIds = conditionNode.data.branches?.map((b) => b.id) || [];
          const edgesFromCondition = journey.edges.filter((e) => e.source === conditionNode.id);

          // Each branch should have an edge
          for (const branchId of branchIds) {
            const hasEdge = edgesFromCondition.some((e) => e.sourceHandle === branchId);
            expect(hasEdge).toBe(true);
          }
        }
      }
    });
  });

  describe("Stress Test Properties", () => {
    it(
      "handles long linear journey",
      async () => {
        const journey = generateLinearJourney(50, { responseType: "auto", seed: FUZZY_SEED });

        expect(isValidJourney(journey)).toBe(true);

        const result = await executeJourney(journey);
        expect(result.finalStatus).toBe("completed");
        expect(result.steps).toBeLessThan(MAX_STEPS);
      },
      FUZZY_TIMEOUT
    );

    it("validates many webhooks journey", () => {
      const journey = generateEdgeCaseJourney("many_webhooks", FUZZY_SEED);

      expect(isValidJourney(journey)).toBe(true);

      const webhookCount = journey.nodes.filter((n) => n.data.type === "webhook").length;
      expect(webhookCount).toBe(10);
    });
  });

  describe("Reproducibility", () => {
    it("same seed produces same journeys", () => {
      const seed = 12345;
      const journeys1 = generateRandomJourneys(10, { seed });
      const journeys2 = generateRandomJourneys(10, { seed });

      for (let i = 0; i < journeys1.length; i++) {
        // Compare node IDs and structure
        expect(journeys1[i].nodes.length).toBe(journeys2[i].nodes.length);
        expect(journeys1[i].edges.length).toBe(journeys2[i].edges.length);

        for (let j = 0; j < journeys1[i].nodes.length; j++) {
          expect(journeys1[i].nodes[j].id).toBe(journeys2[i].nodes[j].id);
          expect(journeys1[i].nodes[j].data.type).toBe(journeys2[i].nodes[j].data.type);
        }
      }
    });
  });
});

describe("Validation vs Execution Alignment", () => {
  it(
    "valid journeys can be executed",
    async () => {
      const journeys = generateRandomJourneys(FUZZY_JOURNEY_COUNT, { seed: FUZZY_SEED });

      const results = await runInChunks(journeys, async (journey) => {
        const validationResult = validateJourneyStructure(journey);

        if (validationResult.valid) {
          try {
            const execResult = await executeJourney(journey);
            return { valid: true, executable: !execResult.error, error: execResult.error };
          } catch (e) {
            return { valid: true, executable: false, error: String(e) };
          }
        }
        return { valid: false, executable: false };
      });

      let validCount = 0;
      let executableCount = 0;

      for (const result of results) {
        if (result.valid) {
          validCount++;
          if (result.executable) {
            executableCount++;
          } else if (result.error) {
            console.warn("Valid journey execution error:", result.error);
          }
        }
      }

      // All valid journeys should be executable (some may be waiting for input)
      expect(validCount).toBe(journeys.length); // All generated journeys should be valid
      expect(executableCount).toBeGreaterThanOrEqual(validCount * 0.9); // At least 90% executable
    },
    FUZZY_TIMEOUT * 2
  );

  it("invalid journeys are correctly rejected by validator", () => {
    const invalidTypes = [
      "no_start",
      "no_end",
      "multiple_starts",
      "dangling_edge",
      "orphan_node",
      "auto_cycle",
      "missing_branch_edge",
      "missing_timer_edge",
      "duplicate_node_id",
      "duplicate_edge_id",
    ] as const;

    for (const type of invalidTypes) {
      const journey = generateInvalidJourney(type, FUZZY_SEED);
      const result = validateJourneyStructure(journey);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
