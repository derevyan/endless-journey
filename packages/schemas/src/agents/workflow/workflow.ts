import { z } from "zod";
import { WorkflowConfigurationSchema } from "./configuration";
import { WorkflowSettingsSchema } from "./settings";

// Re-export for backward compatibility
export { WorkflowVariableSchema, type WorkflowVariable } from "./configuration";
export { WorkflowConfigurationSchema, type WorkflowConfiguration } from "./configuration";
export { WorkflowSettingsSchema, type WorkflowSettings } from "./settings";

// =============================================================================
// WORKFLOW STATUS
// =============================================================================

export const WorkflowStatusSchema = z.enum(["draft", "active", "archived"]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

// =============================================================================
// AGENT WORKFLOW
// =============================================================================

/**
 * Agent Workflow - The visual canvas definition.
 *
 * A workflow orchestrates multiple agents with conditional logic.
 * Following the journey pattern, the graph is stored in a nested
 * `configuration` object containing nodes, edges, and variables.
 *
 * Settings (like journey's mindstateConfig) are stored separately
 * for workflow-level configuration.
 */
export const AgentWorkflowSchema = z.object({
  // Identity
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9-]*$/, {
      message: "Key must start with lowercase letter and contain only lowercase letters, numbers, and hyphens",
    }),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),

  // Status
  status: WorkflowStatusSchema.default("draft"),

  // NESTED CONFIGURATION - The graph (like journey.configuration)
  configuration: WorkflowConfigurationSchema,

  // PERSISTENT SETTINGS - Workflow-level config (like journey.mindstateConfig)
  settings: WorkflowSettingsSchema.nullable().optional(),

  // Audit fields
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
  deletedAt: z.coerce.date().optional(), // Soft delete
});

export type AgentWorkflow = z.infer<typeof AgentWorkflowSchema>;

// =============================================================================
// CREATE/UPDATE SCHEMAS
// =============================================================================

/**
 * Schema for creating a new workflow.
 */
export const CreateAgentWorkflowSchema = AgentWorkflowSchema.omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
}).extend({
  // Key is required for creation
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9-]*$/),
  // Configuration can be omitted (defaults to empty)
  configuration: WorkflowConfigurationSchema.optional().default({
    nodes: [],
    edges: [],
  }),
  // Settings are optional
  settings: WorkflowSettingsSchema.optional(),
});

export type CreateAgentWorkflow = z.infer<typeof CreateAgentWorkflowSchema>;

/**
 * Schema for updating an existing workflow.
 */
export const UpdateAgentWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: WorkflowStatusSchema.optional(),
  configuration: WorkflowConfigurationSchema.optional(),
  settings: WorkflowSettingsSchema.nullable().optional(),
});

export type UpdateAgentWorkflow = z.infer<typeof UpdateAgentWorkflowSchema>;
