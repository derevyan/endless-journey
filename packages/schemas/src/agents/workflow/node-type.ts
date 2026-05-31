import { z } from "zod";

// =============================================================================
// WORKFLOW NODE TYPES
// =============================================================================

/**
 * All available workflow node types.
 *
 * Categories:
 * - Core: start, agent, end
 * - Tools: guard, context, mcp
 * - Logic: if_else, user_approval
 * - Data: transform, set_state
 */
export const WorkflowNodeTypeSchema = z.enum([
  // Core - Required for basic workflow
  "start", // Entry point (exactly one per workflow)
  "agent", // LLM agent execution
  "end", // Terminal node, sends output

  // Tools - Utility nodes
  "guard", // Safety check (LLM Guard)
  "context", // Inject KB/Memory/RAG
  "mcp", // Call MCP server tool
  "question_understanding", // Synthesize unanswered questions

  // Logic - Control flow
  "if_else", // Conditional branch (yes/no)
  "user_approval", // Human in the loop

  // Data - Manipulation
  "transform", // Data transformation
  "set_state", // Store workflow variable
]);

export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>;

/**
 * Node types that have multiple output handles (branching nodes).
 */
export const BRANCHING_NODE_TYPES: WorkflowNodeType[] = ["if_else", "guard", "user_approval"];

/**
 * Node types that are not executed (informational only).
 */
export const NON_EXECUTABLE_NODE_TYPES: WorkflowNodeType[] = [];

/**
 * Expected output handles for each node type.
 * Used for validation and UI rendering.
 */
export const NODE_OUTPUT_HANDLES: Record<WorkflowNodeType, string[]> = {
  start: ["default"],
  agent: ["default"],
  end: [],
  guard: ["passed", "blocked"],
  context: ["default"],
  mcp: ["default"],
  question_understanding: ["default"],
  if_else: ["yes", "no"],
  user_approval: ["approved", "rejected"],
  transform: ["default"],
  set_state: ["default"],
};
