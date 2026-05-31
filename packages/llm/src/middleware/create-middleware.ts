/**
 * Middleware Factory
 *
 * LangChain-style factory function for creating middleware.
 * Provides type-safe middleware creation with custom state schemas.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/custom
 */

import type { z } from "zod";
import type {
  AgentMiddleware,
  AgentMiddlewareHooks,
  AgentRuntime,
  AgentState,
  HookReturn,
  ModelRequest,
  ModelResponse,
  ToolCallRequest,
  ToolCallResponse,
} from "./types";

// ============================================================================
// Factory Configuration Type
// ============================================================================

/**
 * Configuration for createMiddleware factory
 *
 * Supports both simple middleware (no custom state) and stateful middleware
 * with Zod schema for type-safe state management.
 */
export interface CreateMiddlewareConfig<
  TStateSchema extends z.ZodRawShape = z.ZodRawShape,
> {
  /** Unique name for this middleware (used in logs and debugging) */
  name: string;

  /**
   * Custom state schema (optional)
   *
   * Define additional state fields that this middleware needs.
   * Fields are merged into AgentState at top level.
   *
   * @example
   * ```typescript
   * stateSchema: z.object({
   *   modelCallCount: z.number().default(0),
   *   userId: z.string().optional(),
   * })
   * ```
   */
  stateSchema?: z.ZodObject<TStateSchema>;

  /**
   * Priority for execution order (lower = runs first)
   * @default 100
   */
  priority?: number;

  // ---- Node-style hooks (sequential execution) ----

  /**
   * Runs once before agent starts
   */
  beforeAgent?: (
    state: AgentState & z.infer<z.ZodObject<TStateSchema>>,
    runtime: AgentRuntime
  ) => Promise<HookReturn> | HookReturn;

  /**
   * Runs before each model call
   */
  beforeModel?: (
    state: AgentState & z.infer<z.ZodObject<TStateSchema>>,
    runtime: AgentRuntime
  ) => Promise<HookReturn> | HookReturn;

  /**
   * Runs after each model response
   */
  afterModel?: (
    state: AgentState & z.infer<z.ZodObject<TStateSchema>>,
    runtime: AgentRuntime,
    response: ModelResponse
  ) => Promise<HookReturn> | HookReturn;

  /**
   * Runs once after agent completes
   */
  afterAgent?: (
    state: AgentState & z.infer<z.ZodObject<TStateSchema>>,
    runtime: AgentRuntime
  ) => Promise<HookReturn> | HookReturn;

  // ---- Wrap-style hooks (onion pattern) ----

  /**
   * Wraps each model call
   */
  wrapModelCall?: (
    request: ModelRequest,
    handler: (req: ModelRequest) => Promise<ModelResponse>
  ) => Promise<ModelResponse>;

  /**
   * Wraps each tool execution
   */
  wrapToolCall?: (
    request: ToolCallRequest,
    handler: (req: ToolCallRequest) => Promise<ToolCallResponse>
  ) => Promise<ToolCallResponse>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a middleware instance with type-safe configuration
 *
 * This is the primary way to create middleware, following LangChain's pattern.
 * Supports both stateful and stateless middleware.
 *
 * @example Simple logging middleware
 * ```typescript
 * const loggingMiddleware = createMiddleware({
 *   name: "LoggingMiddleware",
 *   beforeModel: (state, runtime) => {
 *     console.log(`Model call with ${state.messages.length} messages`);
 *   },
 *   afterModel: (state, runtime, response) => {
 *     console.log(`Model returned: ${response.content.slice(0, 100)}`);
 *   },
 * });
 * ```
 *
 * @example Stateful call counter middleware
 * ```typescript
 * const callCounterMiddleware = createMiddleware({
 *   name: "CallCounterMiddleware",
 *   stateSchema: z.object({
 *     modelCallCount: z.number().default(0),
 *   }),
 *   beforeModel: (state) => {
 *     if (state.modelCallCount >= 10) {
 *       return { jumpTo: "end" };
 *     }
 *   },
 *   afterModel: (state) => {
 *     return { modelCallCount: state.modelCallCount + 1 };
 *   },
 * });
 * ```
 *
 * @example Wrap-style retry middleware
 * ```typescript
 * const retryMiddleware = createMiddleware({
 *   name: "RetryMiddleware",
 *   priority: 5,
 *   wrapModelCall: async (request, handler) => {
 *     for (let attempt = 0; attempt < 3; attempt++) {
 *       try {
 *         return await handler(request);
 *       } catch (error) {
 *         if (attempt === 2) throw error;
 *         await sleep(1000 * Math.pow(2, attempt));
 *       }
 *     }
 *     throw new Error("Unreachable");
 *   },
 * });
 * ```
 */
export function createMiddleware<
  TStateSchema extends z.ZodRawShape = z.ZodRawShape,
>(config: CreateMiddlewareConfig<TStateSchema>): AgentMiddleware {
  // Build hooks object from config
  const hooks: AgentMiddlewareHooks = {};

  if (config.beforeAgent) {
    hooks.beforeAgent = config.beforeAgent as AgentMiddlewareHooks["beforeAgent"];
  }

  if (config.beforeModel) {
    hooks.beforeModel = config.beforeModel as AgentMiddlewareHooks["beforeModel"];
  }

  if (config.afterModel) {
    hooks.afterModel = config.afterModel as AgentMiddlewareHooks["afterModel"];
  }

  if (config.afterAgent) {
    hooks.afterAgent = config.afterAgent as AgentMiddlewareHooks["afterAgent"];
  }

  if (config.wrapModelCall) {
    hooks.wrapModelCall = config.wrapModelCall;
  }

  if (config.wrapToolCall) {
    hooks.wrapToolCall = config.wrapToolCall;
  }

  return {
    name: config.name,
    stateSchema: config.stateSchema,
    hooks,
    priority: config.priority ?? 100,
  };
}

// ============================================================================
// Helper: Create ModelRequest with override method
// ============================================================================

/**
 * Create a ModelRequest object with the override() method
 *
 * Used internally by the middleware pipeline to create request objects
 * that middleware can modify immutably.
 */
export function createModelRequest(
  base: Omit<ModelRequest, "override">
): ModelRequest {
  const request: ModelRequest = {
    ...base,
    override(changes: Partial<Omit<ModelRequest, "override">>): ModelRequest {
      return createModelRequest({
        ...base,
        ...changes,
      });
    },
  };
  return request;
}

// ============================================================================
// Decorator-style helpers (convenience functions)
// ============================================================================

/**
 * Create a simple beforeModel middleware
 *
 * Convenience function for single-hook middleware.
 *
 * @example
 * ```typescript
 * const logMessages = beforeModel("LogMessages", (state) => {
 *   console.log(`Messages: ${state.messages.length}`);
 * });
 * ```
 */
export function beforeModel(
  name: string,
  hook: (state: AgentState, runtime: AgentRuntime) => Promise<HookReturn> | HookReturn,
  priority = 100
): AgentMiddleware {
  return createMiddleware({
    name,
    priority,
    beforeModel: hook,
  });
}

/**
 * Create a simple afterModel middleware
 */
export function afterModel(
  name: string,
  hook: (
    state: AgentState,
    runtime: AgentRuntime,
    response: ModelResponse
  ) => Promise<HookReturn> | HookReturn,
  priority = 100
): AgentMiddleware {
  return createMiddleware({
    name,
    priority,
    afterModel: hook,
  });
}

/**
 * Create a simple wrapModelCall middleware
 */
export function wrapModelCall(
  name: string,
  hook: (
    request: ModelRequest,
    handler: (req: ModelRequest) => Promise<ModelResponse>
  ) => Promise<ModelResponse>,
  priority = 100
): AgentMiddleware {
  return createMiddleware({
    name,
    priority,
    wrapModelCall: hook,
  });
}

/**
 * Create a simple wrapToolCall middleware
 */
export function wrapToolCall(
  name: string,
  hook: (
    request: ToolCallRequest,
    handler: (req: ToolCallRequest) => Promise<ToolCallResponse>
  ) => Promise<ToolCallResponse>,
  priority = 100
): AgentMiddleware {
  return createMiddleware({
    name,
    priority,
    wrapToolCall: hook,
  });
}
