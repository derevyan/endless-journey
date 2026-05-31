import { z } from "zod";

// =============================================================================
// WORKFLOW EDGE
// =============================================================================

/**
 * Workflow edge connecting two nodes.
 *
 * For branching nodes, sourceHandle specifies which output:
 * - Guard: 'passed' | 'blocked'
 * - If/Else: 'yes' | 'no'
 * - UserApproval: 'approved' | 'rejected'
 */
export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1).max(100),
  source: z.string().min(1), // Source node ID
  target: z.string().min(1), // Target node ID

  // Output handle for branching nodes
  sourceHandle: z.string().optional(),

  // Input handle (usually not needed, but for complex nodes)
  targetHandle: z.string().optional(),

  // Optional label for display
  label: z.string().max(50).optional(),
});

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
