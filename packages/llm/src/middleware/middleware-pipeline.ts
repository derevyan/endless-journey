/**
 * Middleware Pipeline
 *
 * Executes middleware hooks in the correct order:
 * - beforeAgent/beforeModel: Forward order (by priority)
 * - wrapModelCall/wrapToolCall: Onion pattern (nested)
 * - afterModel/afterAgent: Reverse order
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/custom
 */

import { createLogger, serializeError } from "@journey/logger";
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
} from "../types";

const log = createLogger("llm:middleware-pipeline");

// ============================================================================
// Pipeline Class
// ============================================================================

/**
 * Middleware Pipeline
 *
 * Manages and executes middleware hooks in the correct order.
 * Handles state merging from middleware stateSchemas.
 *
 * Hook execution order:
 * ```
 * beforeAgent: mw1 → mw2 → mw3 (forward by priority)
 * beforeModel: mw1 → mw2 → mw3 (forward by priority)
 * wrapModelCall: mw1.wrap(mw2.wrap(mw3.wrap(handler))) (onion)
 * afterModel: mw3 → mw2 → mw1 (reverse order)
 * wrapToolCall: mw1.wrap(mw2.wrap(mw3.wrap(handler))) (onion)
 * afterAgent: mw3 → mw2 → mw1 (reverse order)
 * ```
 */
export class AgentMiddlewarePipeline {
  private middleware: AgentMiddleware[];
  private stopOnError: boolean;

  constructor(
    middleware: AgentMiddleware[],
    options: { stopOnError?: boolean } = {}
  ) {
    // Sort by priority (lower = runs first)
    this.middleware = [...middleware].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );
    this.stopOnError = options.stopOnError ?? false;

    // Validate state schemas for conflicts
    this.validateStateSchemas();

    log.debug(
      {
        middlewareNames: this.middleware.map((m) => m.name),
        priorities: this.middleware.map((m) => m.priority ?? 100),
      },
      "middleware:pipeline:initialized"
    );
  }

  /**
   * Validate that middleware state schemas don't have conflicting field names
   *
   * Two middlewares defining the same field could cause unexpected behavior.
   * This method logs warnings for any detected conflicts.
   */
  private validateStateSchemas(): void {
    const fieldDefinitions = new Map<string, string[]>();

    for (const mw of this.middleware) {
      if (!mw.stateSchema) continue;

      // Get all field names from the schema's shape
      const shape = mw.stateSchema.shape;
      if (!shape || typeof shape !== "object") continue;

      for (const fieldName of Object.keys(shape)) {
        // Skip core AgentState fields - those are expected
        if (fieldName === "messages" || fieldName === "systemPrompt" || fieldName === "model") {
          continue;
        }

        // Track which middlewares define this field
        const existing = fieldDefinitions.get(fieldName) ?? [];
        existing.push(mw.name);
        fieldDefinitions.set(fieldName, existing);
      }
    }

    // Log warnings for any fields defined by multiple middlewares
    for (const [field, middlewares] of fieldDefinitions) {
      if (middlewares.length > 1) {
        log.warn(
          {
            field,
            middlewares,
            note: "Multiple middlewares define the same state field. This may cause unexpected behavior.",
          },
          "middleware:pipeline:stateSchemaConflict"
        );
      }
    }
  }

  // ==========================================================================
  // State Initialization
  // ==========================================================================

  /**
   * Initialize state with defaults from all middleware stateSchemas
   *
   * Merges default values from each middleware's stateSchema into the state.
   */
  initializeState(
    baseState: AgentState,
    initialValues?: Record<string, unknown>
  ): AgentState {
    let state = { ...baseState };

    // Apply defaults from each middleware's stateSchema
    for (const mw of this.middleware) {
      if (mw.stateSchema) {
        try {
          // Parse with defaults - this will fill in default values
          const defaults = mw.stateSchema.parse({});
          state = { ...state, ...defaults };
        } catch (error) {
          log.warn(
            { middlewareName: mw.name, err: serializeError(error) },
            "middleware:pipeline:schemaDefaultsFailed"
          );
        }
      }
    }

    // Apply any explicit initial values (overrides defaults)
    if (initialValues) {
      state = { ...state, ...initialValues };
    }

    return state;
  }

  // ==========================================================================
  // Node-style Hooks (Sequential)
  // ==========================================================================

  /**
   * Execute beforeAgent hooks in forward order
   */
  async executeBeforeAgent(
    state: AgentState,
    runtime: AgentRuntime
  ): Promise<{ state: AgentState; jumpTo?: "end" | "tools" | "model" }> {
    return this.executeNodeHooks("beforeAgent", state, runtime);
  }

  /**
   * Execute beforeModel hooks in forward order
   */
  async executeBeforeModel(
    state: AgentState,
    runtime: AgentRuntime
  ): Promise<{ state: AgentState; jumpTo?: "end" | "tools" | "model" }> {
    return this.executeNodeHooks("beforeModel", state, runtime);
  }

  /**
   * Execute afterModel hooks in reverse order
   */
  async executeAfterModel(
    state: AgentState,
    runtime: AgentRuntime,
    response: ModelResponse
  ): Promise<{ state: AgentState; jumpTo?: "end" | "tools" | "model" }> {
    return this.executeNodeHooksReverse("afterModel", state, runtime, response);
  }

  /**
   * Execute afterAgent hooks in reverse order
   */
  async executeAfterAgent(
    state: AgentState,
    runtime: AgentRuntime
  ): Promise<{ state: AgentState; jumpTo?: "end" | "tools" | "model" }> {
    return this.executeNodeHooksReverse("afterAgent", state, runtime);
  }

  // ==========================================================================
  // Wrap-style Hooks (Onion Pattern)
  // ==========================================================================

  /**
   * Execute wrapModelCall hooks using onion pattern
   *
   * Creates a nested chain: mw1.wrap(mw2.wrap(mw3.wrap(coreHandler)))
   * When called, execution flows: mw1 → mw2 → mw3 → core → mw3 → mw2 → mw1
   */
  async executeWrapModelCall(
    request: ModelRequest,
    coreHandler: (req: ModelRequest) => Promise<ModelResponse>
  ): Promise<ModelResponse> {
    return this.executeWrapHook(
      (mw) => mw.hooks.wrapModelCall,
      request,
      coreHandler,
      "wrapModelCall"
    );
  }

  /**
   * Execute wrapToolCall hooks using onion pattern
   */
  async executeWrapToolCall(
    request: ToolCallRequest,
    coreHandler: (req: ToolCallRequest) => Promise<ToolCallResponse>
  ): Promise<ToolCallResponse> {
    return this.executeWrapHook(
      (mw) => mw.hooks.wrapToolCall,
      request,
      coreHandler,
      "wrapToolCall",
      (req) => ({ toolName: req.toolName }) // Extra context for logging
    );
  }

  /**
   * Generic helper for executing wrap-style hooks using onion pattern
   *
   * This eliminates duplication between wrapModelCall and wrapToolCall execution.
   * The onion pattern creates nested handlers: mw1.wrap(mw2.wrap(mw3.wrap(core)))
   */
  private async executeWrapHook<TRequest, TResponse>(
    hookGetter: (mw: AgentMiddleware) => ((req: TRequest, handler: (r: TRequest) => Promise<TResponse>) => Promise<TResponse>) | undefined,
    request: TRequest,
    coreHandler: (req: TRequest) => Promise<TResponse>,
    hookName: string,
    getLogContext?: (req: TRequest) => Record<string, unknown>
  ): Promise<TResponse> {
    // Get middleware with the specified hook
    const wrappingMiddleware = this.middleware.filter((mw) => hookGetter(mw));

    if (wrappingMiddleware.length === 0) {
      return coreHandler(request);
    }

    // Build nested handler chain (right to left for onion pattern)
    let handler = coreHandler;

    for (let i = wrappingMiddleware.length - 1; i >= 0; i--) {
      const mw = wrappingMiddleware[i];
      const previousHandler = handler;
      const hook = hookGetter(mw)!;

      handler = async (req: TRequest): Promise<TResponse> => {
        const logContext = { middlewareName: mw.name, ...getLogContext?.(req) };
        log.trace(logContext, `middleware:${hookName}:enter`);

        try {
          const result = await hook(req, previousHandler);
          log.trace(logContext, `middleware:${hookName}:exit`);
          return result;
        } catch (error) {
          log.error(
            { ...logContext, err: serializeError(error) },
            `middleware:${hookName}:error`
          );

          if (this.stopOnError) {
            throw error;
          }

          // Try to continue with next handler
          return previousHandler(req);
        }
      };
    }

    return handler(request);
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  /**
   * Execute node-style hooks in forward order (by priority)
   */
  private async executeNodeHooks(
    hookName: "beforeAgent" | "beforeModel",
    state: AgentState,
    runtime: AgentRuntime
  ): Promise<{ state: AgentState; jumpTo?: "end" | "tools" | "model" }> {
    let currentState = state;

    for (const mw of this.middleware) {
      const hook = mw.hooks[hookName];
      if (!hook) continue;

      log.trace({ middlewareName: mw.name, hookName }, "middleware:hook:executing");

      try {
        const result = await hook(currentState, runtime);

        if (result) {
          currentState = this.applyHookResult(currentState, result);

          // Check for jumpTo directive
          if (result.jumpTo) {
            log.debug(
              { middlewareName: mw.name, hookName, jumpTo: result.jumpTo },
              "middleware:hook:jumpTo"
            );
            return { state: currentState, jumpTo: result.jumpTo };
          }
        }

        log.trace({ middlewareName: mw.name, hookName }, "middleware:hook:completed");
      } catch (error) {
        log.error(
          { middlewareName: mw.name, hookName, err: serializeError(error) },
          "middleware:hook:error"
        );

        if (this.stopOnError) {
          throw error;
        }
        // Continue to next middleware
      }
    }

    return { state: currentState };
  }

  /**
   * Execute node-style hooks in reverse order (for after* hooks)
   */
  private async executeNodeHooksReverse(
    hookName: "afterModel" | "afterAgent",
    state: AgentState,
    runtime: AgentRuntime,
    response?: ModelResponse
  ): Promise<{ state: AgentState; jumpTo?: "end" | "tools" | "model" }> {
    let currentState = state;

    // Reverse iteration for after* hooks
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i];
      const hook = mw.hooks[hookName];
      if (!hook) continue;

      log.trace({ middlewareName: mw.name, hookName }, "middleware:hook:executing");

      try {
        // afterModel gets the response, afterAgent doesn't
        const result =
          hookName === "afterModel" && response
            ? await (hook as AgentMiddleware["hooks"]["afterModel"])!(
                currentState,
                runtime,
                response
              )
            : await (hook as AgentMiddleware["hooks"]["afterAgent"])!(
                currentState,
                runtime
              );

        if (result) {
          currentState = this.applyHookResult(currentState, result);

          // Check for jumpTo directive
          if (result.jumpTo) {
            log.debug(
              { middlewareName: mw.name, hookName, jumpTo: result.jumpTo },
              "middleware:hook:jumpTo"
            );
            return { state: currentState, jumpTo: result.jumpTo };
          }
        }

        log.trace({ middlewareName: mw.name, hookName }, "middleware:hook:completed");
      } catch (error) {
        log.error(
          { middlewareName: mw.name, hookName, err: serializeError(error) },
          "middleware:hook:error"
        );

        if (this.stopOnError) {
          throw error;
        }
        // Continue to next middleware
      }
    }

    return { state: currentState };
  }

  /**
   * Apply hook result to state
   *
   * Handles:
   * - messages replacement
   * - Custom state field updates
   * - Ignores jumpTo (handled separately)
   */
  private applyHookResult(state: AgentState, result: HookReturn): AgentState {
    if (!result) return state;

    const { messages, jumpTo, ...stateUpdates } = result;

    let newState = { ...state };

    // Apply messages if provided
    if (messages !== undefined) {
      newState.messages = messages;
    }

    // Apply all other state updates
    for (const [key, value] of Object.entries(stateUpdates)) {
      if (value !== undefined) {
        newState[key] = value;
      }
    }

    return newState;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get middleware names in execution order
   */
  getMiddlewareNames(): string[] {
    return this.middleware.map((m) => m.name);
  }

  /**
   * Get number of registered middleware
   */
  get size(): number {
    return this.middleware.length;
  }

  /**
   * Check if a middleware with the given name is registered
   */
  has(name: string): boolean {
    return this.middleware.some((m) => m.name === name);
  }
}

// ============================================================================
// Compose Middleware to Hooks
// ============================================================================

/**
 * Compose middleware array into AgentMiddlewareHooks for runAgent()
 *
 * This bridges the full middleware system (AgentMiddleware[]) with the
 * simpler hooks interface (AgentMiddlewareHooks) expected by runAgent().
 *
 * The composed hooks:
 * 1. Delegate to AgentMiddlewarePipeline methods
 * 2. Mutate the original state object in place (for state field persistence)
 * 3. Return { messages, jumpTo } format expected by runAgent()
 *
 * @internal Prefer passing middleware array directly to runAgent() config.
 * This function is used internally by runAgent() to compose middleware.
 *
 * @param middleware - Array of middleware to compose
 * @param options - Pipeline options (stopOnError, etc.)
 * @returns Hooks object for runAgent() and state initializer
 *
 * @example
 * ```typescript
 * // Preferred: Pass middleware directly to runAgent
 * const result = await runAgent(systemPrompt, messages, {
 *   ...config,
 *   middleware: [mw1, mw2], // Direct array
 * });
 *
 * // Internal usage (for advanced scenarios):
 * const { hooks, initializeState } = composeMiddlewareHooks([mw1, mw2]);
 * ```
 */
export function composeMiddlewareHooks(
  middleware: AgentMiddleware[],
  options?: { stopOnError?: boolean }
): {
  hooks: AgentMiddlewareHooks;
  initializeState: (state: AgentState, initial?: Record<string, unknown>) => AgentState;
} {
  const pipeline = new AgentMiddlewarePipeline(middleware, options);

  return {
    // State initializer for middleware default values
    initializeState: (state, initial) => pipeline.initializeState(state, initial),

    hooks: {
      // beforeAgent: Initialize state, load context
      beforeAgent: async (state, runtime) => {
        const result = await pipeline.executeBeforeAgent(state, runtime);
        // Mutate original state with all updated fields
        Object.assign(state, result.state);
        // Return format expected by runAgent()
        return { messages: result.state.messages, jumpTo: result.jumpTo };
      },

      // beforeModel: Prepare messages, check limits
      beforeModel: async (state, runtime) => {
        const result = await pipeline.executeBeforeModel(state, runtime);
        Object.assign(state, result.state);
        return { messages: result.state.messages, jumpTo: result.jumpTo };
      },

      // afterModel: Validate output, update state
      afterModel: async (state, runtime, response) => {
        const result = await pipeline.executeAfterModel(state, runtime, response);
        Object.assign(state, result.state);
        return { messages: result.state.messages, jumpTo: result.jumpTo };
      },

      // afterAgent: Cleanup, save results
      afterAgent: async (state, runtime) => {
        const result = await pipeline.executeAfterAgent(state, runtime);
        Object.assign(state, result.state);
        return { messages: result.state.messages, jumpTo: result.jumpTo };
      },

      // wrapModelCall: Model invocation with fallback, retry
      wrapModelCall: (request, handler) => pipeline.executeWrapModelCall(request, handler),

      // wrapToolCall: Tool execution with approval, validation
      wrapToolCall: (request, handler) => pipeline.executeWrapToolCall(request, handler),
    },
  };
}
