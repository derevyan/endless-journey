/**
 * Workflow Module - Agent workflow execution engine
 *
 * This module provides the runtime for executing agent workflows:
 * - Graph traversal and execution
 * - Safe expression evaluation
 * - Node executor registry
 * - Template variable resolution
 *
 * Usage:
 * ```typescript
 * import { runWorkflow, registerBuiltinExecutors } from '@journey/llm/workflow';
 *
 * // Register executors at startup
 * registerBuiltinExecutors();
 *
 * // Run a workflow
 * const result = await runWorkflow(workflow, { message: "Hello" }, context);
 * ```
 */

// Main runner
export { runWorkflow, resumeWorkflow, type ResumeWorkflowInput } from "./runner";

// Graph utilities
export { buildAdjacencyMap, findNode, findNodeByType } from "./graph";

// Expression evaluation (SAFE - no eval!)
export { evaluateCondition, resolveVariablePath } from "./expression-evaluator";

// Intent classification (LLM-based)
export { classifyIntent, type IntentClassificationResult } from "./intent-classifier";

// Template resolution
export { resolveTemplate, resolveObjectTemplates, buildPromptVariablesFromMappings } from "./variable-resolver";

// Utilities
export { extractJson, extractStructuredData } from "./utilities";

// Executor registry
export { registerNodeExecutor, getNodeExecutor, executorRegistry } from "./executor-registry";

// Executor registration
export { registerBuiltinExecutors } from "./executors";

// Types
export type {
  NodeInput,
  NodeOutput,
  WorkflowContext,
  WorkflowResult,
  NodeTrace,
  NodeExecutor,
  WorkflowLogger,
  AdjacencyMap,
  GraphEdge,
  PauseState,
  SerializableNodeInput,
  WorkflowPauseState,
  WorkflowEvent,
  WorkflowEventEmitter,
} from "./types";
