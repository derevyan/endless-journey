import { z } from "zod";
import { WorkflowNodeTypeSchema } from "./node-type";

// =============================================================================
// POSITION
// =============================================================================

/**
 * Position on React Flow canvas for workflow nodes.
 */
export const WorkflowPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type WorkflowPosition = z.infer<typeof WorkflowPositionSchema>;

// =============================================================================
// NODE ID
// =============================================================================

/**
 * Workflow Node ID format: type-shortid (e.g., "agent-x7Kf2m")
 * Reserved IDs: "start", "end" (can have custom prefix)
 */
export const WorkflowNodeIdSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "Node ID must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores"
  );

// =============================================================================
// WORKFLOW NODE
// =============================================================================

/**
 * Base workflow node schema.
 *
 * Note: The `data` field type varies by node type.
 * Use getNodeConfigSchema(type) to get the specific schema.
 */
export const WorkflowNodeSchema = z.object({
  id: WorkflowNodeIdSchema,
  type: WorkflowNodeTypeSchema,
  position: WorkflowPositionSchema,
  data: z.record(z.string(), z.unknown()), // Validated separately per node type
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
