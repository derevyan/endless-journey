/**
 * Usage Schema - LLM Token Usage Tracking
 *
 * Tables for tracking LLM API calls with flexible dimensions for analytics and billing.
 *
 * Design principles:
 * - All dimension columns are optional (allows tracking at any granularity)
 * - JSONB metadata for service-specific context
 * - Indexed for common query patterns (org + time, journey + time)
 */

import { index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./auth";
import { journeys } from "./journey";
import { journeySessions, clients } from "./session";

// =============================================================================
// LLM USAGE EVENTS TABLE
// =============================================================================

/**
 * LLM Usage Events - Tracks all LLM API calls with flexible dimensions
 *
 * Used for:
 * - Usage analytics and dashboards
 * - Cost tracking and billing
 * - Debugging and monitoring
 * - Performance analysis
 */
export const llmUsageEvents = pgTable(
  "llm_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // === DIMENSIONS (all optional for flexibility) ===

    /** Organization making the call (required for multi-tenant isolation) */
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    /** User who initiated the call (optional - some calls are system-level) */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    /** Journey being executed (optional) */
    journeyId: uuid("journey_id").references(() => journeys.id, { onDelete: "set null" }),

    /** Session within journey (optional) */
    journeySessionId: uuid("journey_session_id").references(() => journeySessions.id, {
      onDelete: "set null",
    }),

    /** Client/end-user interacting (optional) */
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),

    // === SERVICE CONTEXT ===

    /** Service that made the call (e.g., 'agent-handler', 'question-understanding') */
    service: text("service").notNull(),

    /** Module within service (e.g., 'worker-1', 'evaluator', 'summarizer') */
    module: text("module"),

    /** Tool name if called via tool (e.g., 'web-search', 'calculator') */
    tool: text("tool"),

    // === MODEL INFO ===

    /** Model used (e.g., 'gpt-4o-mini', 'claude-haiku-4-5') */
    model: text("model").notNull(),

    /** Provider (e.g., 'openai', 'anthropic', 'google-genai') */
    provider: text("provider").notNull(),

    // === USAGE METRICS ===

    /** Input/prompt tokens consumed */
    promptTokens: integer("prompt_tokens").notNull(),

    /** Output/completion tokens generated */
    completionTokens: integer("completion_tokens").notNull(),

    /** Total tokens (prompt + completion) */
    totalTokens: integer("total_tokens").notNull(),

    /** Cost in USD (6 decimal places for precision) */
    costUSD: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),

    /** Response latency in milliseconds */
    durationMs: integer("duration_ms"),

    // === I/O CONTENT (for debugging) ===

    /** System prompt used for this call */
    systemPrompt: text("system_prompt"),

    /** Input messages (conversation history sent to model) */
    inputMessages: jsonb("input_messages").$type<
      Array<{
        role: "user" | "assistant" | "system" | "tool";
        content: string;
        toolCallId?: string;
      }>
    >(),

    /** Model response content */
    outputContent: text("output_content"),

    /** Tool calls made by the model (if any) */
    outputToolCalls: jsonb("output_tool_calls").$type<
      Array<{
        id: string;
        name: string;
        args: unknown;
      }>
    >(),

    /** Why the model stopped: 'stop' | 'tool_calls' | 'length' | 'error' */
    finishReason: text("finish_reason"),

    /** Error message if the call failed */
    errorMessage: text("error_message"),

    // === FLEXIBLE METADATA ===

    /** Additional service-specific metadata */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // === TIMESTAMPS ===

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Primary query patterns
    index("idx_llm_usage_org_created").on(table.organizationId, table.createdAt),
    index("idx_llm_usage_journey_created").on(table.journeyId, table.createdAt),
    index("idx_llm_usage_session").on(table.journeySessionId),
    index("idx_llm_usage_service").on(table.service, table.createdAt),
    index("idx_llm_usage_model").on(table.model, table.createdAt),
    // For billing queries
    index("idx_llm_usage_org_user").on(table.organizationId, table.userId),
  ]
);
