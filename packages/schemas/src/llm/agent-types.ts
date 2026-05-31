import { z } from "zod";
import {
  VariableScopePermissionSchema,
  type VariableScopePermission,
  ExternalTargetSchema as PermissionExternalTargetSchema,
  type ExternalTarget as PermissionExternalTarget,
} from "../runtime/permissions/resources";

// =============================================================================
// CANONICAL AGENT TOOL TYPES
// The ONLY tool/agent type definitions - all other files must import from here
// =============================================================================

// Re-export permission types for tool capabilities
export { VariableScopePermissionSchema, type VariableScopePermission };

/**
 * Per-tool retry configuration
 *
 * Follows exponential backoff pattern for transient error handling.
 * Used by both agent services and middleware pipeline.
 *
 * @example
 * const retryConfig: ToolRetryConfig = {
 *   maxRetries: 3,
 *   initialDelayMs: 1000,
 *   backoffFactor: 2.0,
 *   retryOn: (error) => error.message.includes('timeout'),
 * };
 */
export interface ToolRetryConfig {
  /** Maximum number of retry attempts (default: 0 = no retry) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2.0) */
  backoffFactor?: number;
  /** Optional function to determine if error should trigger retry */
  retryOn?: (error: Error) => boolean;
}

// -----------------------------------------------------------------------------
// Tool Execution Timing
// -----------------------------------------------------------------------------

/**
 * Tool execution timing relative to message sending
 *
 * - "immediate": Execute during workflow, LLM sees real result (default)
 * - "deferred": Execute after message sent to user, LLM sees synthetic result
 *
 * @example
 * // READ tools must be immediate - LLM needs the data
 * timing: "immediate"
 *
 * // WRITE tools can be deferred - fire-and-forget actions
 * timing: "deferred"
 */
export type ToolExecutionTiming = "immediate" | "deferred";

/**
 * Tool timing configuration
 *
 * Controls when a tool executes relative to message sending and whether
 * the UI can override the default timing.
 *
 * @example
 * // Fixed immediate timing (READ tools - LLM needs results)
 * timingConfig: {
 *   timing: "immediate",
 *   configurable: false,
 *   fixedReason: "LLM needs search results to respond",
 * }
 *
 * // Configurable timing (WRITE tools - UI shows toggle)
 * timingConfig: {
 *   timing: "deferred",
 *   configurable: true,
 * }
 */
export interface ToolTimingConfig {
  /** When to execute this tool relative to message sending */
  timing: ToolExecutionTiming;

  /** Whether timing can be changed in UI (false = fixed, shows info tooltip) */
  configurable: boolean;

  /** If not configurable, explains why (for docs/tooltips) */
  fixedReason?: string;
}

// -----------------------------------------------------------------------------
// Tool Capabilities
// -----------------------------------------------------------------------------

/**
 * Extended external target type that includes MCP
 */
export const ToolExternalTargetTypeSchema = z.enum([
  "webhook",
  "api",
  "email",
  "sms",
  "integration",
  "mcp",
]);

export type ToolExternalTargetType = z.infer<typeof ToolExternalTargetTypeSchema>;

/**
 * Tool external target (extends permission external target with MCP support)
 */
export interface ToolExternalTarget {
  type: ToolExternalTargetType;
  allowedDomains?: string[];
  rateLimit?: number;
}

export const ToolExternalTargetSchema = z.object({
  type: ToolExternalTargetTypeSchema,
  allowedDomains: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(0).optional(),
});

/**
 * Tool capabilities define what permissions a tool requires.
 *
 * Used by the permission system to determine if a tool should be
 * allowed to run in a given context. Capabilities are checked
 * before tool execution.
 *
 * @example
 * const capabilities: ToolCapabilities = {
 *   variables: {
 *     read: ["journey", "user"],
 *     write: ["journey"],
 *   },
 *   actions: ["sendMessage", "saveMemory"],
 *   external: [{ type: "api", allowedDomains: ["api.example.com"] }],
 * };
 */
export const ToolCapabilitiesSchema = z.object({
  /**
   * Variable scope access required by the tool.
   * @example { read: ["journey", "user"], write: ["journey"] }
   */
  variables: z
    .object({
      read: z.array(VariableScopePermissionSchema).optional(),
      write: z.array(VariableScopePermissionSchema).optional(),
    })
    .optional(),

  /**
   * System actions the tool performs.
   * @example ["sendMessage", "saveMemory"]
   */
  actions: z.array(z.string()).optional(),

  /**
   * External targets the tool accesses.
   * @example [{ type: "webhook" }]
   */
  external: z.array(ToolExternalTargetSchema).optional(),
});

export type ToolCapabilities = z.infer<typeof ToolCapabilitiesSchema>;

// -----------------------------------------------------------------------------
// Agent Tool Definition
// -----------------------------------------------------------------------------

/**
 * AgentTool - Canonical tool definition for LLM agents
 *
 * Tools are functions that agents can call during execution.
 * Each tool has a name, description, Zod schema for arguments,
 * and an execute function.
 *
 * This interface is used across:
 * - llm-agent-service.ts (executeAgent)
 * - middleware/execute-with-middleware.ts
 * - tools/unified/registry.ts
 * - workflow/executors/core/agent.ts
 *
 * @example
 * const searchTool: AgentTool = {
 *   name: "search",
 *   description: "Search the knowledge base",
 *   schema: z.object({ query: z.string() }),
 *   execute: async (args) => {
 *     return await searchKnowledgeBase(args.query);
 *   },
 *   capabilities: { external: [{ type: "api" }] },
 * };
 */
export interface AgentTool<TInput = unknown, TOutput = unknown> {
  /** Tool name (must be unique within an agent's tool set) */
  name: string;

  /** Tool description shown to LLM (helps model decide when to use it) */
  description: string;

  /** Zod schema for validating tool arguments */
  schema: z.ZodType<TInput>;

  /**
   * Tool execution function
   * @param args - Validated arguments matching the schema
   * @param context - Optional execution context (varies by runtime)
   * @returns Tool result (will be serialized for LLM)
   */
  execute: (args: TInput, context?: unknown) => Promise<TOutput>;

  /** Optional retry configuration for transient failures */
  retry?: ToolRetryConfig;

  /**
   * Optional capability requirements for this tool.
   * Used by the permission system to determine if the tool
   * should be allowed in the current execution context.
   */
  capabilities?: ToolCapabilities;

  /**
   * Execution timing configuration.
   *
   * Controls when tool executes relative to message sending:
   * - timing: "immediate" (default) or "deferred"
   * - configurable: whether UI can override (shows toggle)
   * - fixedReason: why timing is fixed (for non-configurable tools)
   *
   * @example
   * timingConfig: {
   *   timing: "deferred",
   *   configurable: true,
   * }
   */
  timingConfig?: ToolTimingConfig;
}

/**
 * AgentToolAny - Flexible tool interface using `any` types.
 *
 * Use this type when:
 * - Defining ToolFactory (builtin tools with destructured params)
 * - Working with MCP tools (JSON schemas, not Zod)
 * - Any context where strict typing is impractical
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AgentToolAny {
  /** Tool name (must be unique within an agent's tool set) */
  name: string;
  /** Tool description shown to LLM (helps model decide when to use it) */
  description: string;
  /** Schema for tool arguments (Zod schema or JSON schema) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  /** Tool execution function */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any, context?: unknown) => Promise<any>;
  /** Optional retry configuration for transient failures */
  retry?: ToolRetryConfig;
  /** Optional capability requirements for this tool */
  capabilities?: ToolCapabilities;
  /** Execution timing configuration (immediate or deferred) */
  timingConfig?: ToolTimingConfig;
}

// -----------------------------------------------------------------------------
// Tool Call Types
// -----------------------------------------------------------------------------

/**
 * Tool call requested by the model
 */
export const ToolCallSchema = z.object({
  /** Unique ID for this tool call (for correlating with results) */
  id: z.string(),
  /** Name of the tool to call */
  name: z.string(),
  /** Arguments passed to the tool */
  args: z.unknown(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Tool call result
 */
export const ToolResultSchema = z.object({
  /** Tool call ID (correlates with ToolCall.id) */
  toolCallId: z.string(),
  /** Tool name */
  name: z.string(),
  /** Result from tool execution */
  result: z.unknown(),
  /** Error message if execution failed */
  error: z.string().optional(),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Generate a stable tool call ID when one is missing
 *
 * Some LLM providers may not always provide tool call IDs.
 * This generates a deterministic ID based on tool name and timestamp.
 */
export function ensureToolCallId(toolCall: { id?: string; name: string }): string {
  if (toolCall.id && toolCall.id.trim() !== "") {
    return toolCall.id;
  }
  // Generate a stable ID: tool_<name>_<timestamp>_<random>
  return `tool_${toolCall.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Default retry configuration for tools that interact with services
 *
 * Retries on transient errors (network, connection, timeout).
 * Does NOT retry on validation errors or business logic errors.
 */
export const defaultToolRetryConfig: ToolRetryConfig = {
  maxRetries: 2,
  initialDelayMs: 500,
  backoffFactor: 2.0,
  retryOn: (error: Error) => {
    const message = error.message.toLowerCase();
    return (
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("socket")
    );
  },
};
