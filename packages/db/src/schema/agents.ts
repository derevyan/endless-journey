/**
 * Agents Schema - Agent workflow builder tables
 *
 * Tables for agent workflow management:
 * - agentWorkflows: Visual workflow definitions (nodes + edges)
 * - agentDefinitions: Reusable agent configurations
 */

import type {
  WorkflowConfiguration,
  WorkflowSettings,
  WorkflowLLMConfig,
  UnifiedToolsConfig,
  ConversationHistoryConfig,
  MemoryConfig,
  ResponseFormat,
} from "@journey/schemas";
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organization";
import { workflowStatusEnum, approvalStatusEnum, timeoutActionEnum } from "./enums";

// =============================================================================
// AGENT WORKFLOWS
// =============================================================================

/**
 * Agent Workflows - Visual workflow definitions
 *
 * A workflow orchestrates multiple agents with conditional logic.
 * Following the journey pattern, the graph is stored in a nested
 * `configuration` object containing nodes, edges, and variables.
 */
export const agentWorkflows = pgTable(
  "agent_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // URL-safe unique key (e.g., "research-workflow")
    name: text("name").notNull(),
    description: text("description"),
    status: workflowStatusEnum("status").notNull().default("draft"),

    // NESTED CONFIGURATION - The graph (like journey.configuration)
    configuration: jsonb("configuration")
      .$type<WorkflowConfiguration>()
      .notNull()
      .default({ nodes: [], edges: [] }),

    // PERSISTENT SETTINGS - Workflow-level config (like journey.mindstateConfig)
    settings: jsonb("settings").$type<WorkflowSettings>(),

    // Audit fields
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete
  },
  (table) => [
    index("idx_agent_workflows_org").on(table.organizationId),
    index("idx_agent_workflows_status").on(table.status),
    // Partial unique index allows key reuse after soft delete
    uniqueIndex("unq_agent_workflows_org_key")
      .on(table.organizationId, table.key)
      .where(sql`deleted_at IS NULL`),
  ]
);

// =============================================================================
// AGENT DEFINITIONS
// =============================================================================

/**
 * Agent Definitions - Reusable agent configurations
 *
 * Agent definitions can be used in multiple workflows.
 * They contain the full agent configuration (prompt, LLM, tools, etc.).
 */
export const agentDefinitions = pgTable(
  "agent_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // URL-safe unique key (e.g., "research-agent")
    name: text("name").notNull(),
    description: text("description"),
    status: workflowStatusEnum("status").notNull().default("draft"),

    // Agent configuration
    systemPrompt: text("system_prompt").notNull(),
    llm: jsonb("llm").$type<WorkflowLLMConfig>().notNull(),
    tools: jsonb("tools").$type<UnifiedToolsConfig>(),
    conversationHistory: jsonb("conversation_history").$type<ConversationHistoryConfig>(),
    memory: jsonb("memory").$type<MemoryConfig>(),
    responseFormat: jsonb("response_format").$type<ResponseFormat>(),

    // Audit fields
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete
  },
  (table) => [
    index("idx_agent_definitions_org").on(table.organizationId),
    index("idx_agent_definitions_status").on(table.status),
    // Partial unique index allows key reuse after soft delete
    uniqueIndex("unq_agent_definitions_org_key")
      .on(table.organizationId, table.key)
      .where(sql`deleted_at IS NULL`),
  ]
);

// =============================================================================
// WORKFLOW VERSIONS
// =============================================================================

/**
 * Workflow Versions - Version history for agent workflows
 *
 * Each save creates a new version snapshot containing the full workflow
 * configuration (nodes, edges, variables). Versions can be restored or exported.
 */
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => agentWorkflows.id, { onDelete: "cascade" }),
    versionId: text("version_id").notNull(), // "v001", "v002", etc.
    notes: text("notes"),
    configuration: jsonb("configuration").$type<WorkflowConfiguration>(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("unq_workflow_version").on(table.workflowId, table.versionId),
    index("idx_workflow_versions_workflow").on(table.workflowId),
  ]
);

// =============================================================================
// WORKFLOW APPROVALS
// =============================================================================

/**
 * Workflow Approvals - Pending approvals for user_approval nodes
 *
 * When a workflow hits a user_approval node, it pauses and creates an
 * approval record. The workflow state is serialized for resume after
 * approval/rejection.
 */
export const workflowApprovals = pgTable(
  "workflow_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => agentWorkflows.id, { onDelete: "cascade" }),
    workflowRunId: text("workflow_run_id").notNull(), // Unique execution ID
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(), // The user_approval node ID

    // Display
    message: text("message").notNull(), // Approval request message

    // Status: pending, approved, rejected, timed_out
    status: approvalStatusEnum("status").notNull().default("pending"),

    // Serialized execution state for resume
    executionState: jsonb("execution_state").$type<{
      message: string;
      conversationHistory: Array<{ role: string; content: string }>;
      variables: Record<string, unknown>;
      previousNodeOutputs: Record<string, unknown>;
    }>(),

    // Timeout configuration
    timeoutSeconds: integer("timeout_seconds"), // Timeout in seconds
    timeoutAction: timeoutActionEnum("timeout_action"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    timeoutJobId: text("timeout_job_id"), // BullMQ job ID

    // Access control
    allowedRoles: jsonb("allowed_roles").$type<string[]>(),

    // Response tracking
    respondedBy: text("responded_by").references(() => user.id, { onDelete: "set null" }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    responseNote: text("response_note"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_workflow_approvals_org_status").on(table.organizationId, table.status),
    index("idx_workflow_approvals_expires").on(table.expiresAt),
    index("idx_workflow_approvals_workflow_run").on(table.workflowRunId),
  ]
);

