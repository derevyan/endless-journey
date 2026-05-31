/**
 * Memory Service - Long-term Memory for AI Agents
 *
 * Provides persistent memory storage and semantic search for agent nodes.
 * Memories are stored per-user globally (across all journeys in organization).
 *
 * Features:
 * - Save memories with semantic embeddings
 * - Search memories using vector similarity (pgvector)
 * - Upsert behavior (update existing memory if key exists)
 * - Recent memories retrieval for context injection
 */

import { db, agentMemories } from "@journey/db";
import { generateEmbedding } from "@journey/llm";
import { createLogger, serializeError } from "@journey/logger";
import type {
  IMemoryService,
  MemorySearchResult,
  MemoryResult,
  SaveMemoryParams as BaseSaveMemoryParams,
} from "@journey/schemas";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import type { MemoryType, MemoryMetadata } from "@journey/schemas";

const log = createLogger("engine:memory");

// ============================================================================
// Raw SQL Result Types
// ============================================================================

/**
 * Raw row type from vector similarity search query
 */
interface RawMemorySearchRow {
  key: string;
  content: string;
  memory_type: string;
  similarity: number;
}

// ============================================================================
// Types
// ============================================================================

export interface SaveMemoryParams extends BaseSaveMemoryParams {
  /** Client ID (user) - required */
  clientId: string;
  /** Organization ID for multi-tenancy - required */
  organizationId: string;
  /** Optional journey ID to scope memory to specific journey */
  journeyId?: string;
}

export interface SearchMemoriesParams {
  /** Client ID to search memories for */
  clientId: string;
  /** Organization ID for multi-tenancy */
  organizationId: string;
  /** Optional journey ID to scope search to specific journey */
  journeyId?: string;
  /** Query text for semantic search */
  query: string;
  /** Maximum number of results (default: 5) */
  limit?: number;
  /** Minimum similarity threshold (0-1, default: 0.3) */
  minSimilarity?: number;
}

export interface RecentMemoriesParams {
  clientId: string;
  organizationId: string;
  /** Optional journey ID to scope results to specific journey */
  journeyId?: string;
  limit?: number;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Save a memory for a user
 *
 * Uses upsert behavior - if a memory with the same key exists for this user,
 * it will be updated with the new content and embedding.
 */
export async function saveMemory(params: SaveMemoryParams): Promise<void> {
  const { clientId, organizationId, key, content, memoryType = "semantic", journeyId, metadata } = params;

  try {
    log.debug({ clientId, organizationId, key }, "memory:save:start");

    // Generate embedding for semantic search
    const { embedding } = await generateEmbedding(content);

    // Upsert: insert or update if key exists
    await db
      .insert(agentMemories)
      .values({
        clientId,
        organizationId,
        key,
        content,
        memoryType,
        journeyId,
        embedding,
        metadata,
      })
      .onConflictDoUpdate({
        target: [agentMemories.clientId, agentMemories.organizationId, agentMemories.key],
        set: {
          content,
          embedding,
          memoryType,
          metadata,
          updatedAt: new Date(),
        },
      });

    log.info({ clientId, key }, "memory:saved");
  } catch (error) {
    log.error({ err: serializeError(error), clientId, organizationId, key }, "memory:save:error");
    throw error;
  }
}

/**
 * Search memories using semantic similarity
 *
 * Uses pgvector cosine similarity to find the most relevant memories
 * based on the query text. Optionally filters by journeyId.
 */
export async function searchMemories(params: SearchMemoriesParams): Promise<MemorySearchResult[]> {
  const { clientId, organizationId, journeyId, query, limit = 5, minSimilarity = 0.3 } = params;

  try {
    log.debug({ clientId, organizationId, journeyId, queryLength: query.length }, "memory:search:start");

    // Generate embedding for the query
    const { embedding: queryEmbedding } = await generateEmbedding(query);

    // Use CTE to calculate vector distance once, then filter and sort by that value
    // 1 - (embedding <=> query) converts distance to similarity (0-1 scale)
    // When journeyId is provided, only search memories for that journey
    // When journeyId is null/undefined, search all memories (global scope)
    const journeyFilter = journeyId
      ? sql`AND journey_id = ${journeyId}::uuid`
      : sql``;

    const results = await db.execute(sql`
      WITH scored_memories AS (
        SELECT
          key,
          content,
          memory_type,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM agent_memories
        WHERE client_id = ${clientId}
          AND organization_id = ${organizationId}
          AND embedding IS NOT NULL
          ${journeyFilter}
      )
      SELECT key, content, memory_type, similarity
      FROM scored_memories
      WHERE similarity >= ${minSimilarity}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `);

    // Map raw SQL results to typed memory objects
    // Double cast needed: drizzle returns RowList<Record<string, unknown>[]>
    const rawResults = results as unknown as RawMemorySearchRow[];
    const memories: MemorySearchResult[] = rawResults.map((row) => ({
      key: row.key,
      content: row.content,
      memoryType: row.memory_type,
      similarity: row.similarity,
    }));

    log.debug({ clientId, found: memories.length }, "memory:search:complete");
    return memories;
  } catch (error) {
    log.error({ err: serializeError(error), clientId, organizationId }, "memory:search:error");
    throw error;
  }
}

/**
 * Get recent memories for a user
 *
 * Returns the most recently updated memories, useful for context injection
 * when starting a conversation. Optionally filters by journeyId.
 */
export async function getRecentMemories(params: RecentMemoriesParams): Promise<MemoryResult[]> {
  const { clientId, organizationId, journeyId, limit = 10 } = params;

  try {
    log.debug({ clientId, organizationId, journeyId, limit }, "memory:recent:start");

    // Build conditions - journeyId filter is optional
    const conditions = [eq(agentMemories.clientId, clientId), eq(agentMemories.organizationId, organizationId)];

    if (journeyId) {
      conditions.push(eq(agentMemories.journeyId, journeyId));
    }

    const results = await db
      .select({
        key: agentMemories.key,
        content: agentMemories.content,
        memoryType: agentMemories.memoryType,
      })
      .from(agentMemories)
      .where(and(...conditions))
      .orderBy(desc(agentMemories.updatedAt))
      .limit(limit);

    log.debug({ clientId, found: results.length }, "memory:recent:complete");
    return results;
  } catch (error) {
    log.error({ err: serializeError(error), clientId, organizationId }, "memory:recent:error");
    throw error;
  }
}

/**
 * Delete a specific memory by key
 */
export async function deleteMemory(clientId: string, organizationId: string, key: string): Promise<boolean> {
  try {
    log.debug({ clientId, key }, "memory:delete:start");

    const result = await db
      .delete(agentMemories)
      .where(
        and(
          eq(agentMemories.clientId, clientId),
          eq(agentMemories.organizationId, organizationId),
          eq(agentMemories.key, key)
        )
      )
      .returning({ key: agentMemories.key });

    const deleted = result.length > 0;
    log.info({ clientId, key, deleted }, "memory:deleted");
    return deleted;
  } catch (error) {
    log.error({ err: serializeError(error), clientId, organizationId, key }, "memory:delete:error");
    throw error;
  }
}

/**
 * Get a specific memory by key
 */
export async function getMemory(
  clientId: string,
  organizationId: string,
  key: string
): Promise<MemoryResult | null> {
  try {
    const [result] = await db
      .select({
        key: agentMemories.key,
        content: agentMemories.content,
        memoryType: agentMemories.memoryType,
      })
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.clientId, clientId),
          eq(agentMemories.organizationId, organizationId),
          eq(agentMemories.key, key)
        )
      )
      .limit(1);

    return result ?? null;
  } catch (error) {
    log.error({ err: serializeError(error), clientId, organizationId, key }, "memory:get:error");
    throw error;
  }
}

/**
 * Check if a memory exists by key.
 * More efficient than get() when you only need to check existence.
 */
export async function memoryExists(
  clientId: string,
  organizationId: string,
  key: string
): Promise<boolean> {
  try {
    const result = await db
      .select({ key: agentMemories.key })
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.clientId, clientId),
          eq(agentMemories.organizationId, organizationId),
          eq(agentMemories.key, key)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    log.error({ err: serializeError(error), clientId, key }, "memory:exists:error");
    throw error;
  }
}

export interface GetAllMemoriesParams {
  clientId: string;
  organizationId: string;
  /** Optional journey ID to scope results to specific journey */
  journeyId?: string;
}

/**
 * Get all memories for a client.
 *
 * @warning Use with caution - may return large amounts of data.
 * Consider using getRecent() with pagination for large datasets.
 */
export async function getAllMemories(params: GetAllMemoriesParams): Promise<MemoryResult[]> {
  const { clientId, organizationId, journeyId } = params;

  try {
    log.debug({ clientId, organizationId, journeyId }, "memory:getAll:start");

    const conditions = [
      eq(agentMemories.clientId, clientId),
      eq(agentMemories.organizationId, organizationId),
    ];

    if (journeyId) {
      conditions.push(eq(agentMemories.journeyId, journeyId));
    }

    const results = await db
      .select({
        key: agentMemories.key,
        content: agentMemories.content,
        memoryType: agentMemories.memoryType,
      })
      .from(agentMemories)
      .where(and(...conditions))
      .orderBy(desc(agentMemories.updatedAt));

    log.debug({ clientId, found: results.length }, "memory:getAll:complete");
    return results;
  } catch (error) {
    log.error({ err: serializeError(error), clientId }, "memory:getAll:error");
    throw error;
  }
}

export interface ClearMemoriesParams {
  clientId: string;
  organizationId: string;
  /** Optional journey ID to scope clearing to specific journey */
  journeyId?: string;
}

/**
 * Clear all memories for a client.
 *
 * @warning This is destructive and cannot be undone.
 * Respects journeyId scoping if provided.
 */
export async function clearMemories(params: ClearMemoriesParams): Promise<void> {
  const { clientId, organizationId, journeyId } = params;

  try {
    log.warn({ clientId, organizationId, journeyId }, "memory:clear:start");

    const conditions = [
      eq(agentMemories.clientId, clientId),
      eq(agentMemories.organizationId, organizationId),
    ];

    if (journeyId) {
      conditions.push(eq(agentMemories.journeyId, journeyId));
    }

    const result = await db
      .delete(agentMemories)
      .where(and(...conditions))
      .returning({ key: agentMemories.key });

    log.warn({ clientId, deleted: result.length }, "memory:cleared");
  } catch (error) {
    log.error({ err: serializeError(error), clientId }, "memory:clear:error");
    throw error;
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

export interface BatchSaveMemoryParams {
  clientId: string;
  organizationId: string;
  journeyId?: string;
  memories: Array<{
    key: string;
    content: string;
    memoryType?: MemoryType;
    metadata?: MemoryMetadata;
  }>;
}

/**
 * Save multiple memories in a batch operation.
 * More efficient than individual save() calls for bulk operations.
 *
 * Uses Promise.all for concurrent embedding generation.
 */
export async function saveMemories(params: BatchSaveMemoryParams): Promise<void> {
  const { clientId, organizationId, journeyId, memories } = params;

  if (memories.length === 0) {
    return;
  }

  try {
    log.debug({ clientId, count: memories.length }, "memory:saveBatch:start");

    // Generate embeddings concurrently
    const embeddingsResults = await Promise.all(
      memories.map((m) => generateEmbedding(m.content))
    );

    // Upsert each memory (Drizzle doesn't support batch upsert with onConflictDoUpdate)
    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      const embedding = embeddingsResults[i].embedding;

      await db
        .insert(agentMemories)
        .values({
          clientId,
          organizationId,
          key: memory.key,
          content: memory.content,
          memoryType: memory.memoryType || "semantic",
          journeyId,
          embedding,
          metadata: memory.metadata,
        })
        .onConflictDoUpdate({
          target: [agentMemories.clientId, agentMemories.organizationId, agentMemories.key],
          set: {
            content: memory.content,
            embedding,
            memoryType: memory.memoryType || "semantic",
            metadata: memory.metadata,
            updatedAt: new Date(),
          },
        });
    }

    log.info({ clientId, count: memories.length }, "memory:saveBatch:complete");
  } catch (error) {
    log.error({ err: serializeError(error), clientId }, "memory:saveBatch:error");
    throw error;
  }
}

/**
 * Delete multiple memories by keys.
 *
 * @returns Number of memories actually deleted
 */
export async function deleteMemories(
  clientId: string,
  organizationId: string,
  keys: string[]
): Promise<number> {
  if (keys.length === 0) {
    return 0;
  }

  try {
    log.debug({ clientId, keys }, "memory:deleteBatch:start");

    const result = await db
      .delete(agentMemories)
      .where(
        and(
          eq(agentMemories.clientId, clientId),
          eq(agentMemories.organizationId, organizationId),
          inArray(agentMemories.key, keys)
        )
      )
      .returning({ key: agentMemories.key });

    log.info({ clientId, deleted: result.length }, "memory:deleteBatch:complete");
    return result.length;
  } catch (error) {
    log.error({ err: serializeError(error), clientId, keys }, "memory:deleteBatch:error");
    throw error;
  }
}

// ============================================================================
// Memory Service Factory (for dependency injection)
// ============================================================================

export interface MemoryServiceContext {
  clientId: string;
  organizationId: string;
  /** Optional journey ID to scope all memory operations */
  journeyId?: string;
}

export type MemoryService = IMemoryService;


/**
 * Create a memory service instance scoped to a specific client, organization, and optionally journey
 *
 * This factory is useful for agent tool contexts where we want to
 * automatically inject clientId, organizationId, and journeyId.
 *
 * When journeyId is provided, all operations (save, search, getRecent) are scoped to that journey.
 * When journeyId is undefined, operations work globally across all journeys.
 */
export function createMemoryService(context: MemoryServiceContext): IMemoryService {
  const { clientId, organizationId, journeyId } = context;

  return {
    async save(params) {
      await saveMemory({ ...params, clientId, organizationId, journeyId });
    },

    async search(query, limit = 5) {
      return searchMemories({ clientId, organizationId, journeyId, query, limit });
    },

    async getRecent(limit = 10) {
      return getRecentMemories({ clientId, organizationId, journeyId, limit });
    },

    async get(key) {
      return getMemory(clientId, organizationId, key);
    },

    async delete(key) {
      return deleteMemory(clientId, organizationId, key);
    },

    // Optional methods from IMemoryService interface
    async exists(key) {
      return memoryExists(clientId, organizationId, key);
    },

    async getAll() {
      return getAllMemories({ clientId, organizationId, journeyId });
    },

    async clear() {
      await clearMemories({ clientId, organizationId, journeyId });
    },
  };
}
