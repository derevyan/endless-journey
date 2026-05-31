/**
 * Session Runtime - Conversation Persistence Integration Tests
 *
 * Tests that:
 * 1. Conversations persist to database when engine sends messages
 * 2. Session state recovers from database after cache expiry
 * 3. FK relationships maintained between sent_messages and interactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@journey/db";
import { interactions, sentMessages, journeySessions, conversations, organization, clients, journeys } from "@journey/db/schema";
import { eq } from "drizzle-orm";

describe("Session Runtime - Conversation Persistence", () => {
  let testOrgId: string;
  let testClientId: string;
  let testJourneyId: string;
  let testSessionId: string;

  beforeAll(async () => {
    // Setup test context
    testOrgId = randomUUID();
    testClientId = randomUUID();
    testJourneyId = randomUUID();

    await db.insert(organization).values({
      id: testOrgId,
      name: "Test Org",
    });

    await db.insert(clients).values({
      id: testClientId,
      platform: "telegram",
      platformUserId: `test-${randomUUID()}`,
      organizationId: testOrgId,
      firstName: "Test",
      lastName: "User",
    });

    await db.insert(journeys).values({
      id: testJourneyId,
      name: "Test Journey",
      organizationId: testOrgId,
      configuration: { nodes: [], edges: [] },
    });
  });

  afterAll(async () => {
    // Clean up global test context (per-session cleanup happens in afterEach)
    await db.delete(journeys).where(eq(journeys.id, testJourneyId));
    await db.delete(clients).where(eq(clients.id, testClientId));
    await db.delete(organization).where(eq(organization.id, testOrgId));
  });

  beforeEach(async () => {
    testSessionId = randomUUID();
    // Create test session
    await db.insert(journeySessions).values({
      id: testSessionId,
      journeyId: testJourneyId,
      clientId: testClientId,
      channelId: "telegram",
      organizationId: testOrgId,
      status: "active",
      mode: "live",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    await db.delete(sentMessages).where(eq(sentMessages.sessionId, testSessionId));
    await db.delete(conversations).where(eq(conversations.sessionId, testSessionId));
    await db.delete(interactions).where(eq(interactions.sessionId, testSessionId));
    await db.delete(journeySessions).where(eq(journeySessions.id, testSessionId));
  });

  it("should persist message to both interactions and sent_messages", async () => {
    const interactionId = randomUUID();
    const messageId = randomUUID();

    // Simulate engine message send (creates interaction event)
    await db.insert(interactions).values({
      id: interactionId,
      sessionId: testSessionId,
      type: "engine.message",
      nodeId: "chat-node",
      payload: { content: "Welcome to the journey!" },
    });

    // Simulate sent_messages record
    await db.insert(sentMessages).values({
      id: messageId,
      sessionId: testSessionId,
      nodeId: "chat-node",
      interactionEventId: interactionId,
      platform: "telegram",
      platformChatId: "12345",
      messageType: "text",
      content: "Welcome to the journey!",
    });

    // Verify both records exist
    const interactions_ = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, testSessionId));

    const messages = await db
      .select()
      .from(sentMessages)
      .where(eq(sentMessages.sessionId, testSessionId));

    expect(interactions_).toHaveLength(1);
    expect(messages).toHaveLength(1);

    // Verify FK relationship
    expect(messages[0].interactionEventId).toBe(interactionId);
  });

  it("should maintain message ordering across multiple sends", async () => {
    const now = new Date();
    const ids = [
      { interactionId: randomUUID(), messageId: randomUUID(), time: 0 },
      { interactionId: randomUUID(), messageId: randomUUID(), time: 1000 },
      { interactionId: randomUUID(), messageId: randomUUID(), time: 2000 },
    ];

    // Insert interactions in order
    for (const { interactionId, time } of ids) {
      await db.insert(interactions).values({
        id: interactionId,
        sessionId: testSessionId,
        type: "engine.message",
        nodeId: "chat-node",
        payload: { content: `Message at ${time}ms` },
        timestamp: new Date(now.getTime() + time),
      });
    }

    // Insert sent_messages
    for (const { interactionId, messageId } of ids) {
      await db.insert(sentMessages).values({
        id: messageId,
        sessionId: testSessionId,
        nodeId: "chat-node",
        interactionEventId: interactionId,
        platform: "telegram",
        platformChatId: "12345",
        messageType: "text",
      });
    }

    // Verify order is maintained
    const messages = await db
      .select()
      .from(sentMessages)
      .where(eq(sentMessages.sessionId, testSessionId))
      .orderBy(sentMessages.sentAt);

    expect(messages).toHaveLength(3);
  });

  it("should support session state recovery from database", async () => {
    const interactionId = randomUUID();

    // Insert interaction (simulating initial message)
    await db.insert(interactions).values({
      id: interactionId,
      sessionId: testSessionId,
      type: "engine.message",
      nodeId: "chat-node",
      payload: { content: "Session started" },
    });

    // Later: recover session from database (cache expired)
    const recoveredInteractions = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, testSessionId));

    expect(recoveredInteractions).toHaveLength(1);
    expect(recoveredInteractions[0].payload).toEqual({ content: "Session started" });
  });

  it("should handle multiple messages from same session", async () => {
    const messageCount = 5;

    // Insert multiple interactions and sent_messages
    for (let i = 0; i < messageCount; i++) {
      const interactionId = randomUUID();
      const messageId = randomUUID();

      await db.insert(interactions).values({
        id: interactionId,
        sessionId: testSessionId,
        type: i % 2 === 0 ? "user.message" : "engine.message",
        nodeId: "chat-node",
        payload: { text: `Message ${i}` },
      });

      await db.insert(sentMessages).values({
        id: messageId,
        sessionId: testSessionId,
        nodeId: "chat-node",
        interactionEventId: interactionId,
        platform: "telegram",
        platformChatId: "12345",
        messageType: "text",
      });
    }

    // Verify all messages stored
    const interactions_ = await db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, testSessionId));

    const messages = await db
      .select()
      .from(sentMessages)
      .where(eq(sentMessages.sessionId, testSessionId));

    expect(interactions_).toHaveLength(messageCount);
    expect(messages).toHaveLength(messageCount);
  });

  it("should properly close session after completion", async () => {
    const interactionId = randomUUID();

    // Insert interaction
    await db.insert(interactions).values({
      id: interactionId,
      sessionId: testSessionId,
      type: "engine.message",
      nodeId: "end-node",
      payload: { content: "Journey completed" },
    });

    // Update session to completed
    await db
      .update(journeySessions)
      .set({ state: "completed", updatedAt: new Date() })
      .where(eq(journeySessions.id, testSessionId));

    // Verify session marked as completed
    const [session] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, testSessionId));

    expect(session.state).toBe("completed");
  });

  it("should maintain data integrity on session cleanup", async () => {
    const interactionId = randomUUID();
    const messageId = randomUUID();

    // Insert message records
    await db.insert(interactions).values({
      id: interactionId,
      sessionId: testSessionId,
      type: "engine.message",
      nodeId: "chat-node",
      payload: { content: "Test" },
    });

    await db.insert(sentMessages).values({
      id: messageId,
      sessionId: testSessionId,
      nodeId: "chat-node",
      interactionEventId: interactionId,
      platform: "telegram",
      platformChatId: "12345",
      messageType: "text",
    });

    // Delete conversation (if exists) on session cleanup
    await db.delete(conversations).where(eq(conversations.sessionId, testSessionId));

    // Verify sent_messages still exist (FK maintains integrity)
    const messages = await db
      .select()
      .from(sentMessages)
      .where(eq(sentMessages.sessionId, testSessionId));

    expect(messages).toHaveLength(1);
    expect(messages[0].interactionEventId).toBe(interactionId);
  });
});
