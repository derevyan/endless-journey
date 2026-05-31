/**
 * Mindstate Schema - Psychological/situational state tracking
 *
 * Tables for mindstate management:
 * - mindstateDefinitions: Organization-level templates
 * - clientMindstates: Runtime instances per client
 * - mindstateAnalysisLog: Analysis audit trail
 */

import type {
  MainAgent,
  SystemAgent,
  StateParameter,
  AgentInsight,
  PipelineMetrics,
  StateChange,
  AnalysisTrigger,
  AgentDispatchFailure,
} from "@journey/schemas";
import { boolean, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { mindstateStatusEnum } from "./enums";
import { organization } from "./organization";
import { clients, journeySessions } from "./session";

// =============================================================================
// MINDSTATE MODULE
// ECS-based psychological/situational state tracking for journey users
// =============================================================================

/**
 * Mindstate Definitions - Organization-level templates
 * Defines the structure and agents for a type of mindstate
 */
export const mindstateDefinitions = pgTable(
  "mindstate_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // e.g., "onboarding-progress", "support-mood"
    name: text("name").notNull(),
    description: text("description"),
    mainAgentConfig: jsonb("main_agent_config").$type<MainAgent>().notNull(),
    defaultAgents: jsonb("default_agents").$type<SystemAgent[]>().notNull(),
    defaultParameters: jsonb("default_parameters").$type<StateParameter[]>().notNull(),
    analysisMode: text("analysis_mode").$type<"automatic" | "selective" | "node-triggered" | "manual">().default("automatic"),
    categories: jsonb("categories").$type<string[]>().default([]),
    status: mindstateStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("mindstate_defs_org_key").on(table.organizationId, table.key),
    index("idx_mindstate_defs_org").on(table.organizationId),
    index("idx_mindstate_defs_status").on(table.organizationId, table.status),
  ]
);

/**
 * Client Mindstates - Runtime instances per client
 * Stores the actual state values for each user
 */
export const clientMindstates = pgTable(
  "client_mindstates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => mindstateDefinitions.id, { onDelete: "cascade" }),
    stateParameters: jsonb("state_parameters").$type<StateParameter[]>().notNull(),
    systemAgents: jsonb("system_agents").$type<SystemAgent[]>().notNull(),
    agentInsights: jsonb("agent_insights").$type<AgentInsight[]>().default([]),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("client_mindstate_unique").on(table.clientId, table.definitionId),
    index("idx_client_mindstates_client").on(table.clientId),
    index("idx_client_mindstates_def").on(table.definitionId),
  ]
);

/**
 * Mindstate Definition Versions - Version history for definitions
 * Stores snapshots of definition configurations for restore/audit purposes
 */
export const mindstateDefinitionVersions = pgTable(
  "mindstate_definition_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => mindstateDefinitions.id, { onDelete: "cascade" }),
    versionId: text("version_id").notNull(),
    notes: text("notes"),
    configuration: jsonb("configuration")
      .$type<{
        mainAgentConfig: MainAgent;
        defaultAgents: SystemAgent[];
        defaultParameters: StateParameter[];
        analysisMode: string;
        categories: string[];
      }>()
      .notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("unq_definition_version").on(table.definitionId, table.versionId),
    index("idx_mindstate_versions_definition").on(table.definitionId),
    index("idx_mindstate_versions_created").on(table.createdAt),
  ]
);

/**
 * Mindstate Analysis Log - Event sourcing for analysis pipeline executions
 * Provides audit trail and debugging for mindstate analysis
 */
export const mindstateAnalysisLog = pgTable(
  "mindstate_analysis_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientMindstateId: uuid("client_mindstate_id")
      .notNull()
      .references(() => clientMindstates.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => journeySessions.id, { onDelete: "set null" }),
    trigger: text("trigger").$type<AnalysisTrigger>().notNull(), // 'message' | 'node' | 'api'
    metrics: jsonb("metrics").$type<PipelineMetrics>(),
    changes: jsonb("changes").$type<StateChange[]>().default([]),
    newInsights: jsonb("new_insights").$type<AgentInsight[]>().default([]),
    inputMessage: text("input_message"),
    responseMessage: text("response_message"),

    // Debugging and audit fields for production troubleshooting
    failedAgents: jsonb("failed_agents").$type<AgentDispatchFailure[]>().default([]),
    conflicts: jsonb("conflicts").$type<Array<{
      parameterId: string;
      parameterName: string;
      agentIds: string[];
      selectedAgentId: string;
    }>>().default([]),
    mainAgentError: text("main_agent_error"),
    partialSuccess: boolean("partial_success").default(false),
    allAgentsFailed: boolean("all_agents_failed").default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mindstate_log_mindstate").on(table.clientMindstateId),
    index("idx_mindstate_log_session").on(table.sessionId),
    index("idx_mindstate_log_created").on(table.createdAt),
  ]
);
