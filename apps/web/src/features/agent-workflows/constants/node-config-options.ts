/**
 * Node Configuration Options
 *
 * Centralized constants for workflow node configuration panels.
 * Consolidates options that were previously scattered across individual config files.
 *
 * @module features/agent-workflows/constants/node-config-options
 */

import type { GuardWorker, TransformOperation, ContextSource } from "@journey/schemas";

// ============================================================================
// User Approval Node
// ============================================================================

/**
 * Preset timeout values for user approval nodes.
 */
export const TIMEOUT_PRESETS = [
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 86400, label: "24 hours" },
] as const;

/**
 * Actions to take when user approval times out.
 */
export const TIMEOUT_ACTIONS = [
  { value: "approve", label: "Auto-approve" },
  { value: "reject", label: "Auto-reject" },
  { value: "skip", label: "Skip (continue without action)" },
] as const;

// ============================================================================
// Context Node
// ============================================================================

/**
 * Available context source types.
 */
export const CONTEXT_SOURCE_TYPES = [
  { value: "memory", label: "Memory" },
  { value: "knowledge_base", label: "Knowledge Base" },
  { value: "rag", label: "RAG Index" },
] as const;

/**
 * Create default source configuration for a given type.
 */
export function createDefaultContextSource(type: ContextSource["type"]): ContextSource {
  switch (type) {
    case "memory":
      return { type: "memory", maxResults: 10, autoInject: true, recencyBias: 0.3 };
    case "knowledge_base":
      return { type: "knowledge_base", kbId: "", maxResults: 5, similarity: 0.7 };
    case "rag":
      return { type: "rag", indexId: "", maxResults: 5, similarity: 0.7 };
  }
}

// ============================================================================
// MCP Node
// ============================================================================

/**
 * Error handling actions for MCP tool calls.
 */
export const MCP_ERROR_ACTIONS = [
  { value: "fail", label: "Fail", description: "Stop workflow on error" },
  { value: "continue", label: "Continue", description: "Proceed with null result" },
  { value: "retry", label: "Retry", description: "Retry the operation" },
] as const;

// ============================================================================
// Transform Node
// ============================================================================

type OperationType = TransformOperation["type"];

/**
 * Available transform operation types.
 */
export const TRANSFORM_OPERATION_TYPES: Array<{
  value: OperationType;
  label: string;
  description: string;
}> = [
  { value: "template", label: "Template", description: "Handlebars string template" },
  { value: "extractJson", label: "Extract JSON", description: "Parse JSON from text" },
  { value: "pick", label: "Pick Fields", description: "Select specific fields" },
  { value: "merge", label: "Merge", description: "Combine multiple sources" },
];

/**
 * Create default operation configuration for a given type.
 */
export function createDefaultTransformOperation(type: OperationType): TransformOperation {
  switch (type) {
    case "template":
      return { type: "template", template: "{{input}}" };
    case "extractJson":
      return { type: "extractJson", sourceVariable: "lastAgent.response" };
    case "pick":
      return { type: "pick", sourceVariable: "result", fields: ["field1", "field2"] };
    case "merge":
      return { type: "merge", sources: ["source1", "source2"] };
  }
}

// ============================================================================
// Guard Node
// ============================================================================

/**
 * Available guard workers for content safety.
 */
export const GUARD_WORKERS: Array<{
  id: GuardWorker;
  label: string;
  description: string;
}> = [
  { id: "safety_guard", label: "Safety Guard", description: "Blocks harmful content" },
  { id: "injection_guard", label: "Injection Guard", description: "Prevents prompt injection" },
  { id: "policy_guard", label: "Policy Guard", description: "Custom policy rules" },
  { id: "spam_guard", label: "Spam Guard", description: "Detects spam and abuse" },
];

