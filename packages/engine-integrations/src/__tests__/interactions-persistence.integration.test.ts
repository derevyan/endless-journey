/**
 * Interactions Table Persistence Integration Tests
 *
 * Tests that verify ALL session events (user messages, engine messages, etc.)
 * are properly persisted to the interactions table for event sourcing,
 * analytics, and conversation history recovery after cache expiry.
 *
 * The interactions table is a universal event log that serves as the
 * fallback when Redis cache expires (24h TTL).
 */

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, interactions, journeySessions, clients, organization, journeys } from "@journey/db";
import { EventTypes } from "@journey/schemas";

describe("Interactions Table Persistence Integration", () => {
  let testOrgId: string;
  let testClientId: string;
  const testSessionIds: string[] = [];
  const testJourneyIds: string[] = [];

  beforeAll(async () => {
    // Create unique test identifiers (UUIDs)
    testOrgId = randomUUID();
    testClientId = randomUUID();

    // Create test organization
    await db.insert(organization).values({
      id: testOrgId,
      name: `Test Organization ${testOrgId}`,
    });

    // Create test client (Telegram user)
    await db.insert(clients).values({
      id: testClientId,
      platform: "telegram",
      platformUserId: `test-user-${testClientId}`,
      organizationId: testOrgId,
      firstName: "Test",
      lastName: "User",
      username: `testuser${testClientId.slice(0, 8)}`,
    });

    // Create test journeys that sessions will reference
    for (let i = 0; i < 5; i++) {
      const journeyId = randomUUID();
      testJourneyIds.push(journeyId);
      await db.insert(journeys).values({
        id: journeyId,
        organizationId: testOrgId,
        name: `Test Journey ${i + 1}`,
        configuration: { nodes: [], edges: [] },
      });
    }
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    for (const sessionId of testSessionIds) {
      await db.delete(interactions).where(eq(interactions.sessionId, sessionId));
      await db.delete(journeySessions).where(eq(journeySessions.id, sessionId));
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

  // ============================================================================
  // USER MESSAGE PERSISTENCE TESTS
  // ============================================================================

  it("should persist user.message events to interactions table", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[0],
        organizationId: testOrgId,
        currentNodeId: "message-node-1",
        status: "active",
        mode: "simulation",
      })
      .returning();

    testSessionIds.push(session.id);

    // Insert user message event into interactions table
    const eventTimestamp = new Date().toISOString();
    await db.insert(interactions).values({
      id: randomUUID(),
      sessionId: session.id,
      type: "user.message",
      nodeId: "message-node-1",
      payload: {
        text: "Hello, this is a test user message",
        userId: testClientId,
      },
      timestamp: new Date(eventTimestamp),
    });

    // Verify user message is saved in interactions table
    const interactionEvents = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, session.id));

    expect(interactionEvents).toHaveLength(1);

    const userEvent = interactionEvents[0];
    expect(userEvent).toMatchObject({
      type: "user.message",
      nodeId: "message-node-1",
      sessionId: session.id,
    });

    expect(userEvent.payload).toMatchObject({
      text: "Hello, this is a test user message",
      userId: testClientId,
    });
  });

  // ============================================================================
  // ENGINE MESSAGE PERSISTENCE TESTS
  // ============================================================================

  it("should persist engine.message events to interactions table", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[1],
        organizationId: testOrgId,
        currentNodeId: "message-node-2",
        status: "active",
        mode: "simulation",
      })
      .returning();

    testSessionIds.push(session.id);

    // Insert engine message event
    const eventTimestamp = new Date().toISOString();
    await db.insert(interactions).values({
      id: randomUUID(),
      sessionId: session.id,
      type: "engine.message",
      nodeId: "message-node-2",
      payload: {
        text: "This is an AI-generated response",
        model: "gpt-4o",
        nodeId: "message-node-2",
      },
      timestamp: new Date(eventTimestamp),
    });

    // Verify engine message is saved
    const interactionEvents = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, session.id));

    expect(interactionEvents).toHaveLength(1);

    const engineEvent = interactionEvents[0];
    expect(engineEvent).toMatchObject({
      type: "engine.message",
      nodeId: "message-node-2",
      sessionId: session.id,
    });

    expect(engineEvent.payload).toMatchObject({
      text: "This is an AI-generated response",
      model: "gpt-4o",
    });
  });

  // ============================================================================
  // MULTI-EVENT SEQUENCE TESTS
  // ============================================================================

  it("should persist all session events in chronological order", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[2],
        organizationId: testOrgId,
        currentNodeId: "message-node-3",
        status: "active",
        mode: "simulation",
      })
      .returning();

    testSessionIds.push(session.id);

    // Simulate a sequence of events over time
    const baseTime = new Date();
    const eventSequence = [
      {
        id: randomUUID(),
        type: "session.started",
        nodeId: "root",
        payload: { journeyId: testJourneyIds[2] },
        timestamp: new Date(baseTime.getTime()),
      },
      {
        id: randomUUID(),
        type: "node.entered",
        nodeId: "message-node-3",
        payload: { nodeType: "agent" },
        timestamp: new Date(baseTime.getTime() + 1000),
      },
      {
        id: randomUUID(),
        type: "user.message",
        nodeId: "message-node-3",
        payload: { text: "First user message" },
        timestamp: new Date(baseTime.getTime() + 2000),
      },
      {
        id: randomUUID(),
        type: "engine.message",
        nodeId: "message-node-3",
        payload: { text: "First AI response" },
        timestamp: new Date(baseTime.getTime() + 3000),
      },
      {
        id: randomUUID(),
        type: "user.message",
        nodeId: "message-node-3",
        payload: { text: "Second user message" },
        timestamp: new Date(baseTime.getTime() + 4000),
      },
      {
        id: randomUUID(),
        type: "engine.message",
        nodeId: "message-node-3",
        payload: { text: "Second AI response" },
        timestamp: new Date(baseTime.getTime() + 5000),
      },
    ];

    // Insert all events
    for (const event of eventSequence) {
      await db.insert(interactions).values({
        id: event.id,
        sessionId: session.id,
        type: event.type,
        nodeId: event.nodeId,
        payload: event.payload,
        timestamp: event.timestamp,
      });
    }

    // Verify all events are saved
    const allEvents = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, session.id));

    expect(allEvents).toHaveLength(6);

    // Verify events are in chronological order
    for (let i = 1; i < allEvents.length; i++) {
      expect(allEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        allEvents[i - 1].timestamp.getTime()
      );
    }

    // Verify specific event types
    expect(allEvents[0].type).toBe("session.started");
    expect(allEvents[1].type).toBe("node.entered");
    expect(allEvents[2].type).toBe("user.message");
    expect(allEvents[3].type).toBe("engine.message");
    expect(allEvents[4].type).toBe("user.message");
    expect(allEvents[5].type).toBe("engine.message");
  });

  // ============================================================================
  // CONVERSATION RECOVERY TESTS
  // ============================================================================

  it("should allow recovery of conversation messages from interactions table", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[3],
        organizationId: testOrgId,
        currentNodeId: "conversation-node",
        status: "active",
        mode: "simulation",
      })
      .returning();

    testSessionIds.push(session.id);

    // Insert multi-turn conversation
    const conversationEvents = [
      {
        id: randomUUID(),
        type: "user.message",
        nodeId: "conversation-node",
        payload: { text: "What is the capital of France?" },
        timestamp: new Date(Date.now()),
      },
      {
        id: randomUUID(),
        type: "engine.message",
        nodeId: "conversation-node",
        payload: { text: "The capital of France is Paris." },
        timestamp: new Date(Date.now() + 1000),
      },
      {
        id: randomUUID(),
        type: "user.message",
        nodeId: "conversation-node",
        payload: { text: "What about Germany?" },
        timestamp: new Date(Date.now() + 2000),
      },
      {
        id: randomUUID(),
        type: "engine.message",
        nodeId: "conversation-node",
        payload: { text: "The capital of Germany is Berlin." },
        timestamp: new Date(Date.now() + 3000),
      },
    ];

    // Insert all conversation events
    for (const event of conversationEvents) {
      await db.insert(interactions).values({
        id: event.id,
        sessionId: session.id,
        type: event.type,
        nodeId: event.nodeId,
        payload: event.payload,
        timestamp: event.timestamp,
      });
    }

    // Simulate cache expiry recovery: query interactions table to reconstruct history
    const recoveredEvents = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, session.id));

    // Verify all conversation events recovered
    expect(recoveredEvents).toHaveLength(4);

    // Verify can extract user messages
    const userMessages = recoveredEvents.filter((e) => e.type === "user.message");
    expect(userMessages).toHaveLength(2);
    expect(userMessages[0].payload).toMatchObject({ text: "What is the capital of France?" });
    expect(userMessages[1].payload).toMatchObject({ text: "What about Germany?" });

    // Verify can extract engine messages
    const engineMessages = recoveredEvents.filter((e) => e.type === "engine.message");
    expect(engineMessages).toHaveLength(2);
    expect(engineMessages[0].payload).toMatchObject({ text: "The capital of France is Paris." });
    expect(engineMessages[1].payload).toMatchObject({
      text: "The capital of Germany is Berlin.",
    });
  });

  // ============================================================================
  // MULTIPLE NODES IN SAME SESSION TESTS
  // ============================================================================

  it("should persist events from multiple nodes in same session", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[4],
        organizationId: testOrgId,
        currentNodeId: "multi-node-1",
        status: "active",
        mode: "simulation",
      })
      .returning();

    testSessionIds.push(session.id);

    // Insert events from different nodes
    const nodes = ["node-1", "node-2", "node-3"];
    for (let i = 0; i < nodes.length; i++) {
      await db.insert(interactions).values({
        id: randomUUID(),
        sessionId: session.id,
        type: "node.entered",
        nodeId: nodes[i],
        payload: { nodeType: "message" },
        timestamp: new Date(Date.now() + i * 1000),
      });

      await db.insert(interactions).values({
        id: randomUUID(),
        sessionId: session.id,
        type: "user.message",
        nodeId: nodes[i],
        payload: { text: `Message in ${nodes[i]}` },
        timestamp: new Date(Date.now() + i * 1000 + 500),
      });
    }

    // Verify all events persisted
    const allEvents = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, session.id));

    expect(allEvents).toHaveLength(6); // 3 nodes × 2 events each

    // Verify events from each node
    for (const nodeId of nodes) {
      const nodeEvents = allEvents.filter((e) => e.nodeId === nodeId);
      expect(nodeEvents.length).toBeGreaterThan(0);
    }
  });

  // ============================================================================
  // DATA INTEGRITY TESTS
  // ============================================================================

  it("should preserve event payload data exactly", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[0],
        organizationId: testOrgId,
        currentNodeId: "integrity-node",
        status: "active",
        mode: "simulation",
      })
      .returning();

    testSessionIds.push(session.id);

    // Create complex payload
    const complexPayload = {
      text: "Complex message",
      userId: testClientId,
      metadata: {
        source: "telegram",
        messageId: 12345,
        chatId: 67890,
      },
      tags: ["urgent", "important"],
      numbers: [1, 2, 3, 4, 5],
      nested: {
        level1: {
          level2: {
            value: "deeply nested",
          },
        },
      },
    };

    // Insert event with complex payload
    await db.insert(interactions).values({
      id: randomUUID(),
      sessionId: session.id,
      type: "user.message",
      nodeId: "integrity-node",
      payload: complexPayload,
      timestamp: new Date(),
    });

    // Retrieve and verify payload integrity
    const [event] = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, session.id));

    expect(event.payload).toEqual(complexPayload);
    const payload = event.payload as Record<string, any>;
    expect(payload.metadata.messageId).toBe(12345);
    expect(payload.nested.level1.level2.value).toBe("deeply nested");
  });

  // ============================================================================
  // TIMESTAMP TESTS
  // ============================================================================

  it("should correctly store and retrieve timestamps", async () => {
    // Create test journey session
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyIds[1],
        organizationId: testOrgId,
        currentNodeId: "timestamp-node",
        status: "active",
        mode: "simulation",
      })
      .returning();

    testSessionIds.push(session.id);

    // Create specific timestamps
    const timestamp1 = new Date("2024-01-15T10:30:00Z");
    const timestamp2 = new Date("2024-01-15T10:35:00Z");

    // Insert events with specific timestamps
    await db.insert(interactions).values([
      {
        id: randomUUID(),
        sessionId: session.id,
        type: "user.message",
        nodeId: "timestamp-node",
        payload: { text: "First message" },
        timestamp: timestamp1,
      },
      {
        id: randomUUID(),
        sessionId: session.id,
        type: "engine.message",
        nodeId: "timestamp-node",
        payload: { text: "First response" },
        timestamp: timestamp2,
      },
    ]);

    // Retrieve and verify timestamps
    const events = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, session.id));

    expect(events[0].timestamp.getTime()).toBe(timestamp1.getTime());
    expect(events[1].timestamp.getTime()).toBe(timestamp2.getTime());

    // Verify can order by timestamp
    const orderedEvents = events.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    expect(orderedEvents[0].payload).toMatchObject({ text: "First message" });
    expect(orderedEvents[1].payload).toMatchObject({ text: "First response" });
  });
});
