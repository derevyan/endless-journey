/**
 * Automation Schema - Triggers, webhooks, and timers
 *
 * Tables for automation:
 * - automationTriggers: Event-based journey triggers
 * - automationWebhooks: Webhook configuration
 * - durableTimers: Durable timer tracking
 */

import { boolean, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { journeys } from "./journey";
import { messagingChannels } from "./channels";
import { journeySessions } from "./session";
import { crmPipelines, crmPipelineStages } from "./crm";
import { tagDefinitions } from "./tags";
import { variables } from "./variables";
import { triggerTypeEnum, tagActionEnum, variableScopeEnum, timerStatusEnum } from "./enums";

// =============================================================================
// AUTOMATION SYSTEM
// =============================================================================

/**
 * Automation Triggers - Links journeys to event-based triggers
 * Used by the event bus to find matching journeys when events occur
 */
export const automationTriggers = pgTable(
  "automation_triggers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeys.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Trigger type: tag_change, variable_condition, journey_completed, schedule, webhook
    triggerType: triggerTypeEnum("trigger_type").notNull(),

    // Tag change trigger fields
    tagId: uuid("tag_id").references(() => tagDefinitions.id, { onDelete: "cascade" }),
    tagAction: tagActionEnum("tag_action"),

    // Variable condition trigger fields
    variableId: uuid("variable_id").references(() => variables.id, { onDelete: "cascade" }),
    variableScope: variableScopeEnum("variable_scope"), // Kept for filtering by scope type
    expression: text("expression"), // expr-eval expression like "value >= 100"

    // Journey completed trigger fields
    sourceJourneyId: uuid("source_journey_id").references(() => journeys.id, { onDelete: "set null" }),

    // Schedule trigger fields
    cronExpression: text("cron_expression"), // e.g., "0 9 * * *"
    timezone: text("timezone").default("UTC"),

    // CRM trigger fields
    crmPipelineId: uuid("crm_pipeline_id").references(() => crmPipelines.id, { onDelete: "set null" }),
    crmStageId: uuid("crm_stage_id").references(() => crmPipelineStages.id, { onDelete: "set null" }),
    crmFieldKey: text("crm_field_key"), // Custom field key for field change triggers

    // Status
    isActive: boolean("is_active").default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Index for tag change triggers
    index("idx_triggers_tag").on(table.organizationId, table.triggerType, table.tagId, table.tagAction),
    // Index for variable condition triggers
    index("idx_triggers_var").on(table.organizationId, table.triggerType, table.variableId, table.variableScope),
    // Index for journey completed triggers
    index("idx_triggers_journey_completed").on(table.organizationId, table.triggerType, table.sourceJourneyId),
    // Index for finding active triggers by journey
    index("idx_triggers_journey_active").on(table.journeyId, table.isActive),
    // Index for organization lookup
    index("idx_triggers_org").on(table.organizationId),
    // Index for CRM triggers
    index("idx_triggers_crm").on(table.organizationId, table.triggerType, table.crmPipelineId, table.crmStageId),
  ]
);

/**
 * Automation Webhooks - Configuration for webhook triggers
 * Stores secrets and rate limiting for external webhook calls
 */
export const automationWebhooks = pgTable(
  "automation_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    triggerId: uuid("trigger_id")
      .notNull()
      .references(() => automationTriggers.id, { onDelete: "cascade" }),

    // Security
    secretKeyEncrypted: text("secret_key_encrypted").notNull(), // For HMAC signature validation
    secretKeyHash: text("secret_key_hash").notNull(),
    allowedIps: text("allowed_ips"), // Comma-separated, null = allow all

    // Rate limiting
    rateLimit: text("rate_limit").default("100/hour"),

    // Stats
    lastCalledAt: timestamp("last_called_at", { withTimezone: true }),
    callCount: integer("call_count").default(0), // Webhook call counter

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("webhooks_trigger_unique").on(table.triggerId)]
);

// =============================================================================
// DURABLE TIMERS
// PostgreSQL-backed timers for crash recovery and pause/resume support
// =============================================================================

/**
 * Durable Timers - Tracks BullMQ timer jobs in PostgreSQL for durability
 * Used for journey wait nodes with crash recovery and pause/resume support
 */
export const durableTimers = pgTable(
  "durable_timers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => journeySessions.id, { onDelete: "cascade" }),
    // Channel reference (nullable for simulator sessions)
    channelId: uuid("channel_id").references(() => messagingChannels.id, { onDelete: "set null" }),
    edgeId: text("edge_id").notNull(),
    firesAt: timestamp("fires_at", { withTimezone: true }).notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }), // When timer was paused (for resume calculation)
    bullmqJobId: text("bullmq_job_id"),
    status: timerStatusEnum("status").default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("durable_timers_active_idx").on(table.status, table.firesAt), index("durable_timers_session_idx").on(table.sessionId)]
);
