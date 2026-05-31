import { z } from "zod";
import { WorkflowNodeSchema } from "./node";
import { WorkflowEdgeSchema } from "./edge";

// =============================================================================
// WORKFLOW VARIABLES
// =============================================================================

/**
 * Workflow-level variable definition.
 * Variables can be set by nodes and used in templates/conditions.
 */
export const WorkflowVariableSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  defaultValue: z.unknown().optional(),
  description: z.string().max(500).optional(),
});

export type WorkflowVariable = z.infer<typeof WorkflowVariableSchema>;

// =============================================================================
// WORKFLOW CONFIGURATION
// =============================================================================

/**
 * Workflow Configuration - the graph structure.
 * Contains nodes, edges, and variables as a single unit.
 *
 * This matches the journey pattern where JourneyConfigSchema contains
 * { nodes, edges } as a nested object.
 */
export const WorkflowConfigurationSchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  variables: z.array(WorkflowVariableSchema).optional(),
});

export type WorkflowConfiguration = z.infer<typeof WorkflowConfigurationSchema>;
