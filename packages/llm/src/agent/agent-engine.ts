/**
 * Unified Agent Engine
 *
 * Single source of truth for agent execution loop.
 * Consolidates logic from llm-agent-service.ts and execute-with-middleware.ts.
 *
 * Key fixes from architecture review:
 * - Correct iteration counting (per model call, not just tool calls)
 * - Tool call ID generation when missing
 * - Fallback model tracking for accurate cost attribution
 * - Circuit breaker protection via model-runtime
 *
 * @module agent/agent-engine
 */

import { createLogger, serializeError } from "@journey/logger";
import type { TokenUsage, AgentTool, ToolRetryConfig, ToolExecutionTiming } from "@journey/schemas";
import { ensureToolCallId, addTokenUsage, emptyTokenUsage, BadRequestError, EngineError } from "@journey/schemas";
import { SYSTEM_TOOL_NAMES } from "../tools/unified/tool-names";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage, ContentBlock } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { tool } from "langchain";

import { getModelRegistryAdapter } from "../adapters/model-registry-context";
import { composeMiddlewareHooks } from "../middleware/middleware-pipeline";

// Import types from centralized location
import type {
  AgentMiddleware,
  AgentMiddlewareHooks,
  AgentState,
  AgentRuntime,
  ConversationMessage,
  ModelRequest,
  ModelResponse,
  ToolCallRequest,
  ToolCallResponse,
  HookReturn,
  ResponseFormat,
  StoredToolCall,
  AgentEngineConfig,
  AgentEngineResult,
  DeferredToolCall,
} from "../types";
import {
  createModelWithTools,
  createStructuredOutputModel,
  extractTokenUsage,
  invokeModelProtected,
  invokeStructuredOutputProtected,
  resolveProvider,
  toLangChainTools,
  buildModelConfig,
  type ModelConfig,
} from "../runtime/model-runtime";
import { initChatModel } from "langchain";

const log = createLogger("llm:agent:engine");

// =============================================================================
// Re-export types from centralized location
// =============================================================================

export type {
  AgentMiddleware,
  AgentMiddlewareHooks,
  AgentState,
  AgentRuntime,
  ConversationMessage,
  ModelRequest,
  ModelResponse,
  ToolCallRequest,
  ToolCallResponse,
  HookReturn,
  ResponseFormat,
  StoredToolCall,
  AgentEngineConfig,
  AgentEngineResult,
  DeferredToolCall,
} from "../types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a ModelRequest with override capability
 */
function createModelRequest(params: Omit<ModelRequest, "override">): ModelRequest {
  return {
    ...params,
    override(changes) {
      return createModelRequest({ ...params, ...changes });
    },
  };
}

/**
 * Convert plain messages to LangChain message objects
 */
function toLangChainMessages(messages: ConversationMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case "user":
        return new HumanMessage(msg.content);
      case "assistant":
        // Include tool_calls if present (required for multi-turn tool conversations)
        // See: https://docs.langchain.com/oss/javascript/langgraph/agentic-rag
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          return new AIMessage({
            content: msg.content,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              args: tc.args,
              type: "tool_call" as const,
            })),
          });
        }
        return new AIMessage(msg.content);
      case "system":
        return new SystemMessage(msg.content);
      case "tool":
        return new ToolMessage({
          content: msg.content,
          tool_call_id: msg.toolCallId || "",
        });
      default:
        return new HumanMessage(msg.content);
    }
  });
}

/**
 * Check if value is a ContentBlock array
 */
function isContentBlockArray(value: unknown): value is ContentBlock[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as { type?: unknown }).type === "string"
    )
  );
}

/**
 * Extract plain text from ContentBlock array
 * Concatenates all text blocks into a single string
 */
function extractTextFromContentBlocks(content: ContentBlock[]): string {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * Convert tool result to ToolMessage
 */
function toToolMessage(toolCallId: string, result: unknown): ToolMessage {
  if (result && typeof result === "object" && "content" in result) {
    const content = (result as { content?: unknown }).content;
    if (isContentBlockArray(content)) {
      return new ToolMessage({
        content,
        tool_call_id: toolCallId,
        artifact: result,
      });
    }
  }

  const content = typeof result === "string" ? result : JSON.stringify(result ?? null);
  return new ToolMessage({
    content,
    tool_call_id: toolCallId,
  });
}

/**
 * Synthetic result returned to LLM for deferred tools.
 * LLM sees "action queued" instead of waiting for actual execution.
 * @exported for testing
 */
export const DEFERRED_TOOL_RESULT = {
  success: true,
  deferred: true,
  message: "Action queued - will execute after response is sent to user",
} as const;

/**
 * Execute function with retry logic and exponential backoff
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: ToolRetryConfig | undefined,
  toolName: string
): Promise<T> {
  const maxRetries = config?.maxRetries ?? 0;
  const initialDelay = config?.initialDelayMs ?? 1000;
  const backoffFactor = config?.backoffFactor ?? 2.0;
  const shouldRetry = config?.retryOn ?? (() => true);

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries && shouldRetry(lastError)) {
        const delay = initialDelay * Math.pow(backoffFactor, attempt);
        log.debug(
          {
            toolName,
            attempt: attempt + 1,
            maxRetries,
            delayMs: delay,
            error: lastError.message,
          },
          "engine:toolRetry"
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else if (attempt < maxRetries) {
        log.debug(
          {
            toolName,
            attempt: attempt + 1,
            error: lastError.message,
          },
          "engine:toolRetrySkipped"
        );
        break;
      }
    }
  }

  throw lastError;
}

// =============================================================================
// Tool Timing Helpers
// =============================================================================

/**
 * Get the effective execution timing for a tool.
 *
 * Timing precedence:
 * 1. Runtime override (from UI toggle, if tool is configurable)
 * 2. Tool's default timing (from timingConfig.timing)
 * 3. Default to "immediate"
 *
 * @param tool - The tool definition
 * @param overrides - Runtime timing overrides from AgentRuntime
 * @returns The effective timing for this tool
 * @exported for testing
 */
export function getEffectiveTiming(
  tool: AgentTool | undefined,
  overrides?: Record<string, ToolExecutionTiming>
): ToolExecutionTiming {
  if (!tool) return "immediate";

  // Check for runtime override (from UI toggle)
  // The UI stores tool IDs with prefix (e.g., "system:exit_to_next_node")
  // but tool.name is just the bare name (e.g., "exit_to_next_node")
  // We try both formats for backward compatibility
  const override =
    overrides?.[tool.name] ??
    overrides?.[`system:${tool.name}`] ??
    overrides?.[`utility:${tool.name}`];

  if (override) {
    // Only apply override if tool is configurable
    if (tool.timingConfig?.configurable) {
      return override;
    }
    // Log warning if trying to override non-configurable tool
    log.debug(
      { toolName: tool.name, attemptedOverride: override },
      "engine:timingOverrideIgnored:notConfigurable"
    );
  }

  // Use tool's default timing
  return tool.timingConfig?.timing ?? "immediate";
}

// =============================================================================
// Main Agent Engine
// =============================================================================

/**
 * Execute an LLM agent with the unified engine
 *
 * This is the single source of truth for agent execution.
 * Both executeAgent() and executeAgentWithMiddleware() delegate to this.
 *
 * @param systemPrompt - System message defining agent behavior
 * @param messages - Conversation history
 * @param config - Agent configuration
 * @returns Agent result with tool calls and usage stats
 */
export async function runAgent(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  config: AgentEngineConfig
): Promise<AgentEngineResult> {
  const startTime = Date.now();
  const parallelExecution = config.parallelToolExecution ?? true;

  // Compose middleware if provided as array, otherwise use directly as hooks
  let middleware: AgentMiddlewareHooks | undefined;
  let initializeState: ((state: AgentState) => AgentState) | undefined;

  if (config.middleware) {
    if (Array.isArray(config.middleware)) {
      // AgentMiddleware[] - compose into hooks
      if (config.middleware.length > 0) {
        const composed = composeMiddlewareHooks(config.middleware);
        middleware = composed.hooks;
        initializeState = composed.initializeState;
        log.debug(
          { middlewareCount: config.middleware.length, names: config.middleware.map((m) => m.name) },
          "engine:middleware:composed"
        );
      }
    } else {
      // Already AgentMiddlewareHooks - use directly
      middleware = config.middleware;
    }
  }

  log.debug(
    {
      model: config.model,
      toolCount: config.tools.length,
      messageCount: messages.length,
      hasMiddleware: !!middleware,
    },
    "engine:start"
  );

  // Initialize state and runtime for middleware
  let state: AgentState = {
    messages: messages.map((m) => ({
      role: m.role as ConversationMessage["role"],
      content: m.content,
      timestamp: new Date(),
    })),
    systemPrompt,
    model: config.model,
  };

  // Apply middleware state initialization if available (adds default values from stateSchemas)
  if (initializeState) {
    state = initializeState(state);
  }

  const runtime: AgentRuntime = {
    context: {},
    ...config.runtime,
  };

  // Track execution metrics
  let iterations = 0;
  const maxIterations = config.maxIterations || 10;
  const allToolCalls: AgentEngineResult["toolCalls"] = [];
  const deferredToolCalls: DeferredToolCall[] = [];
  let totalUsage: TokenUsage = emptyTokenUsage();
  let modelUsed = config.model;
  let structuredResponse: Record<string, unknown> | undefined;

  // Ensure afterAgent runs even on error
  let afterAgentCalled = false;
  const runAfterAgent = async (): Promise<void> => {
    if (afterAgentCalled || !middleware?.afterAgent) return;
    afterAgentCalled = true;
    try {
      await middleware.afterAgent(state, runtime);
    } catch (error) {
      log.warn({ err: serializeError(error) }, "engine:afterAgent:error");
    }
  };

  try {
    // ========================================================================
    // PHASE 1: beforeAgent hooks
    // ========================================================================

    if (middleware?.beforeAgent) {
      const result = await middleware.beforeAgent(state, runtime);
      if (result?.jumpTo === "end") {
        log.debug({}, "engine:earlyExit:beforeAgent");
        await runAfterAgent();
        return {
          content: "Agent terminated by middleware",
          iterations: 0,
          usage: totalUsage,
          modelUsed,
        };
      }
      if (result?.messages) {
        state.messages = result.messages;
      }
    }

    // ========================================================================
    // PHASE 2: Handle structured output WITHOUT tools (simple path)
    // ========================================================================

    if (config.responseFormat?.type === "json_schema" && config.tools.length === 0) {
      const schema = config.responseFormat.schema;
      if (!schema || Object.keys(schema).length === 0) {
        throw new BadRequestError("Schema is required for json_schema response format", {
          responseFormatType: config.responseFormat.type,
          schemaName: config.responseFormat.name,
        });
      }

      log.debug({ schemaName: config.responseFormat.name }, "engine:structuredOutputNoTools");

      const structuredLlm = await createStructuredOutputModel(
        config,
        schema,
        config.responseFormat.name || "response",
        config.responseFormat.strict ?? true,
        config.responseFormat.method
      );

      const langchainMessages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        ...toLangChainMessages(state.messages),
      ];

      // Count this as an iteration
      iterations = 1;

      // Use circuit breaker protected invocation (Phase 2 fix)
      const result = await invokeStructuredOutputProtected(
        structuredLlm,
        langchainMessages,
        config.model
      );

      totalUsage = addTokenUsage(totalUsage, result.usage);
      // Track actual model used (may differ after middleware/fallback in future)
      const modelUsed = result.modelUsed;

      log.info(
        {
          model: config.model,
          iterations,
          durationMs: Date.now() - startTime,
          tokens: totalUsage.totalTokens,
        },
        "engine:complete"
      );

      await runAfterAgent();

      return {
        content: JSON.stringify(result.parsed),
        structuredResponse: result.parsed,
        iterations,
        usage: totalUsage,
        modelUsed,
        finalState: state,
      };
    }

    // ========================================================================
    // PHASE 3: Initialize model with tools
    // ========================================================================

    // Use centralized provider resolution (includes model registry lookup)
    const resolvedProvider = resolveProvider(config.model, config.provider);

    // Prepare tools (including __final_response__ for structured output with tools)
    const FINAL_RESPONSE_TOOL_NAME = "__final_response__";
    let effectiveTools = [...config.tools];

    if (config.responseFormat?.type === "json_schema") {
      const schema = config.responseFormat.schema;
      if (!schema || Object.keys(schema).length === 0) {
        throw new BadRequestError("Schema is required for json_schema response format", {
          responseFormatType: config.responseFormat.type,
          schemaName: config.responseFormat.name,
        });
      }

      log.debug({ schemaName: config.responseFormat.name }, "engine:structuredOutputWithTools");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalResponseTool: AgentTool<any, string> = {
        name: FINAL_RESPONSE_TOOL_NAME,
        description: `Submit the final structured response. You MUST call this tool when you have completed the task.`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: schema as any,
        execute: async (args: unknown) => {
          structuredResponse = args as Record<string, unknown>;
          return "Response recorded successfully";
        },
      };

      effectiveTools.push(finalResponseTool);
    }

    let baseLlm = await createModelWithTools(config, effectiveTools);

    // ========================================================================
    // PHASE 4: Agent Loop
    // ========================================================================

    while (iterations < maxIterations) {
      // ----------------------------------------------------------------------
      // Step 4a: beforeModel hooks
      // ----------------------------------------------------------------------

      if (middleware?.beforeModel) {
        const result = await middleware.beforeModel(state, runtime);
        if (result?.jumpTo === "end") {
          log.debug({ iteration: iterations }, "engine:earlyExit:beforeModel");
          break;
        }
        if (result?.messages) {
          state.messages = result.messages;
        }
      }

      // ----------------------------------------------------------------------
      // Step 4b: Model invocation
      // INCREMENT ITERATION HERE - per model call, not per tool call
      // ----------------------------------------------------------------------

      iterations++;

      // Build LangChain messages
      const langchainMessages: BaseMessage[] = [
        new SystemMessage(state.systemPrompt),
        ...toLangChainMessages(state.messages),
      ];

      // Create model request for middleware
      const modelRequest = createModelRequest({
        state,
        runtime,
        model: state.model,
        tools: effectiveTools,
        systemPrompt: state.systemPrompt,
        messages: state.messages,
      });

      // Core model handler
      const coreModelHandler = async (req: ModelRequest): Promise<ModelResponse> => {
        log.debug(
          { model: req.model, messageCount: req.messages.length, iteration: iterations },
          "engine:modelCall"
        );

        // Re-init model if changed by middleware (fallback scenario)
        let llm = baseLlm;
        if (req.model !== config.model) {
          modelUsed = req.model; // Track the actual model used
          // Clear provider on fallback to allow cross-provider routing
          // (e.g., OpenAI gpt-4o → Anthropic claude-sonnet)
          const newConfig = { ...config, model: req.model, provider: undefined };
          llm = await createModelWithTools(newConfig, req.tools);
        }

        // Build messages for this specific request
        const reqMessages: BaseMessage[] = [
          new SystemMessage(req.systemPrompt),
          ...toLangChainMessages(req.messages),
        ];

        const result = await invokeModelProtected(llm, reqMessages, req.model);
        const aiMessage = result.message;

        // Build response - extract text from content blocks if needed
        const response: ModelResponse = {
          content:
            typeof aiMessage.content === "string"
              ? aiMessage.content
              : isContentBlockArray(aiMessage.content)
                ? extractTextFromContentBlocks(aiMessage.content)
                : JSON.stringify(aiMessage.content),
          toolCalls: aiMessage.tool_calls?.map((tc) => ({
            id: ensureToolCallId(tc), // FIX: Generate ID if missing
            name: tc.name,
            args: tc.args,
          })),
          usage: result.usage,
        };

        return response;
      };

      // Execute with middleware wrapping
      let modelResponse: ModelResponse;
      if (middleware?.wrapModelCall) {
        modelResponse = await middleware.wrapModelCall(modelRequest, coreModelHandler);
      } else {
        modelResponse = await coreModelHandler(modelRequest);
      }

      // Update usage tracking
      if (modelResponse.usage) {
        totalUsage = addTokenUsage(totalUsage, modelResponse.usage);
      }

      log.debug(
        {
          iteration: iterations,
          hasToolCalls: !!modelResponse.toolCalls?.length,
          toolCallCount: modelResponse.toolCalls?.length || 0,
        },
        "engine:modelResponse"
      );

      // ----------------------------------------------------------------------
      // Step 4c: afterModel hooks
      // ----------------------------------------------------------------------

      if (middleware?.afterModel) {
        const result = await middleware.afterModel(state, runtime, modelResponse);
        if (result?.jumpTo === "end") {
          log.debug({ iteration: iterations }, "engine:earlyExit:afterModel");
          break;
        }
        if (result?.messages) {
          state.messages = result.messages;
        }
      }

      // ----------------------------------------------------------------------
      // Step 4d: Tool execution (if any)
      // ----------------------------------------------------------------------

      if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
        const hasExitTool = modelResponse.toolCalls.some(
          (toolCall) => toolCall.name === SYSTEM_TOOL_NAMES.EXIT_TO_NEXT_NODE
        );

        // Add AI message to conversation (preserve toolCalls for multi-turn conversations)
        state.messages.push({
          role: "assistant",
          content: modelResponse.content,
          timestamp: new Date(),
          toolCalls: modelResponse.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            args: (tc.args ?? {}) as Record<string, unknown>,
          })),
        });

        // Execute tools (parallel or sequential based on config)
        if (parallelExecution) {
          const toolResults = await Promise.all(
            modelResponse.toolCalls.map((toolCall) =>
              executeToolCall(
                toolCall,
                effectiveTools,
                state,
                runtime,
                middleware,
                FINAL_RESPONSE_TOOL_NAME,
                (parsed) => {
                  structuredResponse = parsed;
                },
                deferredToolCalls
              )
            )
          );

          // Process results in order
          for (const toolResult of toolResults) {
            if (!toolResult.skipMessage) {
              state.messages.push({
                role: "tool",
                content: toolResult.content,
                timestamp: new Date(),
                toolCallId: toolResult.toolCallId,
              });
            }
            if (toolResult.success) {
              allToolCalls.push({
                name: toolResult.name,
                args: toolResult.args,
                result: toolResult.result,
                id: toolResult.toolCallId,
              });
            }
          }
        } else {
          // Sequential execution
          for (const toolCall of modelResponse.toolCalls) {
            const toolResult = await executeToolCall(
              toolCall,
              effectiveTools,
              state,
              runtime,
              middleware,
              FINAL_RESPONSE_TOOL_NAME,
              (parsed) => {
                structuredResponse = parsed;
              },
              deferredToolCalls
            );

            if (!toolResult.skipMessage) {
              state.messages.push({
                role: "tool",
                content: toolResult.content,
                timestamp: new Date(),
                toolCallId: toolResult.toolCallId,
              });
            }
            if (toolResult.success) {
              allToolCalls.push({
                name: toolResult.name,
                args: toolResult.args,
                result: toolResult.result,
                id: toolResult.toolCallId,
              });
            }
          }
        }

        // Handle exit_to_next_node: always exit immediately when called
        // The exit detection happens in the HANDLER (agent-handler.ts:607-625),
        // not here. The engine just needs to return with the tool call recorded.
        // This works for both immediate AND deferred timing.
        if (hasExitTool) {
          const durationMs = Date.now() - startTime;
          log.info(
            {
              model: modelUsed,
              iterations,
              toolCallCount: allToolCalls.length,
              durationMs,
              tokens: totalUsage.totalTokens,
              costUSD: totalUsage.costUSD,
            },
            "engine:complete:exitTool"
          );

          await runAfterAgent();

          return {
            // Use structuredResponse for content when available (matches line 782 behavior)
            // This ensures response is sent even when model only returns tool calls
            content: structuredResponse ? JSON.stringify(structuredResponse) : (modelResponse.content || ""),
            structuredResponse,
            toolCalls: allToolCalls,
            iterations,
            usage: totalUsage,
            modelUsed,
            finalState: state,
            deferredToolCalls: deferredToolCalls.length > 0 ? deferredToolCalls : undefined,
            exitRequested: true, // Explicit signal for reliable exit detection
          };
        }

        // Handle __final_response__: exit immediately with structured response
        // This implements LangChain's ToolStrategy behavior where structured output
        // is captured and returned without requiring an additional LLM call
        if (structuredResponse) {
          const durationMs = Date.now() - startTime;
          log.info(
            {
              model: modelUsed,
              iterations,
              toolCallCount: allToolCalls.length,
              durationMs,
              tokens: totalUsage.totalTokens,
              costUSD: totalUsage.costUSD,
            },
            "engine:complete"
          );

          await runAfterAgent();

          return {
            // When structured response exists, return it as JSON string for parseAIResponse
            // This matches PHASE 2 behavior (line 402) for consistency
            content: structuredResponse ? JSON.stringify(structuredResponse) : modelResponse.content,
            structuredResponse,
            toolCalls: allToolCalls,
            iterations,
            usage: totalUsage,
            modelUsed,
            finalState: state,
            deferredToolCalls: deferredToolCalls.length > 0 ? deferredToolCalls : undefined,
          };
        }

        continue; // Continue loop to process tool results
      }

      // ----------------------------------------------------------------------
      // Step 4e: No tool calls - agent is done
      // Cost is already accumulated by addTokenUsage from per-iteration
      // extractTokenUsage calculations - do not recalculate here
      // ----------------------------------------------------------------------

      const durationMs = Date.now() - startTime;
      log.info(
        {
          model: modelUsed,
          iterations,
          toolCallCount: allToolCalls.length,
          durationMs,
          tokens: totalUsage.totalTokens,
          costUSD: totalUsage.costUSD,
        },
        "engine:complete"
      );

      await runAfterAgent();

      return {
        // When structured response exists, return it as JSON string for parseAIResponse
        // This matches PHASE 2 behavior (line 402) for consistency
        content: structuredResponse ? JSON.stringify(structuredResponse) : modelResponse.content,
        structuredResponse,
        toolCalls: allToolCalls,
        iterations,
        usage: totalUsage,
        modelUsed,
        finalState: state,
        deferredToolCalls: deferredToolCalls.length > 0 ? deferredToolCalls : undefined,
      };
    }

    // Max iterations exceeded
    await runAfterAgent();
    throw new EngineError(
      `Agent exceeded max iterations (${maxIterations}) for model ${config.model}`,
      undefined, // journeyId
      undefined, // nodeId
      "AGENT_MAX_ITERATIONS"
    );
  } catch (error) {
    await runAfterAgent();

    log.error(
      {
        model: config.model,
        err: serializeError(error),
        durationMs: Date.now() - startTime,
      },
      "engine:error"
    );

    throw error;
  }
}

// =============================================================================
// Tool Execution Helper
// =============================================================================

interface ToolExecutionResult {
  toolCallId: string;
  name: string;
  args: unknown;
  result?: unknown;
  content: string;
  success: boolean;
  skipMessage: boolean;
  /** If true, tool was deferred and added to deferredToolCalls array */
  deferred?: boolean;
}

async function executeToolCall(
  toolCall: { id: string; name: string; args: unknown },
  tools: AgentTool[],
  state: AgentState,
  runtime: AgentRuntime,
  middleware: AgentMiddlewareHooks | undefined,
  finalResponseToolName: string,
  onStructuredResponse: (parsed: Record<string, unknown>) => void,
  deferredToolCalls: DeferredToolCall[]
): Promise<ToolExecutionResult> {
  const toolCallId = ensureToolCallId(toolCall);

  // Handle __final_response__ tool (structured output)
  if (toolCall.name === finalResponseToolName) {
    const parsed = toolCall.args as Record<string, unknown>;
    onStructuredResponse(parsed);
    log.debug({ toolName: finalResponseToolName }, "engine:structuredResponseCaptured");

    return {
      toolCallId,
      name: toolCall.name,
      args: toolCall.args,
      result: parsed,
      content: "Response recorded successfully",
      success: true,
      skipMessage: false,
    };
  }

  // Find tool definition
  const toolDef = tools.find((t) => t.name === toolCall.name);
  if (!toolDef) {
    log.warn({ toolName: toolCall.name }, "engine:toolNotFound");
    return {
      toolCallId,
      name: toolCall.name,
      args: toolCall.args,
      content: JSON.stringify({ error: "Tool not found", message: `Unknown tool: ${toolCall.name}` }),
      success: false,
      skipMessage: false,
    };
  }

  // Validate tool arguments
  let validatedArgs = toolCall.args;
  if (toolDef.schema && typeof toolDef.schema.safeParse === "function") {
    const parseResult = toolDef.schema.safeParse(toolCall.args);
    if (!parseResult.success) {
      log.warn(
        {
          toolName: toolCall.name,
          args: toolCall.args,
          errors: parseResult.error.flatten(),
        },
        "engine:toolArgsValidationFailed"
      );

      return {
        toolCallId,
        name: toolCall.name,
        args: toolCall.args,
        content: JSON.stringify({
          error: "Invalid arguments",
          message: `Tool ${toolCall.name} received invalid arguments`,
          validationErrors: parseResult.error.flatten().fieldErrors,
        }),
        success: false,
        skipMessage: false,
      };
    }
    validatedArgs = parseResult.data;
  }

  // Check if tool should be deferred (execute after message sent)
  const effectiveTiming = getEffectiveTiming(toolDef, runtime.toolTimingOverrides);

  // Debug: Trace timing decision for diagnosing "After response" setting issues
  log.info(
    {
      toolName: toolCall.name,
      effectiveTiming,
      hasOverrides: !!runtime.toolTimingOverrides,
      overrideValue: runtime.toolTimingOverrides?.[toolDef.name] ??
                     runtime.toolTimingOverrides?.[`system:${toolDef.name}`],
      toolDefault: toolDef.timingConfig?.timing,
      isConfigurable: toolDef.timingConfig?.configurable,
    },
    "engine:tool:timingDecision"
  );

  if (effectiveTiming === "deferred") {
    // Add to deferred list with bound execute function (closure captures context)
    // Bug fix: Include retry wrapper so deferred tools respect retry config
    deferredToolCalls.push({
      name: toolCall.name,
      args: validatedArgs,
      toolCallId,
      execute: async () => {
        // Execute with full context and retry support when called later (after message sent)
        return await executeWithRetry(
          () => toolDef.execute(validatedArgs),
          toolDef.retry,
          toolDef.name
        );
      },
    });

    log.debug(
      { toolName: toolCall.name, toolCallId },
      "engine:tool:deferred"
    );

    // Return synthetic success to LLM
    // LLM sees "action queued" but doesn't wait for actual execution
    return {
      toolCallId,
      name: toolCall.name,
      args: toolCall.args,
      result: DEFERRED_TOOL_RESULT,
      content: JSON.stringify(DEFERRED_TOOL_RESULT),
      success: true,
      skipMessage: false,
      deferred: true,
    };
  }

  // Create tool call request for middleware
  const toolRequest: ToolCallRequest = {
    state,
    runtime,
    toolName: toolCall.name,
    toolArgs: validatedArgs,
    toolCallId,
    tool: toolDef,
  };

  // Core tool handler
  const coreToolHandler = async (req: ToolCallRequest): Promise<ToolCallResponse> => {
    try {
      const result = await executeWithRetry(
        () => req.tool.execute(req.toolArgs),
        req.tool.retry,
        req.toolName
      );

      log.debug({ toolName: req.toolName, success: true }, "engine:toolExecuted");
      return { result };
    } catch (error) {
      log.error({ toolName: req.toolName, err: serializeError(error) }, "engine:toolExecutionFailed");
      return {
        result: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

  // Execute with middleware wrapping
  let toolResponse: ToolCallResponse;
  if (middleware?.wrapToolCall) {
    toolResponse = await middleware.wrapToolCall(toolRequest, coreToolHandler);
  } else {
    toolResponse = await coreToolHandler(toolRequest);
  }

  // Build result
  const content = toolResponse.error
    ? JSON.stringify({ error: toolResponse.error.message, toolName: toolCall.name })
    : typeof toolResponse.result === "string"
      ? toolResponse.result
      : JSON.stringify(toolResponse.result);

  return {
    toolCallId,
    name: toolCall.name,
    args: toolCall.args,
    result: toolResponse.result,
    content,
    success: !toolResponse.error,
    skipMessage: toolResponse.skipMessage ?? false,
  };
}
