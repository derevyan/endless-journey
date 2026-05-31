/**
 * CRM Schema - Customer relationship management tables
 *
 * Tables for CRM functionality:
 * - crmPipelines: Named pipelines
 * - crmPipelineStages: Stage definitions
 * - crmClientStages: Current stage assignments
 * - crmStageHistory: Stage transition history
 * - crmCustomFieldDefinitions: Custom field definitions
 * - crmClientFieldValues: Custom field values
 * - crmDirectMessages: Admin-sent messages
 *
 * Note: CRM activities are stored in the `events` table and queried via /api/events/crm
 */

import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organization";
import { messagingChannels } from "./channels";
import { clients } from "./session";
import { crmFieldTypeEnum, messageStatusEnum } from "./enums";

// =============================================================================
// CRM MODULE
// Pipeline stages, custom fields, direct messaging, and activity tracking
// =============================================================================

/**
 * CRM Pipelines - Named pipelines for organizing stages
 * Organizations can have multiple pipelines (Sales, Support, etc.)
 */
export const crmPipelines = pgTable(
  "crm_pipelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    isDefault: boolean("is_default").default(false),
    isActive: boolean("is_active").default(true),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_crm_pipelines_org").on(table.organizationId),
    index("idx_crm_pipelines_org_default").on(table.organizationId, table.isDefault),
    unique("crm_pipelines_org_name").on(table.organizationId, table.name),
    unique("crm_pipelines_org_slug").on(table.organizationId, table.slug),
  ]
);

/**
 * CRM Pipeline Stages - Custom stage definitions per pipeline
 * Examples: Lead, Qualified, Converted, Churned
 */
export const crmPipelineStages = pgTable(
  "crm_pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => crmPipelines.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    position: integer("position").notNull(),
    isDefault: boolean("is_default").default(false),
    isSystem: boolean("is_system").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_crm_stages_pipeline").on(table.pipelineId),
    index("idx_crm_stages_org").on(table.organizationId),
    unique("crm_stages_pipeline_name").on(table.pipelineId, table.name),
  ]
);

/**
 * CRM Client Stages - Current stage assignment per client per pipeline
 * A client can be in multiple pipelines simultaneously, each with its own stage
 */
export const crmClientStages = pgTable(
  "crm_client_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => crmPipelines.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => crmPipelineStages.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
  },
  (table) => [
    unique("crm_client_stage_pipeline").on(table.clientId, table.pipelineId),
    index("idx_crm_client_stages_client").on(table.clientId),
    index("idx_crm_client_stages_org").on(table.organizationId),
    index("idx_crm_client_stages_pipeline").on(table.pipelineId),
    index("idx_crm_client_stages_stage").on(table.stageId),
  ]
);

/**
 * CRM Stage History - Track stage transitions for analytics and timeline
 */
export const crmStageHistory = pgTable(
  "crm_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id").references(() => crmPipelines.id, { onDelete: "set null" }),
    fromStageId: uuid("from_stage_id").references(() => crmPipelineStages.id, { onDelete: "set null" }),
    toStageId: uuid("to_stage_id")
      .notNull()
      .references(() => crmPipelineStages.id, { onDelete: "cascade" }),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    durationMs: bigint("duration_ms", { mode: "number" }), // Time spent in previous stage (milliseconds)
  },
  (table) => [
    index("idx_crm_history_client_org").on(table.clientId, table.organizationId),
    index("idx_crm_history_pipeline").on(table.pipelineId),
    index("idx_crm_history_changed_at").on(table.changedAt),
  ]
);

/**
 * CRM Custom Field Definitions - Custom fields per organization
 * Supports: text, number, date, select, multi_select
 */
export const crmCustomFieldDefinitions = pgTable(
  "crm_custom_field_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(), // Programmatic key (snake_case)
    fieldType: crmFieldTypeEnum("field_type").notNull(),
    description: text("description"),
    isRequired: boolean("is_required").default(false),
    position: integer("position").notNull(),
    validation: jsonb("validation").$type<{
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      options?: Array<{ value: string; label: string }>;
    }>(),
    defaultValue: jsonb("default_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_crm_fields_org").on(table.organizationId), unique("crm_fields_org_key").on(table.organizationId, table.key)]
);

/**
 * CRM Client Field Values - Custom field values per client
 */
export const crmClientFieldValues = pgTable(
  "crm_client_field_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => crmCustomFieldDefinitions.id, { onDelete: "cascade" }),
    value: jsonb("value").notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("crm_field_values_unique").on(table.clientId, table.fieldId),
    index("idx_crm_field_values_client").on(table.clientId),
    index("idx_crm_field_values_field").on(table.fieldId),
  ]
);

/**
 * CRM Direct Messages - History of admin-sent messages to clients
 */
export const crmDirectMessages = pgTable(
  "crm_direct_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => messagingChannels.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: messageStatusEnum("status").default("pending"),
    platformMessageId: text("platform_message_id"), // Telegram message_id
    errorMessage: text("error_message"),
    sentBy: text("sent_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_crm_messages_client_org").on(table.clientId, table.organizationId),
    index("idx_crm_messages_sent_at").on(table.sentAt),
    index("idx_crm_messages_channel").on(table.channelId),
    index("idx_crm_messages_status").on(table.status),
  ]
);

