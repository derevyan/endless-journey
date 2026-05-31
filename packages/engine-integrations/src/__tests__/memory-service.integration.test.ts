/**
 * Memory Service Integration Tests
 *
 * Tests the memory service with real PostgreSQL + pgvector + real OpenAI embeddings.
 * Validates the complete memory lifecycle: save, search, upsert, recent, delete.
 *
 * Prerequisites:
 * - PostgreSQL with pgvector extension running
 * - OPENAI_API_KEY environment variable set
 * - Test database seeded (pnpm journey:db:seed)
 *
 * Cost: ~$0.001 per test run (3-4 embedding API calls)
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, agentMemories, clients, organization } from "@journey/db";
import { eq, and } from "drizzle-orm";
import {
  saveMemory,
  searchMemories,
  getRecentMemories,
  getMemory,
  deleteMemory,
  createMemoryService,
  // Phase 2: New methods
  memoryExists,
  getAllMemories,
  clearMemories,
  saveMemories,
  deleteMemories,
} from "../memory-service";

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

// Unique identifiers for test isolation (prevents conflicts with parallel tests)
const TEST_RUN_ID = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const TEST_CLIENT_ID = randomUUID();
const TEST_ORG_ID = randomUUID();

// Track cleanup needs
let testClientCreated = false;
let testOrgCreated = false;

// =============================================================================
// SETUP & CLEANUP
// =============================================================================

beforeAll(async () => {
  // Create test organization
  await db.insert(organization).values({
    id: TEST_ORG_ID,
    name: "Memory Test Org",
    slug: `memory-test-${TEST_RUN_ID}`,
  });
  testOrgCreated = true;

  // Create test client
  await db.insert(clients).values({
    id: TEST_CLIENT_ID,
    platform: "simulator",
    platformUserId: TEST_RUN_ID,
    organizationId: TEST_ORG_ID,
    firstName: "Memory",
    lastName: "Tester",
  });
  testClientCreated = true;
});

afterAll(async () => {
  // Clean up test memories first (FK constraint)
  await db
    .delete(agentMemories)
    .where(
      and(eq(agentMemories.clientId, TEST_CLIENT_ID), eq(agentMemories.organizationId, TEST_ORG_ID))
    );

  // Clean up test client
  if (testClientCreated) {
    await db.delete(clients).where(eq(clients.id, TEST_CLIENT_ID));
  }

  // Clean up test organization
  if (testOrgCreated) {
    await db.delete(organization).where(eq(organization.id, TEST_ORG_ID));
  }
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("Memory Service - Integration", () => {
  /**
   * Comprehensive test covering the full memory lifecycle.
   * Tests: save, get, semantic search, upsert, recent memories, delete.
   *
   * Uses real OpenAI embeddings to validate actual semantic similarity.
   */
  it("complete memory lifecycle: save, semantic search, upsert, recent, delete", async () => {
    const clientId = TEST_CLIENT_ID;
    const organizationId = TEST_ORG_ID;

    // =========================================================================
    // 1. SAVE MEMORY
    // =========================================================================
    await saveMemory({
      clientId,
      organizationId,
      key: "user_hobby",
      content: "Alice enjoys hiking in the mountains and outdoor photography",
      memoryType: "semantic",
    });

    // =========================================================================
    // 2. GET MEMORY - Verify save worked
    // =========================================================================
    const savedMemory = await getMemory(clientId, organizationId, "user_hobby");
    expect(savedMemory).not.toBeNull();
    expect(savedMemory?.key).toBe("user_hobby");
    expect(savedMemory?.content).toBe("Alice enjoys hiking in the mountains and outdoor photography");
    expect(savedMemory?.memoryType).toBe("semantic");

    // =========================================================================
    // 3. SEMANTIC SEARCH - Real embedding similarity test
    // Query "outdoor activities" should semantically match "hiking" and "outdoor photography"
    // =========================================================================
    const searchResults = await searchMemories({
      clientId,
      organizationId,
      query: "outdoor activities and nature",
      limit: 5,
    });

    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].key).toBe("user_hobby");
    expect(searchResults[0].similarity).toBeGreaterThan(0.3); // Semantic match threshold

    // =========================================================================
    // 4. UPSERT - Update existing memory with same key
    // =========================================================================
    await saveMemory({
      clientId,
      organizationId,
      key: "user_hobby",
      content: "Alice now prefers swimming and beach volleyball",
      memoryType: "preference",
    });

    const updatedMemory = await getMemory(clientId, organizationId, "user_hobby");
    expect(updatedMemory?.content).toBe("Alice now prefers swimming and beach volleyball");
    expect(updatedMemory?.memoryType).toBe("preference");

    // =========================================================================
    // 5. ADD SECOND MEMORY - For recent test ordering
    // =========================================================================
    // Small delay to ensure different updatedAt timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));

    await saveMemory({
      clientId,
      organizationId,
      key: "food_preference",
      content: "Vegetarian, loves Italian cuisine",
      memoryType: "preference",
    });

    // =========================================================================
    // 6. GET RECENT MEMORIES - Verify order (most recent first)
    // =========================================================================
    const recentMemories = await getRecentMemories({
      clientId,
      organizationId,
      limit: 2,
    });

    expect(recentMemories.length).toBe(2);
    // Most recently saved/updated should be first
    expect(recentMemories[0].key).toBe("food_preference");
    expect(recentMemories[1].key).toBe("user_hobby");

    // =========================================================================
    // 7. DELETE MEMORY
    // =========================================================================
    const deleted = await deleteMemory(clientId, organizationId, "user_hobby");
    expect(deleted).toBe(true);

    // =========================================================================
    // 8. VERIFY DELETION
    // =========================================================================
    const deletedMemory = await getMemory(clientId, organizationId, "user_hobby");
    expect(deletedMemory).toBeNull();

    // food_preference should still exist
    const remainingMemory = await getMemory(clientId, organizationId, "food_preference");
    expect(remainingMemory).not.toBeNull();
    expect(remainingMemory?.content).toBe("Vegetarian, loves Italian cuisine");

    // Clean up remaining memory
    await deleteMemory(clientId, organizationId, "food_preference");
  }, 30000); // Extended timeout for API calls

  /**
   * Test the memory service factory (createMemoryService).
   * Validates scoped operations without passing clientId/organizationId each time.
   */
  it("createMemoryService provides scoped operations", async () => {
    const memoryService = createMemoryService({
      clientId: TEST_CLIENT_ID,
      organizationId: TEST_ORG_ID,
    });

    // Save via scoped service
    await memoryService.save({
      key: "test_factory",
      content: "Testing the memory service factory pattern",
    });

    // Get via scoped service
    const memory = await memoryService.get("test_factory");
    expect(memory?.content).toBe("Testing the memory service factory pattern");

    // Search via scoped service
    const results = await memoryService.search("factory pattern", 5);
    expect(results.length).toBeGreaterThan(0);

    // Get recent via scoped service
    const recent = await memoryService.getRecent(1);
    expect(recent[0].key).toBe("test_factory");

    // Delete via scoped service
    const deleted = await memoryService.delete("test_factory");
    expect(deleted).toBe(true);

    // Verify deleted
    const gone = await memoryService.get("test_factory");
    expect(gone).toBeNull();
  }, 30000);

  /**
   * Test semantic search relevance - queries should match semantically related content.
   * This validates that OpenAI embeddings are working correctly with pgvector.
   */
  it("semantic search finds related content across different phrasings", async () => {
    const clientId = TEST_CLIENT_ID;
    const organizationId = TEST_ORG_ID;

    // Save memories with different topics
    await saveMemory({
      clientId,
      organizationId,
      key: "work_info",
      content: "Works as a software engineer at a tech startup in San Francisco",
    });

    await saveMemory({
      clientId,
      organizationId,
      key: "pet_info",
      content: "Has a golden retriever named Max who loves playing fetch",
    });

    // Search with different phrasing - should still find relevant results
    const codingSearch = await searchMemories({
      clientId,
      organizationId,
      query: "programming job career",
      limit: 2,
    });

    // "programming job career" should match "software engineer at tech startup"
    expect(codingSearch.length).toBeGreaterThan(0);
    expect(codingSearch[0].key).toBe("work_info");

    const dogSearch = await searchMemories({
      clientId,
      organizationId,
      query: "dog animal companion",
      limit: 2,
    });

    // "dog animal companion" should match "golden retriever"
    expect(dogSearch.length).toBeGreaterThan(0);
    expect(dogSearch[0].key).toBe("pet_info");

    // Cleanup
    await deleteMemory(clientId, organizationId, "work_info");
    await deleteMemory(clientId, organizationId, "pet_info");
  }, 30000);

  // ===========================================================================
  // Phase 2: New Methods Tests
  // ===========================================================================

  /**
   * Test memoryExists - checks if a memory exists without fetching content.
   */
  it("memoryExists checks existence efficiently", async () => {
    const clientId = TEST_CLIENT_ID;
    const organizationId = TEST_ORG_ID;

    // Save a memory
    await saveMemory({
      clientId,
      organizationId,
      key: "test_exists",
      content: "Testing exists function",
    });

    // Check it exists
    const exists = await memoryExists(clientId, organizationId, "test_exists");
    expect(exists).toBe(true);

    // Check non-existent key
    const notExists = await memoryExists(clientId, organizationId, "nonexistent_key_12345");
    expect(notExists).toBe(false);

    // Cleanup
    await deleteMemory(clientId, organizationId, "test_exists");
  }, 30000);

  /**
   * Test getAllMemories - retrieves all memories for a client.
   */
  it("getAllMemories returns all memories", async () => {
    const clientId = TEST_CLIENT_ID;
    const organizationId = TEST_ORG_ID;

    // Save multiple memories
    await saveMemory({
      clientId,
      organizationId,
      key: "getall_1",
      content: "First memory for getAll test",
    });
    await saveMemory({
      clientId,
      organizationId,
      key: "getall_2",
      content: "Second memory for getAll test",
    });

    // Get all memories
    const all = await getAllMemories({ clientId, organizationId });
    const testKeys = all.map((m) => m.key).filter((k) => k.startsWith("getall_"));

    expect(testKeys.length).toBe(2);
    expect(testKeys).toContain("getall_1");
    expect(testKeys).toContain("getall_2");

    // Cleanup
    await deleteMemory(clientId, organizationId, "getall_1");
    await deleteMemory(clientId, organizationId, "getall_2");
  }, 30000);

  /**
   * Test clearMemories - clears all memories for a client.
   */
  it("clearMemories removes all memories", async () => {
    const clientId = TEST_CLIENT_ID;
    const organizationId = TEST_ORG_ID;

    // Save multiple memories
    await saveMemory({
      clientId,
      organizationId,
      key: "clear_1",
      content: "First memory to clear",
    });
    await saveMemory({
      clientId,
      organizationId,
      key: "clear_2",
      content: "Second memory to clear",
    });

    // Verify they exist
    const before = await getAllMemories({ clientId, organizationId });
    const beforeKeys = before.map((m) => m.key).filter((k) => k.startsWith("clear_"));
    expect(beforeKeys.length).toBe(2);

    // Clear all memories
    await clearMemories({ clientId, organizationId });

    // Verify they're gone
    const after = await getAllMemories({ clientId, organizationId });
    expect(after.length).toBe(0);
  }, 30000);

  /**
   * Test batch operations - saveMemories and deleteMemories.
   */
  it("batch operations save and delete multiple memories", async () => {
    const clientId = TEST_CLIENT_ID;
    const organizationId = TEST_ORG_ID;

    // Batch save
    await saveMemories({
      clientId,
      organizationId,
      memories: [
        { key: "batch_1", content: "First batch memory" },
        { key: "batch_2", content: "Second batch memory" },
        { key: "batch_3", content: "Third batch memory" },
      ],
    });

    // Verify all saved
    const all = await getAllMemories({ clientId, organizationId });
    const batchKeys = all.map((m) => m.key).filter((k) => k.startsWith("batch_"));
    expect(batchKeys.length).toBe(3);

    // Batch delete
    const deleted = await deleteMemories(clientId, organizationId, ["batch_1", "batch_3"]);
    expect(deleted).toBe(2);

    // Verify correct ones deleted
    const remaining = await getAllMemories({ clientId, organizationId });
    const remainingBatch = remaining.filter((m) => m.key.startsWith("batch_"));
    expect(remainingBatch.length).toBe(1);
    expect(remainingBatch[0].key).toBe("batch_2");

    // Cleanup
    await deleteMemory(clientId, organizationId, "batch_2");
  }, 60000); // Extended timeout for batch embeddings

  /**
   * Test factory with new optional methods (exists, getAll, clear).
   */
  it("createMemoryService provides exists, getAll, and clear methods", async () => {
    const memoryService = createMemoryService({
      clientId: TEST_CLIENT_ID,
      organizationId: TEST_ORG_ID,
    });

    // Save a test memory
    await memoryService.save({
      key: "factory_optional",
      content: "Testing optional factory methods",
    });

    // Test exists
    const exists = await memoryService.exists?.("factory_optional");
    expect(exists).toBe(true);

    // Test getAll
    const all = await memoryService.getAll?.();
    expect(all?.some((m) => m.key === "factory_optional")).toBe(true);

    // Test clear
    await memoryService.clear?.();

    // Verify cleared
    const afterClear = await memoryService.getAll?.();
    expect(afterClear?.length).toBe(0);
  }, 30000);
});
