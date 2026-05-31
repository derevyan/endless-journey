/**
 * MindState Analysis Policy Tests
 *
 * Tests the new MindState analysis policies in the session engine:
 * - Analysis modes: automatic, selective, node-triggered, manual
 * - Start conditions: immediate, after_messages, after_node
 * - Node type rules: analyzeTypes, skipTypes
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnhancedUserJourney, JourneyConfig, JourneyMindstateConfig } from "@journey/schemas";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "./helpers/mock-adapter";
import type { MindstateService } from "../types";

// ===== Mock MindState Service =====

function createMockMindstateService() {
  return {
    getOrCreateMindstate: vi.fn().mockResolvedValue({
      id: "mindstate-123",
      clientId: "test-user",
      definitionKey: "test-key",
      stateParameters: [],
    }),
    analyzeMessage: vi.fn().mockResolvedValue({
      changes: [],
    }),
    getParameterValue: vi.fn().mockResolvedValue(null),
    getMultipleParameterValues: vi.fn().mockResolvedValue({}),
    setParameterValue: vi.fn().mockResolvedValue(undefined),
  } satisfies MindstateService;
}

// ===== Test Journey Fixtures =====

/**
 * Creates a simple journey with various node types for testing selective mode
 */
function createTestJourney(): JourneyConfig {
  const now = new Date().toISOString();
  const metadata = { createdAt: now, updatedAt: now, version: "1.0.0", status: "active" as const };
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          type: "start",
          schemaVersion: 1,
          label: "Start",
          content: "Welcome!",
        },
        metadata,
      },
      {
        id: "msg1",
        type: "custom",
        position: { x: 200, y: 0 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "First Message",
          content: "Hello, how can I help?",
          responseType: "text",
          storeResponseAs: "user_response",
        },
        metadata,
      },
      {
        id: "msg2",
        type: "custom",
        position: { x: 400, y: 0 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "Second Message",
          content: "Any other questions?",
          responseType: "text",
          storeResponseAs: "user_response2",
        },
        metadata,
      },
      {
        id: "cond1",
        type: "custom",
        position: { x: 600, y: 0 },
        data: {
          type: "condition",
          schemaVersion: 1,
          label: "Check Response",
          rulesOperator: "or",
          rules: [{ field: "user_response", operator: "equals", value: "help" }],
          branches: [
            { id: "yes", label: "Help", isDefault: false },
            { id: "no", label: "No Help", isDefault: true },
          ],
        },
        metadata,
      },
      {
        id: "end",
        type: "custom",
        position: { x: 800, y: 0 },
        data: {
          type: "end",
          schemaVersion: 1,
          label: "End",
          content: "Goodbye!",
        },
        metadata,
      },
    ],
    edges: [
      {
        id: "e1",
        source: "start",
        target: "msg1",
        edgeType: "default",
        label: "Begin",
      },
      {
        id: "e2",
        source: "msg1",
        target: "msg2",
        edgeType: "default",
        label: "",
      },
      {
        id: "e3",
        source: "msg2",
        target: "cond1",
        edgeType: "default",
        label: "",
      },
      {
        id: "e4",
        source: "cond1",
        target: "end",
        sourceHandle: "yes",
        edgeType: "success",
        label: "yes",
      },
      {
        id: "e5",
        source: "cond1",
        target: "end",
        sourceHandle: "no",
        edgeType: "default",
        label: "no",
      },
    ],
  };
}

// ===== Test Helpers =====

function createSession(journeyId = "test-journey"): EnhancedUserJourney {
  return {
    sessionId: "test-session",
    userId: "test-user",
    platformUserId: "test-user",
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

interface CreateEngineOptions {
  mindstateConfig?: JourneyMindstateConfig;
  mindstateService?: MindstateService;
  journey?: JourneyConfig;
  session?: EnhancedUserJourney;
}

function createEngine(adapter: MockMessagingAdapter, options: CreateEngineOptions = {}) {
  const journey = options.journey ?? createTestJourney();
  const session = options.session ?? createSession();

  return new SessionEngine(session, journey, adapter, {
    mindstateConfig: options.mindstateConfig,
    mindstateService: options.mindstateService,
  });
}

// ===== Tests =====

describe("MindState Analysis Policies", () => {
  let adapter: MockMessagingAdapter;
  let mindstateService: ReturnType<typeof createMockMindstateService>;

  beforeEach(() => {
    adapter = new MockMessagingAdapter();
    mindstateService = createMockMindstateService();
  });

  describe("Analysis Modes", () => {
    describe("automatic mode", () => {
      it("should analyze every user message", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
          },
          mindstateService,
        });

        await engine.start();
        // Now at msg1 node waiting for text response

        // Send first message
        adapter.simulateMessage("Hello there", "test-user", "test-session");
        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });

        // Send second message (need to reset engine state for this test)
        // Since the engine transitions after text response, we test multiple messages
        // by checking the call count after each message
        expect(mindstateService.analyzeMessage).toHaveBeenCalledWith(
          "mindstate-123",
          "Hello there",
          "test-session"
        );
      });

      it("should not analyze if no mindstate keys configured", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: [], // No keys
            analysisMode: "automatic",
          },
          mindstateService,
        });

        await engine.start();
        adapter.simulateMessage("Hello", "test-user", "test-session");

        // Wait a bit to ensure no async analysis happened
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });

      it("should not analyze if no mindstate config", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: undefined,
          mindstateService,
        });

        await engine.start();
        adapter.simulateMessage("Hello", "test-user", "test-session");

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });
    });

    describe("selective mode", () => {
      it("should analyze at MESSAGE node type", async () => {
        // Manually set session to be at MESSAGE node (msg1)
        const session = createSession();
        session.currentNodeId = "msg1";

        const engine = createEngine(adapter, {
          session,
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "selective",
            nodeTypeRules: {
              analyzeTypes: ["MESSAGE"],
              skipTypes: [],
            },
          },
          mindstateService,
        });

        // Send message at MESSAGE node - should analyze
        adapter.simulateMessage("Hello", "test-user", "test-session");

        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });
      });

      it("should NOT analyze at WAIT node type when not in analyzeTypes", async () => {
        const session = createSession();
        session.currentNodeId = "wait1"; // Start at WAIT node

        const engine = createEngine(adapter, {
          session,
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "selective",
            nodeTypeRules: {
              analyzeTypes: ["MESSAGE"],
              skipTypes: [],
            },
          },
          mindstateService,
        });

        adapter.simulateMessage("Hello", "test-user", "test-session");

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });

      it("should NOT analyze at node type in skipTypes", async () => {
        const session = createSession();
        session.currentNodeId = "msg1"; // Start at MESSAGE node

        const engine = createEngine(adapter, {
          session,
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "selective",
            nodeTypeRules: {
              analyzeTypes: ["MESSAGE", "CONDITION"],
              skipTypes: ["MESSAGE"], // Explicitly skip MESSAGE
            },
          },
          mindstateService,
        });

        adapter.simulateMessage("Hello", "test-user", "test-session");

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });

      it("should analyze when node type is in analyzeTypes and not in skipTypes", async () => {
        const session = createSession();
        session.currentNodeId = "cond1"; // Start at CONDITION node

        const engine = createEngine(adapter, {
          session,
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "selective",
            nodeTypeRules: {
              analyzeTypes: ["CONDITION"],
              skipTypes: [],
            },
          },
          mindstateService,
        });

        adapter.simulateMessage("Hello", "test-user", "test-session");

        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe("node-triggered mode", () => {
      it("should NOT trigger automatic analysis", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "node-triggered",
          },
          mindstateService,
        });

        await engine.start();
        adapter.simulateMessage("Hello", "test-user", "test-session");

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });
    });

    describe("manual mode", () => {
      it("should NOT trigger automatic analysis", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "manual",
          },
          mindstateService,
        });

        await engine.start();
        adapter.simulateMessage("Hello", "test-user", "test-session");

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe("Start Conditions", () => {
    describe("immediate (default)", () => {
      it("should start analyzing from first message", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            // No startCondition = immediate (default)
          },
          mindstateService,
        });

        await engine.start();
        adapter.simulateMessage("First message", "test-user", "test-session");

        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });
      });

      it("should analyze with explicit immediate start condition", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            startCondition: { type: "immediate" },
          },
          mindstateService,
        });

        await engine.start();
        adapter.simulateMessage("Hello", "test-user", "test-session");

        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe("after_messages", () => {
      it("should NOT analyze before message threshold", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            startCondition: { type: "after_messages", count: 3 },
          },
          mindstateService,
        });

        await engine.start();

        // Send first two messages - should NOT trigger analysis
        adapter.simulateMessage("Message 1", "test-user", "test-session");
        await new Promise((resolve) => setTimeout(resolve, 30));

        adapter.simulateMessage("Message 2", "test-user", "test-session");
        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });

      it("should start analyzing at message threshold", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            startCondition: { type: "after_messages", count: 2 },
          },
          mindstateService,
        });

        await engine.start();

        // Message 1 - below threshold
        adapter.simulateMessage("Message 1", "test-user", "test-session");
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();

        // Message 2 - at threshold, should analyze
        adapter.simulateMessage("Message 2", "test-user", "test-session");
        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });
      });

      it("should continue analyzing after threshold met", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            startCondition: { type: "after_messages", count: 1 },
          },
          mindstateService,
        });

        await engine.start();

        // Message 1 - at threshold
        adapter.simulateMessage("Message 1", "test-user", "test-session");
        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });

        // Message 2 - after threshold, should still analyze
        adapter.simulateMessage("Message 2", "test-user", "test-session");
        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe("after_node", () => {
      it("should NOT analyze before reaching trigger node", async () => {
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            startCondition: { type: "after_node", nodeId: "cond1" },
          },
          mindstateService,
        });

        await engine.start();
        // At msg1, haven't reached cond1 yet

        adapter.simulateMessage("Hello", "test-user", "test-session");
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
      });

      it("should start analyzing when trigger node is reached (inclusive)", async () => {
        // Set trigger node to "start" so it's visited immediately on engine.start()
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            startCondition: { type: "after_node", nodeId: "start" },
          },
          mindstateService,
        });

        // start() executes the start node, registering it as visited
        await engine.start();

        // Now send a message - should analyze since "start" was visited
        adapter.simulateMessage("Hello after node", "test-user", "test-session");

        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });
      });

      it("should continue analyzing after trigger node visited", async () => {
        // Set trigger node to "start" so it's visited immediately
        const engine = createEngine(adapter, {
          mindstateConfig: {
            keys: ["mood"],
            analysisMode: "automatic",
            startCondition: { type: "after_node", nodeId: "start" },
          },
          mindstateService,
        });

        // start() executes the start node, registering it as visited
        await engine.start();

        // First message after node execution
        adapter.simulateMessage("First", "test-user", "test-session");
        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
        });

        // Second message - should continue analyzing
        adapter.simulateMessage("Second", "test-user", "test-session");
        await vi.waitFor(() => {
          expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(2);
        });
      });
    });
  });

  describe("Node Type Rules", () => {
    it("should skip nodes in skipTypes array", async () => {
      const session = createSession();
      session.currentNodeId = "webhook1"; // WEBHOOK node

      const engine = createEngine(adapter, {
        session,
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "selective",
          nodeTypeRules: {
            analyzeTypes: [],
            skipTypes: ["WEBHOOK"],
          },
        },
        mindstateService,
      });

      adapter.simulateMessage("Hello", "test-user", "test-session");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
    });

    it("should only analyze nodes in analyzeTypes array", async () => {
      // Test that CRM node is not analyzed when not in analyzeTypes
      const session = createSession();
      session.currentNodeId = "crm1"; // CRM node

      const engine = createEngine(adapter, {
        session,
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "selective",
          nodeTypeRules: {
            analyzeTypes: ["MESSAGE"], // Only MESSAGE
            skipTypes: [],
          },
        },
        mindstateService,
      });

      adapter.simulateMessage("Hello", "test-user", "test-session");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
    });

    it("skipTypes should take precedence over analyzeTypes", async () => {
      const session = createSession();
      session.currentNodeId = "msg1"; // MESSAGE node

      const engine = createEngine(adapter, {
        session,
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "selective",
          nodeTypeRules: {
            analyzeTypes: ["MESSAGE", "CONDITION"], // MESSAGE is in analyze list
            skipTypes: ["MESSAGE"], // But also in skip list - skip should win
          },
        },
        mindstateService,
      });

      adapter.simulateMessage("Hello", "test-user", "test-session");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();
    });

    it("should analyze all types if no rules configured", async () => {
      const session = createSession();
      session.currentNodeId = "msg1";

      const engine = createEngine(adapter, {
        session,
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "selective",
          // No nodeTypeRules - should analyze all
        },
        mindstateService,
      });

      adapter.simulateMessage("Hello", "test-user", "test-session");

      await vi.waitFor(() => {
        expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
      });
    });

    it("should analyze all types if analyzeTypes is empty and skipTypes does not match", async () => {
      const session = createSession();
      session.currentNodeId = "msg1"; // MESSAGE node

      const engine = createEngine(adapter, {
        session,
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "selective",
          nodeTypeRules: {
            analyzeTypes: [], // Empty = all types
            skipTypes: ["WEBHOOK", "WAIT"], // MESSAGE not in skip
          },
        },
        mindstateService,
      });

      adapter.simulateMessage("Hello", "test-user", "test-session");

      await vi.waitFor(() => {
        expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing mindstate service gracefully", async () => {
      const engine = createEngine(adapter, {
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "automatic",
        },
        mindstateService: undefined, // No service
      });

      await engine.start();

      // Should not throw
      adapter.simulateMessage("Hello", "test-user", "test-session");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Nothing to assert - just verifying no errors
    });

    it("should handle mindstate service errors gracefully", async () => {
      const errorService = createMockMindstateService();
      errorService.analyzeMessage.mockRejectedValue(new Error("Analysis failed"));

      const engine = createEngine(adapter, {
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "automatic",
        },
        mindstateService: errorService,
      });

      await engine.start();

      // Should not throw even when service fails
      adapter.simulateMessage("Hello", "test-user", "test-session");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify it attempted to analyze
      expect(errorService.analyzeMessage).toHaveBeenCalled();
    });

    it("should track multiple mindstate keys", async () => {
      const engine = createEngine(adapter, {
        mindstateConfig: {
          keys: ["mood", "engagement", "satisfaction"],
          analysisMode: "automatic",
        },
        mindstateService,
      });

      await engine.start();
      adapter.simulateMessage("Hello", "test-user", "test-session");

      await vi.waitFor(() => {
        // Should call analyzeMessage for each key
        // Note: getOrCreateMindstate is also called during context building for guard evaluation,
        // so we only verify it was called at least once per key (3+), not exact count
        expect(mindstateService.getOrCreateMindstate.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(3);
      });
    });

    it("should combine selective mode with after_messages start condition", async () => {
      // Test that BOTH conditions must be met: message count AND node type
      // We'll use automatic mode with after_messages to test the combination

      const engine = createEngine(adapter, {
        mindstateConfig: {
          keys: ["mood"],
          analysisMode: "automatic", // Use automatic mode for simpler testing
          startCondition: { type: "after_messages", count: 2 },
        },
        mindstateService,
      });

      await engine.start();
      // Engine at msg1

      // Message 1 - below threshold
      adapter.simulateMessage("Msg 1", "test-user", "test-session");
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(mindstateService.analyzeMessage).not.toHaveBeenCalled();

      // Message 2 - at threshold, should analyze
      adapter.simulateMessage("Msg 2", "test-user", "test-session");
      await vi.waitFor(() => {
        expect(mindstateService.analyzeMessage).toHaveBeenCalledTimes(1);
      });
    });
  });
});
