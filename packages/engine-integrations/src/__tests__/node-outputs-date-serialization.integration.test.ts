import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@journey/db";
import { nodeOutputs, journeySessions, clients, organization, journeys } from "@journey/db/schema";
import { createNodeOutputsStore } from "../node-outputs-store";
import type { NodeOutput } from "@journey/schemas";
import { eq } from "drizzle-orm";

describe("Node Outputs Date Serialization (Regression Tests)", () => {
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

    // Create test client
    await db
      .insert(clients)
      .values({
        id: testClientId,
        platform: "telegram",
        platformUserId: "test-date-serialization",
        organizationId: testOrgId,
        firstName: "Test",
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
        currentNodeId: "test-node",
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

  it("should persist outputs with Date objects in data field", async () => {
    // This is the EXACT scenario that failed for Arina's agent node
    const agentOutput: NodeOutput = {
      nodeId: "alex-agent",
      nodeLabel: "AI Agent",
      nodeType: "agent",
      executedAt: new Date().toISOString(),
      data: {
        conversationHistory: [
          {
            role: "user",
            content: "Hello",
            timestamp: new Date("2026-01-04T10:00:00Z"), // ← Date object here!
          },
          {
            role: "assistant",
            content: "Hi there!",
            timestamp: new Date("2026-01-04T10:00:05Z"), // ← Date object here!
          },
        ],
        state: {
          lastUpdated: new Date("2026-01-04T10:00:10Z"), // ← Date object here!
          questionsAsked: 2,
        },
      },
    };

    // Should NOT throw TypeError about Date objects
    await expect(
      store.saveOutputs(testSessionId, { "alex-agent": agentOutput })
    ).resolves.not.toThrow();

    // Verify data was actually persisted
    const persisted = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, testSessionId));

    expect(persisted).toHaveLength(1);
    expect(persisted[0].sanitizedLabel).toBe("alex-agent");

    // Verify Dates were converted to ISO strings in JSON
    const data = persisted[0].data as any;
    expect(data.conversationHistory[0].timestamp).toBe("2026-01-04T10:00:00.000Z");
    expect(data.conversationHistory[1].timestamp).toBe("2026-01-04T10:00:05.000Z");
    expect(data.state.lastUpdated).toBe("2026-01-04T10:00:10.000Z");
  });

  it("should handle nested Date objects in complex structures", async () => {
    const complexOutput: NodeOutput = {
      nodeId: "test-node",
      nodeLabel: "Test",
      nodeType: "webhook",
      executedAt: new Date().toISOString(),
      data: {
        level1: {
          level2: {
            level3: {
              deepDate: new Date("2026-01-01T00:00:00Z"),
            },
          },
        },
        arrayWithDates: [
          { timestamp: new Date("2026-01-02T00:00:00Z") },
          { timestamp: new Date("2026-01-03T00:00:00Z") },
        ],
      },
    };

    await expect(
      store.saveOutputs(testSessionId, { "test-node": complexOutput })
    ).resolves.not.toThrow();

    const persisted = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, testSessionId));

    const data = persisted[0].data as any;
    expect(data.level1.level2.level3.deepDate).toBe("2026-01-01T00:00:00.000Z");
    expect(data.arrayWithDates[0].timestamp).toBe("2026-01-02T00:00:00.000Z");
    expect(data.arrayWithDates[1].timestamp).toBe("2026-01-03T00:00:00.000Z");
  });

  it("should preserve non-Date data correctly", async () => {
    const mixedOutput: NodeOutput = {
      nodeId: "test-node",
      nodeLabel: "Test",
      nodeType: "condition",
      executedAt: new Date().toISOString(),
      data: {
        stringValue: "test",
        numberValue: 42,
        booleanValue: true,
        nullValue: null,
        arrayValue: [1, 2, 3],
        objectValue: { key: "value" },
        dateValue: new Date("2026-01-04T12:00:00Z"),
      },
    };

    await store.saveOutputs(testSessionId, { "test-node": mixedOutput });

    const persisted = await db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, testSessionId));

    const data = persisted[0].data as any;
    expect(data.stringValue).toBe("test");
    expect(data.numberValue).toBe(42);
    expect(data.booleanValue).toBe(true);
    expect(data.nullValue).toBeNull();
    expect(data.arrayValue).toEqual([1, 2, 3]);
    expect(data.objectValue).toEqual({ key: "value" });
    expect(data.dateValue).toBe("2026-01-04T12:00:00.000Z"); // Date converted
  });

  it("should load outputs and preserve data types", async () => {
    const originalOutput: NodeOutput = {
      nodeId: "test-node",
      nodeLabel: "Test",
      nodeType: "agent",
      executedAt: new Date().toISOString(),
      data: {
        timestamp: new Date("2026-01-04T15:30:00Z"),
        count: 10,
      },
    };

    await store.saveOutputs(testSessionId, { "test-node": originalOutput });
    const loaded = await store.loadOutputs(testSessionId);

    expect(loaded["test-node"]).toBeDefined();
    expect(loaded["test-node"].data).toEqual({
      timestamp: "2026-01-04T15:30:00.000Z", // Date as ISO string
      count: 10,
    });
  });
});

