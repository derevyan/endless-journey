/**
 * Conversation Document Store Integration Tests
 *
 * Tests the JSONB document model for conversation storage:
 * - Single-row conversation loading (vs 1000-row interactions table)
 * - Append-only updates (UPSERT with JSONB ||)
 * - Full-text search via GIN index
 * - Data consistency and edge cases
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@journey/db";
import {
  conversations,
  journeySessions,
  clients,
  organization,
  journeys,
} from "@journey/db/schema";
import {
  loadConversation,
  appendToConversation,
  deleteConversation,
  searchConversations,
  getConversationMetadata,
  conversationExists,
} from "../conversation-document-store";
import type { InteractionEvent } from "@journey/schemas";
import { eq } from "drizzle-orm";

/**
 * Create a mock interaction event for testing
 */
function createMockInteractionEvent(
  overrides?: Partial<InteractionEvent>
): InteractionEvent {
  const timestamp = new Date().toISOString();
  return {
    id: `evt-${randomUUID().slice(0, 8)}`,
    type: "user.message",
    nodeId: "test-node",
    timestamp,
    payload: { text: "Test message" },
    ...overrides,
  };
}

describe("ConversationDocumentStore Integration Tests", () => {
  let testOrgId: string;
  let testClientId: string;
  let testSessionId: string;
  let testJourneyId: string;

  beforeAll(async () => {
    // Setup test data
    testOrgId = randomUUID();
    testClientId = randomUUID();
    testJourneyId = randomUUID();

    // Create test organization
    await db.insert(organization).values({
      id: testOrgId,
      name: `Test Org ${testOrgId}`,
    });

    // Create test client
    await db.insert(clients).values({
      id: testClientId,
      platform: "telegram",
      platformUserId: `test-${randomUUID()}`,
      organizationId: testOrgId,
      firstName: "TestUser",
    });

    // Create test journey
    await db.insert(journeys).values({
      id: testJourneyId,
      organizationId: testOrgId,
      name: "Test Journey",
      configuration: { nodes: [], edges: [] },
    });
  });

  beforeEach(async () => {
    // Create fresh session for each test
    const [session] = await db
      .insert(journeySessions)
      .values({
        clientId: testClientId,
        journeyId: testJourneyId,
        organizationId: testOrgId,
        currentNodeId: "start",
      })
      .returning();

    testSessionId = session.id;
  });

  afterAll(async () => {
    // Cleanup all test data
    if (testSessionId) {
      await db
        .delete(conversations)
        .where(eq(conversations.sessionId, testSessionId));
      await db
        .delete(journeySessions)
        .where(eq(journeySessions.id, testSessionId));
    }
    if (testJourneyId) {
      await db.delete(journeys).where(eq(journeys.id, testJourneyId));
    }
    if (testClientId) {
      await db.delete(clients).where(eq(clients.id, testClientId));
    }
    if (testOrgId) {
      await db.delete(organization).where(eq(organization.id, testOrgId));
    }
  });

  // ============================================================================
  // LOAD & APPEND TESTS
  // ============================================================================

  it("should return null for non-existent conversation", async () => {
    const messages = await loadConversation(randomUUID());
    expect(messages).toBeNull();
  });

  it("should create new conversation on first append", async () => {
    const event = createMockInteractionEvent({
      type: "user.message",
      payload: { text: "Hello" },
    });

    await appendToConversation(testSessionId, event);

    const messages = await loadConversation(testSessionId);
    expect(messages).toBeDefined();
    expect(messages).toHaveLength(1);
    expect(messages?.[0].type).toBe("user.message");
    expect(messages?.[0].payload).toEqual({ text: "Hello" });
  });

  it("should append to existing conversation (UPSERT)", async () => {
    const event1 = createMockInteractionEvent({
      type: "user.message",
      payload: { text: "First" },
    });

    const event2 = createMockInteractionEvent({
      type: "engine.message",
      payload: { text: "Second" },
    });

    await appendToConversation(testSessionId, event1);
    await appendToConversation(testSessionId, event2);

    const messages = await loadConversation(testSessionId);
    expect(messages).toHaveLength(2);
    expect(messages?.[0].payload).toEqual({ text: "First" });
    expect(messages?.[1].payload).toEqual({ text: "Second" });
  });

  it("should preserve event order when appending", async () => {
    const events = [
      createMockInteractionEvent({ id: "evt-1", payload: { order: 1 } }),
      createMockInteractionEvent({ id: "evt-2", payload: { order: 2 } }),
      createMockInteractionEvent({ id: "evt-3", payload: { order: 3 } }),
    ];

    for (const event of events) {
      await appendToConversation(testSessionId, event);
    }

    const messages = await loadConversation(testSessionId);
    expect(messages?.map((m) => (m.payload as any).order)).toEqual([1, 2, 3]);
  });

  it("should handle events with complex payloads", async () => {
    const complexPayload = {
      text: "Complex message",
      metadata: {
        source: "webhook",
        timestamp: new Date().toISOString(),
        nested: {
          level: 1,
          data: [1, 2, 3],
        },
      },
    };

    const event = createMockInteractionEvent({
      payload: complexPayload,
    });

    await appendToConversation(testSessionId, event);

    const messages = await loadConversation(testSessionId);
    expect(messages?.[0].payload).toEqual(complexPayload);
  });

  it("should handle events with optional metadata", async () => {
    const event = createMockInteractionEvent({
      type: "engine.error",
      payload: { error: "Test error" },
      metadata: { code: "ERR_001", severity: "high" },
    });

    await appendToConversation(testSessionId, event);

    const messages = await loadConversation(testSessionId);
    expect(messages?.[0].metadata).toEqual({
      code: "ERR_001",
      severity: "high",
    });
  });

  // ============================================================================
  // DELETE TESTS
  // ============================================================================

  it("should delete existing conversation", async () => {
    const event = createMockInteractionEvent();
    await appendToConversation(testSessionId, event);

    // Verify it exists
    let messages = await loadConversation(testSessionId);
    expect(messages).not.toBeNull();

    // Delete
    await deleteConversation(testSessionId);

    // Verify it's gone
    messages = await loadConversation(testSessionId);
    expect(messages).toBeNull();
  });

  it("should handle deleting non-existent conversation without error", async () => {
    // Should not throw
    await expect(
      deleteConversation(randomUUID())
    ).resolves.not.toThrow();
  });

  // ============================================================================
  // SEARCH TESTS
  // ============================================================================

  it("should search conversations by message content", async () => {
    // Create multiple sessions with conversations
    const sessionIds: string[] = [];

    for (let i = 0; i < 3; i++) {
      const [session] = await db
        .insert(journeySessions)
        .values({
          clientId: testClientId,
          journeyId: testJourneyId,
          organizationId: testOrgId,
          currentNodeId: "start",
        })
        .returning();

      sessionIds.push(session.id);
    }

    // Add conversations
    await appendToConversation(
      sessionIds[0],
      createMockInteractionEvent({
        payload: { text: "pricing discussion here" },
      })
    );

    await appendToConversation(
      sessionIds[1],
      createMockInteractionEvent({
        payload: { text: "no match" },
      })
    );

    await appendToConversation(
      sessionIds[2],
      createMockInteractionEvent({
        payload: { text: "pricing and features" },
      })
    );

    // Search for "pricing"
    const results = await searchConversations("pricing");

    expect(results.length).toBeGreaterThanOrEqual(2);
    const matchedSessionIds = results.map((r) => r.sessionId);
    expect(matchedSessionIds).toContain(sessionIds[0]);
    expect(matchedSessionIds).toContain(sessionIds[2]);

    // Cleanup
    for (const sid of sessionIds) {
      await deleteConversation(sid);
      await db
        .delete(journeySessions)
        .where(eq(journeySessions.id, sid));
    }
  });

  it("should respect search limit", async () => {
    // Create 5 conversations with searchable content
    for (let i = 0; i < 5; i++) {
      const [session] = await db
        .insert(journeySessions)
        .values({
          clientId: testClientId,
          journeyId: testJourneyId,
          organizationId: testOrgId,
          currentNodeId: "start",
        })
        .returning();

      await appendToConversation(
        session.id,
        createMockInteractionEvent({
          payload: { text: "searchable content" },
        })
      );
    }

    // Search with limit
    const results = await searchConversations("searchable", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  // ============================================================================
  // METADATA TESTS
  // ============================================================================

  it("should get conversation metadata without loading full messages", async () => {
    const events = [
      createMockInteractionEvent({ payload: { text: "First" } }),
      createMockInteractionEvent({ payload: { text: "Second" } }),
      createMockInteractionEvent({ payload: { text: "Third" } }),
    ];

    for (const event of events) {
      await appendToConversation(testSessionId, event);
    }

    const metadata = await getConversationMetadata(testSessionId);

    expect(metadata).not.toBeNull();
    expect(metadata?.messageCount).toBe(3);
    expect(metadata?.createdAt).toBeInstanceOf(Date);
    expect(metadata?.updatedAt).toBeInstanceOf(Date);
  });

  it("should return null metadata for non-existent conversation", async () => {
    const metadata = await getConversationMetadata(randomUUID());
    expect(metadata).toBeNull();
  });

  it("should track updated_at on append", async () => {
    const event1 = createMockInteractionEvent({
      payload: { text: "First" },
    });

    await appendToConversation(testSessionId, event1);
    const metadata1 = await getConversationMetadata(testSessionId);

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    const event2 = createMockInteractionEvent({
      payload: { text: "Second" },
    });

    await appendToConversation(testSessionId, event2);
    const metadata2 = await getConversationMetadata(testSessionId);

    expect(metadata2?.updatedAt.getTime()).toBeGreaterThanOrEqual(
      metadata1?.updatedAt.getTime() ?? 0
    );
  });

  // ============================================================================
  // EXISTENCE TESTS
  // ============================================================================

  it("should check if conversation exists", async () => {
    // Should not exist initially
    let exists = await conversationExists(testSessionId);
    expect(exists).toBe(false);

    // Create conversation
    const event = createMockInteractionEvent();
    await appendToConversation(testSessionId, event);

    // Should exist now
    exists = await conversationExists(testSessionId);
    expect(exists).toBe(true);

    // Should not exist after deletion
    await deleteConversation(testSessionId);
    exists = await conversationExists(testSessionId);
    expect(exists).toBe(false);
  });

  // ============================================================================
  // JOURNEY SESSION VALIDATION TESTS
  // ============================================================================

  it("should skip conversation write for non-journey sessions (random UUIDs)", async () => {
    // Simulate workflow test with random UUID (not in journey_sessions table)
    const randomSessionId = randomUUID();
    const event = createMockInteractionEvent({
      payload: { text: "From workflow test" },
    });

    // Should not throw FK error - skips the write
    await expect(
      appendToConversation(randomSessionId, event)
    ).resolves.not.toThrow();

    // Conversation should not be created for non-journey sessions
    const exists = await conversationExists(randomSessionId);
    expect(exists).toBe(false);

    // But the function should complete successfully
    // (error would have been logged as debug, not thrown)
  });

  it("should write conversation for real journey sessions", async () => {
    // Use the real session created in beforeEach
    const event = createMockInteractionEvent({
      payload: { text: "From real journey" },
    });

    // Should succeed - real session exists in journey_sessions
    await appendToConversation(testSessionId, event);

    // Conversation should be created
    const exists = await conversationExists(testSessionId);
    expect(exists).toBe(true);

    // Message should be in conversations table
    const messages = await loadConversation(testSessionId);
    expect(messages).toHaveLength(1);
    expect(messages?.[0].payload).toEqual({ text: "From real journey" });
  });

  it("should skip multiple appends for same non-journey session", async () => {
    // Simulate workflow test with multiple messages using random UUID
    const randomSessionId = randomUUID();
    const events = [
      createMockInteractionEvent({ payload: { text: "Message 1" } }),
      createMockInteractionEvent({ payload: { text: "Message 2" } }),
      createMockInteractionEvent({ payload: { text: "Message 3" } }),
    ];

    // All appends should succeed without error (skip silently)
    for (const event of events) {
      await expect(
        appendToConversation(randomSessionId, event)
      ).resolves.not.toThrow();
    }

    // Nothing should be in conversations table
    const exists = await conversationExists(randomSessionId);
    expect(exists).toBe(false);
  });

  // ============================================================================
  // EDGE CASES & LARGE DATA TESTS
  // ============================================================================

  it("should handle conversation with many messages", async () => {
    // Append 100 messages
    for (let i = 1; i <= 100; i++) {
      const event = createMockInteractionEvent({
        id: `evt-${i}`,
        payload: { text: `Message ${i}`, number: i },
      });

      await appendToConversation(testSessionId, event);
    }

    const messages = await loadConversation(testSessionId);
    expect(messages).toHaveLength(100);
    expect(messages?.[0].id).toBe("evt-1");
    expect(messages?.[99].id).toBe("evt-100");

    const metadata = await getConversationMetadata(testSessionId);
    expect(metadata?.messageCount).toBe(100);
  });

  it("should handle empty search results", async () => {
    // Search for something that doesn't exist
    const results = await searchConversations(
      "zzz_no_such_content_zzz",
      10
    );

    expect(results).toEqual([]);
  });

  it("should preserve data types in JSONB payload", async () => {
    const event = createMockInteractionEvent({
      payload: {
        string: "text",
        number: 42,
        float: 3.14,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: "value" },
      },
    });

    await appendToConversation(testSessionId, event);

    const messages = await loadConversation(testSessionId);
    const payload = messages?.[0].payload as any;

    expect(payload.string).toBe("text");
    expect(payload.number).toBe(42);
    expect(payload.float).toBe(3.14);
    expect(payload.boolean).toBe(true);
    expect(payload.null).toBeNull();
    expect(payload.array).toEqual([1, 2, 3]);
    expect(payload.object).toEqual({ nested: "value" });
  });
});
