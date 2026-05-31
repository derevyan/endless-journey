import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@journey/db";
import { nodeOutputs, journeySessions, clients, organization, journeys } from "@journey/db/schema";
import { createNodeOutputsStore } from "../node-outputs-store";
import type { NodeOutput } from "@journey/schemas";
import { eq } from "drizzle-orm";

/**
 * Agent Node Outputs Persistence Tests (Regression for Arina's Scenario)
 *
 * These tests ensure that agent node outputs with complex data structures
 * (including Date objects in conversation history) are correctly persisted
 * to the database and can be retrieved for impersonate mode.
 *
 * Root cause: Arina's session executed the alex-agent node but the agent's
 * conversation history contained Date objects that weren't properly serialized
 * when saving to the database. The TypeError caused 100% data loss.
 *
 * See: https://github.com/[org]/journey/issues/[number] (Impersonate mode shows "No outputs")
 */
describe("Agent Node Outputs Persistence (Arina's Scenario)", () => {
  let testOrgId: string;
  let testClientId: string;
  let testSessionId: string;
  let testJourneyIds: string[] = [];
  let store: ReturnType<typeof createNodeOutputsStore>;

  beforeAll(async () => {
    // Create unique test identifiers (UUIDs)
    testOrgId = randomUUID();
    testClientId = randomUUID();

    // Create test organization
    await db.insert(organization).values({
      id: testOrgId,
      name: `Test Organization ${testOrgId}`,
    });

    // Create test client (simulating Arina)
    await db
      .insert(clients)
      .values({
        id: testClientId,
        platform: "telegram",
        platformUserId: "test-agent-arina",
        organizationId: testOrgId,
        firstName: "Arina",
      });

    store = createNodeOutputsStore();
  });

  beforeEach(async () => {
    // Create new test journey for each test
    const journeyId = randomUUID();
    testJourneyIds.push(journeyId);

    await db.insert(journeys).values({
      id: journeyId,
      organizationId: testOrgId,
      name: `Test Journey ${journeyId.slice(0, 8)}`,
      configuration: { nodes: [], edges: [] },
    });

    // Create new test session for each test
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: journeyId,
        organizationId: testOrgId,
        currentNodeId: "alex-agent",
      })
      .returning();

    testSessionId = session.id;
  });

  afterAll(async () => {
    // Cleanup all test data
    if (testSessionId) {
      await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, testSessionId));
      await db.delete(journeySessions).where(eq(journeySessions.id, testSessionId));
    }
    if (testJourneyIds.length > 0) {
      for (const journeyId of testJourneyIds) {
        await db.delete(journeys).where(eq(journeys.id, journeyId));
      }
    }
    if (testClientId) {
      await db.delete(clients).where(eq(clients.id, testClientId));
    }
    if (testOrgId) {
      await db.delete(organization).where(eq(organization.id, testOrgId));
    }
  });

  it("should persist agent conversation with timestamps", async () => {
    // This simulates the exact alex-agent node output that failed for Arina
    const agentOutput: NodeOutput = {
      nodeId: "alex-agent",
      nodeLabel: "AI Agent",
      nodeType: "agent",
      executedAt: new Date("2026-01-04T10:00:00Z").toISOString(),
      data: {
        // Agent handler creates this structure
        conversationHistory: [
          {
            role: "user",
            content: "Hello, can you help me?",
            timestamp: new Date("2026-01-04T10:00:00Z"), // ← Date object
          },
          {
            role: "assistant",
            content: "Of course! I'm here to help.",
            timestamp: new Date("2026-01-04T10:00:02Z"), // ← Date object
          },
          {
            role: "user",
            content: "What services do you offer?",
            timestamp: new Date("2026-01-04T10:00:05Z"), // ← Date object
          },
          {
            role: "assistant",
            content: "We offer consulting, development, and support services.",
            timestamp: new Date("2026-01-04T10:00:08Z"), // ← Date object
          },
        ],
        // Agent state tracking
        state: {
          lastUpdated: new Date("2026-01-04T10:00:08Z"), // ← Date object
          messagesExchanged: 4,
          topicsCovered: ["services"],
          userSentiment: "positive",
        },
        // Token usage tracking (includes timestamps)
        usage: {
          inputTokens: 150,
          outputTokens: 120,
          totalTokens: 270,
          recordedAt: new Date("2026-01-04T10:00:08Z"), // ← Date object
        },
      },
    };

    // Should NOT throw TypeError about Date objects
    // This was the exact error that occurred for Arina:
    // TypeError [ERR_INVALID_ARG_TYPE]: Received an instance of Date
    await expect(
      store.saveOutputs(testSessionId, { "alex-agent": agentOutput })
    ).resolves.not.toThrow();

    // Verify data was actually persisted to database
    const persisted = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, testSessionId));

    expect(persisted).toHaveLength(1);
    expect(persisted[0].nodeId).toBe("alex-agent");
    expect(persisted[0].nodeType).toBe("agent");
    expect(persisted[0].sanitizedLabel).toBe("alex-agent");

    // Verify data integrity - all Dates converted to ISO strings
    const data = persisted[0].data as any;
    expect(data.conversationHistory).toBeDefined();
    expect(data.conversationHistory).toHaveLength(4);

    // Check that all timestamps in history are ISO strings (not Date objects)
    for (let i = 0; i < data.conversationHistory.length; i++) {
      const msg = data.conversationHistory[i];
      expect(typeof msg.timestamp).toBe("string");
      // Verify ISO format by parsing
      expect(() => new Date(msg.timestamp)).not.toThrow();
      expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }

    // Check state timestamps
    expect(typeof data.state.lastUpdated).toBe("string");
    expect(data.state.lastUpdated).toBe("2026-01-04T10:00:08.000Z");

    // Check usage timestamps
    expect(typeof data.usage.recordedAt).toBe("string");
    expect(data.usage.recordedAt).toBe("2026-01-04T10:00:08.000Z");
  });

  it("should allow impersonation with full output visibility", async () => {
    // Create multiple node outputs (simulating full session execution)
    const outputs: Record<string, NodeOutput> = {
      // Message node (typically doesn't have data but included for completeness)
      "start-message": {
        nodeId: "start-message",
        nodeLabel: "Start Message",
        nodeType: "message",
        executedAt: new Date("2026-01-04T09:59:00Z").toISOString(),
        data: { sentAt: new Date("2026-01-04T09:59:00Z") },
      },
      // Webhook node output
      "fetch-data": {
        nodeId: "fetch-data",
        nodeLabel: "Fetch User Data",
        nodeType: "webhook",
        executedAt: new Date("2026-01-04T09:59:30Z").toISOString(),
        data: {
          userId: "user-123",
          fetchedAt: new Date("2026-01-04T09:59:30Z"),
          userData: {
            name: "Arina",
            email: "arina@example.com",
          },
        },
      },
      // Condition node output
      "check-status": {
        nodeId: "check-status",
        nodeLabel: "Check User Status",
        nodeType: "condition",
        executedAt: new Date("2026-01-04T09:59:45Z").toISOString(),
        data: {
          passed: true,
          checkTime: new Date("2026-01-04T09:59:45Z"),
          conditions: {
            isActive: true,
            hasSubscription: true,
            lastLogin: new Date("2026-01-04T08:30:00Z"),
          },
        },
      },
      // Agent node output (the one that was failing)
      "alex-agent": {
        nodeId: "alex-agent",
        nodeLabel: "AI Agent",
        nodeType: "agent",
        executedAt: new Date("2026-01-04T10:00:00Z").toISOString(),
        data: {
          conversationHistory: [
            {
              role: "user",
              content: "Hello",
              timestamp: new Date("2026-01-04T10:00:00Z"),
            },
            {
              role: "assistant",
              content: "Hi there!",
              timestamp: new Date("2026-01-04T10:00:02Z"),
            },
          ],
          state: {
            lastUpdated: new Date("2026-01-04T10:00:02Z"),
          },
        },
      },
    };

    // Persist all outputs at once (simulating session finalization)
    await expect(store.saveOutputs(testSessionId, outputs)).resolves.not.toThrow();

    // Verify all outputs were persisted
    const persisted = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, testSessionId));

    expect(persisted).toHaveLength(4);

    // Verify each node type exists
    const nodeTypes = persisted.map((o) => o.nodeType).sort();
    expect(nodeTypes).toEqual(["agent", "condition", "message", "webhook"]);

    // Load outputs for impersonate mode (simulating getSessionWithInteractions)
    const loaded = await store.loadOutputs(testSessionId);

    // Verify all outputs are accessible
    expect(Object.keys(loaded)).toHaveLength(4);
    expect(loaded["alex-agent"]).toBeDefined();
    expect(loaded["fetch-data"]).toBeDefined();
    expect(loaded["check-status"]).toBeDefined();
    expect(loaded["start-message"]).toBeDefined();

    // Verify impersonate mode would show data (no more "No outputs" message)
    expect(Object.keys(loaded).length).toBeGreaterThan(0);

    // Verify data structure is intact for impersonate reconstruction
    const agentData = loaded["alex-agent"].data as any;
    expect(agentData.conversationHistory).toBeDefined();
    expect(agentData.conversationHistory[0].timestamp).toBe("2026-01-04T10:00:00.000Z");
  });

  it("should recover from cache miss by loading from database", async () => {
    // Simulate the scenario described in state-persistence.ts comments:
    // "Load outputs on cache miss" after Redis cache expires

    const agentOutput: NodeOutput = {
      nodeId: "alex-agent",
      nodeLabel: "AI Agent",
      nodeType: "agent",
      executedAt: new Date("2026-01-04T10:00:00Z").toISOString(),
      data: {
        conversationHistory: [
          {
            role: "user",
            content: "Cache test",
            timestamp: new Date("2026-01-04T10:00:00Z"),
          },
          {
            role: "assistant",
            content: "Recovered from database",
            timestamp: new Date("2026-01-04T10:00:02Z"),
          },
        ],
      },
    };

    // Step 1: Save to database (persistent storage)
    await store.saveOutputs(testSessionId, { "alex-agent": agentOutput });

    // Step 2: Simulate cache miss - clear in-memory state
    // (In real scenario, Redis would have expired the session)

    // Step 3: Load from database for recovery
    const recovered = await store.loadOutputs(testSessionId);

    // Verify complete recovery of agent state
    expect(recovered["alex-agent"]).toBeDefined();
    const recoveredData = recovered["alex-agent"].data as any;
    expect(recoveredData.conversationHistory).toHaveLength(2);

    // Verify timestamps are still valid ISO strings after round-trip
    for (const msg of recoveredData.conversationHistory) {
      expect(typeof msg.timestamp).toBe("string");
      expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }

    // Verify conversation history is intact
    expect(recoveredData.conversationHistory[0].content).toBe("Cache test");
    expect(recoveredData.conversationHistory[1].content).toBe("Recovered from database");
  });

  it("should handle questionnaire outputs with Date objects", async () => {
    // Arina's session also executed glubina-questionnaire node
    // Verify questionnaire outputs are also properly handled

    const questionnaireOutput: NodeOutput = {
      nodeId: "glubina-questionnaire",
      nodeLabel: "Questionnaire",
      nodeType: "questionnaire",
      executedAt: new Date("2026-01-04T09:58:00Z").toISOString(),
      data: {
        responses: [
          {
            question: "What's your name?",
            answer: "Arina",
            respondedAt: new Date("2026-01-04T09:58:10Z"),
          },
          {
            question: "What's your email?",
            answer: "arina@example.com",
            respondedAt: new Date("2026-01-04T09:58:20Z"),
          },
          {
            question: "How can we help?",
            answer: "I need consulting services",
            respondedAt: new Date("2026-01-04T09:58:35Z"),
          },
        ],
        metadata: {
          completedAt: new Date("2026-01-04T09:58:35Z"),
          timeSpent: 35000, // milliseconds
        },
      },
    };

    // Should handle questionnaire outputs the same way
    await expect(
      store.saveOutputs(testSessionId, { "glubina-questionnaire": questionnaireOutput })
    ).resolves.not.toThrow();

    // Verify persistence
    const persisted = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, testSessionId));

    expect(persisted).toHaveLength(1);
    expect(persisted[0].nodeType).toBe("questionnaire");

    // Verify timestamps were converted
    const data = persisted[0].data as any;
    for (const response of data.responses) {
      expect(typeof response.respondedAt).toBe("string");
      expect(response.respondedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
    expect(typeof data.metadata.completedAt).toBe("string");
  });
});
