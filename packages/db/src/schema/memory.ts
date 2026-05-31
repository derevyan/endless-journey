/**
 * Memory Schema - Long-term memory for AI agents
 *
 * Tables for agent memory persistence:
 * - agentMemories: Stores facts about users for cross-session recall
 *
 * Uses pgvector for semantic similarity search via embeddings.
 */

import type { MemoryType } from "@journey/schemas";
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, unique, uuid, customType } from "drizzle-orm/pg-core";
import { clients } from "./session";
import { organization } from "./organization";
import { journeys } from "./journey";

// =============================================================================
// CUSTOM TYPES
// =============================================================================

/**
 * Custom pgvector type for drizzle-orm
 * Stores 1536-dimensional embeddings from text-embedding-3-small
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse "[1,2,3]" format from postgres
    return JSON.parse(value);
  },
});

// =============================================================================
// AGENT MEMORIES
// =============================================================================

/**
 * Agent Memories - Long-term memory storage for AI agents
 *
 * Stores facts and information about users that agents can save and recall
 * across different conversations and sessions. Supports semantic search
 * via pgvector embeddings.
 *
 * Memory types:
 * - semantic: Facts about the user (name, preferences, background)
 * - preference: Explicit user preferences (communication style, topics to avoid)
 */
export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Link to user (client) - required
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // Link to organization - required for multi-tenancy
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Optional link to specific journey (null = global to user)
    journeyId: uuid("journey_id").references(() => journeys.id, { onDelete: "cascade" }),
    // Memory classification (aligns with MemoryType from @journey/schemas)
    memoryType: text("memory_type").$type<MemoryType>().notNull().default("semantic"),
    // Unique key for this memory (e.g., "user_name", "food_preference")
    key: text("key").notNull(),
    // The actual content/fact to remember
    content: text("content").notNull(),
    // Vector embedding for semantic search (1536 dims from text-embedding-3-small)
    embedding: vector("embedding"),
    // Additional metadata
    metadata: jsonb("metadata").$type<{
      source?: "agent" | "user" | "system";
      confidence?: number;
      tags?: string[];
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Unique constraint: one memory per key per user per organization
    unique("agent_memories_client_org_key_unique").on(table.clientId, table.organizationId, table.key),
    // Index for looking up memories by client
    index("idx_agent_memories_client").on(table.clientId, table.organizationId),
    // Index for organization-wide queries
    index("idx_agent_memories_org").on(table.organizationId),
    // Index for journey-specific memories
    index("idx_agent_memories_journey").on(table.journeyId),
    // HNSW vector index for semantic similarity search (cosine distance)
    // Enables fast approximate nearest neighbor queries on embeddings
    index("idx_agent_memories_embedding_hnsw")
      .using("hnsw", sql`${table.embedding} vector_cosine_ops`),
  ]
);
