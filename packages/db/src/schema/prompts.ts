/**
 * Prompts Schema - Prompt Repository
 *
 * Tables for prompt management with versioning and labels.
 * Similar to Langfuse's prompt management system.
 *
 * @module schema/prompts
 */

import { boolean, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";
import { organization } from "./organization";
import { promptTypeEnum } from "./enums";
import type { PromptChatMessage } from "@journey/schemas";

// Local type for database column (removed from @journey/schemas but column retained)
type PromptConfig = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

// =============================================================================
// PROMPTS TABLE (Definitions)
// =============================================================================

/**
 * Prompt Definitions - Organization-level prompt registry
 *
 * Each prompt has a unique name within an organization.
 * The prompt type (text/chat) is set at creation and cannot be changed.
 */
export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Unique name for this prompt (e.g., "customer-support-agent", "onboarding-system")
    name: text("name").notNull(),

    // Human-readable description
    description: text("description"),

    // Prompt type - immutable after creation
    type: promptTypeEnum("type").notNull(),

    // Tags for categorization (e.g., ["system", "onboarding"])
    tags: jsonb("tags").$type<string[]>().default([]),

    // Whether this is a system prompt (internal) vs user-created
    isSystem: boolean("is_system").default(false),

    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // Audit
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Partial unique index allows name reuse after soft delete
    uniqueIndex("prompts_unique_org_name")
      .on(table.organizationId, table.name)
      .where(sql`deleted_at IS NULL`),
    index("idx_prompts_org").on(table.organizationId),
    index("idx_prompts_type").on(table.type),
    index("idx_prompts_is_system").on(table.organizationId, table.isSystem),
  ]
);

// =============================================================================
// PROMPT VERSIONS TABLE
// =============================================================================

/**
 * Prompt Versions - Version history for prompts
 *
 * Each version stores the full prompt content (text or chat messages).
 * Versions are immutable once created.
 *
 * Content structure:
 * - For "text" type: string content
 * - For "chat" type: array of {role, content} messages
 */
export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),

    // Version identifier (v001, v002, etc.)
    versionId: text("version_id").notNull(),

    // Content based on prompt type
    content: jsonb("content").$type<string | PromptChatMessage[]>().notNull(),

    // Optional model configuration hints
    config: jsonb("config").$type<PromptConfig>(),

    // Labels for this version (e.g., ["production", "latest"])
    labels: jsonb("labels").$type<string[]>().default([]),

    // Change notes
    notes: text("notes"),

    // Audit
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("prompt_versions_unique").on(table.promptId, table.versionId),
    index("idx_prompt_versions_prompt").on(table.promptId),
    index("idx_prompt_versions_created").on(table.createdAt),
    // GIN index for label queries
    index("idx_prompt_versions_labels").using("gin", table.labels),
  ]
);
