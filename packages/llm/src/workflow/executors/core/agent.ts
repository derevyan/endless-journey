/**
 * Agent Node Executor - Real LLM execution with tool calling
 *
 * Executes an LLM agent with full tool support:
 * - Built-in tools (messaging, memory, variables) when services are available
 * - External tools (embedded + MCP) always available
 *
 * This executor uses the unified runAgent() function from the agent engine,
 * providing parallel tool execution, retry logic, and proper token tracking.
 */

import type { AgentNodeConfig, AgentTool, ConversationMessage, ToolCall } from "@journey/schemas";
import { LLM_SERVICE_NAMES } from "@journey/schemas";
import { serializeError } from "@journey/logger";
import { runAgent, type AgentEngineResult } from "../../../agent";
import { getUsageTrackingAdapter } from "../../../adapters/usage-tracking-context";
import type { BuiltinToolContext } from "../../../tools/builtin/types";
import { unifiedToolRegistry } from "../../../tools/unified";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { resolveTemplate, buildPromptVariablesFromMappings } from "../../variable-resolver";
import { extractStructuredData, applyConversationHistoryStrategy } from "../../utilities";
import { BaseNodeExecutor } from "../base-executor";

/**
 * Agent node executor.
 *
 * Executes an LLM agent with the given configuration using the real LLM service.
 * Supports both built-in tools (when running within journey context) and external tools.
 */
export class AgentNodeExecutor extends BaseNodeExecutor<AgentNodeConfig> {
  readonly nodeType = "agent";

  protected async executeNode(input: NodeInput, config: AgentNodeConfig, context: WorkflowContext): Promise<NodeOutput> {
    context.log.info(
      {
        model: config.llm.model,
        hasServices: !!context.services,
      },
      "workflow:agent:config"
    );

    // Check for abort
    if (context.abortSignal?.aborted) {
      throw new Error("Workflow execution aborted");
    }

    // 1. Determine user message based on messageSource config
    // "auto" (default): Use userMessageOverride from upstream nodes (e.g., Question Understanding)
    // "original": Always use the original input.message
    const messageSource = config.messageSource ?? "auto";
    const userMessage =
      messageSource === "auto"
        ? (input.variables.userMessageOverride as string | undefined) ?? input.message
        : input.message;

    if (context.settings.mockLlm) {
      const mockResponse = userMessage
        ? `Mock response to: "${userMessage}"`
        : "Mock response";

      context.log.info(
        { mock: true, configuredModel: config.llm.model },
        "workflow:agent:mock"
      );

      return this.buildMockOutput(mockResponse, config);
    }

    // 2. Build context for variable resolution
    // Build nodes namespace from previous node outputs for variable resolution
    // This allows promptVariables to reference paths like "nodes.agent-alex.response"
    const nodes: Record<string, unknown> = {};
    for (const [nodeId, output] of input.previousNodeOutputs) {
      nodes[nodeId] = output;
    }

    // Debug: Log previousNodeOutputs and nodes namespace for troubleshooting promptVariables resolution
    context.log.info(
      {
        previousNodeIds: Array.from(input.previousNodeOutputs.keys()),
        nodesKeys: Object.keys(nodes),
        promptVariablesConfigured: !!config.promptVariables,
        hasChatMessages: !!config.chatMessages,
      },
      "workflow:agent:debugNodesNamespace"
    );

    // Build the context object for variable resolution
    const fullContext = {
      ...input.variables,
      user: context.user,
      journey: context.journey,
      nodes,
    };

    // Resolve prompt variables:
    // If promptVariables mappings are configured, use them to build variables for prompt compilation
    // Otherwise, use the full context directly (legacy behavior)
    let promptVars: Record<string, unknown>;
    if (config.promptVariables && Object.keys(config.promptVariables).length > 0) {
      // Use explicit mappings: { "input": "userResponse.value" } -> { input: <resolved value> }
      promptVars = buildPromptVariablesFromMappings(config.promptVariables, fullContext);
      context.log.debug(
        { mappingCount: Object.keys(config.promptVariables).length, resolvedCount: Object.keys(promptVars).length },
        "workflow:agent:promptVariablesResolved"
      );
    } else {
      // Legacy: pass full context for template resolution
      promptVars = fullContext;
    }

    // 3. Resolve system prompt and chat messages
    // Support two modes:
    // - Text prompt: config.systemPrompt (string) - legacy inline prompt
    // - Chat prompt: config.chatMessages (array) - from prompt repository
    let resolvedPrompt: string;
    let chatUserMessages: Array<{ role: string; content: string }> = [];

    if (config.chatMessages && config.chatMessages.length > 0) {
      // Chat-type prompt from repository
      // Extract system message(s) for the system prompt
      // Extract user/assistant messages to prepend to conversation
      const systemMessages: string[] = [];

      for (const msg of config.chatMessages) {
        const resolvedContent = resolveTemplate(msg.content, promptVars);
        if (msg.role === "system") {
          systemMessages.push(resolvedContent);
        } else {
          // User or assistant messages from the prompt template
          chatUserMessages.push({ role: msg.role, content: resolvedContent });
        }
      }

      resolvedPrompt = systemMessages.join("\n\n");
      context.log.debug(
        { systemMsgCount: systemMessages.length, chatMsgCount: chatUserMessages.length },
        "workflow:agent:chatMessagesResolved"
      );
    } else if (config.systemPrompt) {
      // Text-type prompt (inline or from repository)
      resolvedPrompt = resolveTemplate(config.systemPrompt, promptVars);
    } else if (config.promptRef) {
      // promptRef is set but neither systemPrompt nor chatMessages resolved
      context.log.warn(
        {
          promptRefName: config.promptRef.name,
          promptRefLabel: config.promptRef.label,
        },
        "workflow:agent:promptRefNotResolved - prompt not loaded from repository"
      );
      resolvedPrompt = "";
    } else {
      throw new Error("Agent node requires either systemPrompt, chatMessages, or promptRef");
    }

    // 3. Inject memories if enabled and memory service is available
    let processedPrompt = resolvedPrompt;
    if (config.memory?.enabled && context.services?.memory) {
      try {
        const memories = await context.services.memory.getRecent(
          config.memory.maxResults || 10
        );
        if (memories.length > 0) {
          const memoryContext = memories
            .map((m) => `- ${m.content}`)
            .join("\n");
          processedPrompt += `\n\n## What you remember about this user:\n${memoryContext}`;
          context.log.debug({ memoryCount: memories.length }, "workflow:agent:memoriesInjected");
        }
      } catch (err) {
        context.log.warn({ err: serializeError(err) }, "workflow:agent:memoryLoadFailed");
        // Continue without memories
      }
    }

    // 4. Append additional context from journey agent node (if configured)
    // This includes user profile, node outputs, session state, and custom context
    if (context.additionalSystemContext) {
      processedPrompt += "\n\n---\n\n" + context.additionalSystemContext;
      context.log.debug(
        { contextLength: context.additionalSystemContext.length },
        "workflow:agent:additionalContextInjected"
      );
    }

    // 4. Build tools - supports both unified and legacy config formats
    const tools: AgentTool[] = await this.buildTools(config, context);

    // 5. Apply history strategy and convert to agent format
    // This connects config.history (strategy, maxMessages) to actual message filtering
    context.log.debug(
      {
        historyConfig: config.history,
        configuredStrategy: config.history?.strategy,
        configuredMaxMessages: config.history?.maxMessages,
        inputHistoryCount: input.conversationHistory.length,
      },
      "workflow:agent:historyConfigReceived"
    );

    const historyResult = await applyConversationHistoryStrategy(
      input.conversationHistory,
      config.history
    );

    context.log.debug(
      {
        originalCount: historyResult.originalCount,
        processedCount: historyResult.messages.length,
        strategy: historyResult.appliedStrategy,
        summarized: historyResult.summaryGenerated,
      },
      "workflow:agent:historyProcessed"
    );

    // Build messages array with proper fallback chain
    // See buildMessages() for detailed documentation of the priority order
    const messages = this.buildMessages(
      historyResult.messages,
      chatUserMessages,
      userMessage,
      config.promptVariables,
      promptVars,
      historyResult.appliedStrategy,
      context
    );

    // Log if using override (helpful for debugging)
    if (messageSource === "auto" && input.variables.userMessageOverride) {
      context.log.debug(
        { originalMessage: input.message?.substring(0, 50), overrideLength: (userMessage ?? "").length },
        "workflow:agent:usingMessageOverride"
      );
    }

    // 6. Execute agent with real LLM
    // Provider names are now canonical LangChain names from LLMProviderSchema
    // (openai, anthropic, google-genai, groq) - no mapping needed

    const startTime = Date.now();
    let result: AgentEngineResult;

    // Build effective responseFormat with auto-applied JSON schema
    // When not explicitly configured, use default schema: { response: string }
    // When enableQuickReplies is true, extend with buttons array
    let effectiveResponseFormat = config.responseFormat;
    if (!effectiveResponseFormat || effectiveResponseFormat.type === "text") {
      const schema: Record<string, unknown> = {
        type: "object",
        properties: {
          response: { type: "string", description: "The AI response text" },
        },
        required: ["response"],
        additionalProperties: false,
      };

      // Extend with buttons if quick replies enabled
      if (config.enableQuickReplies) {
        (schema.properties as Record<string, unknown>).buttons = {
          type: "array",
          description: "Quick-reply buttons for user to choose from (2-4 options)",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Button text (max 30 chars)" },
              emoji: { type: "string", description: "Optional leading emoji" },
            },
            required: ["label"],
            additionalProperties: false,
          },
        };
        context.log.debug({ nodeId: config.name }, "workflow:agent:quickRepliesEnabled");
      }

      effectiveResponseFormat = {
        type: "json_schema",
        name: "ai_response",
        schema,
        strict: true,
        method: "functionCalling",
      };
    }

    // Debug: Log timing configuration for diagnosing tool execution order issues
    context.log.info(
      {
        nodeId: config.name,
        hasUnifiedTools: !!config.unifiedTools,
        hasOverrides: !!config.unifiedTools?.toolTimingOverrides,
        overrideKeys: Object.keys(config.unifiedTools?.toolTimingOverrides || {}),
        exitTiming: config.unifiedTools?.toolTimingOverrides?.["system:exit_to_next_node"],
      },
      "workflow:agent:timingConfig"
    );

    try {
      result = await runAgent(processedPrompt, messages, {
        model: config.llm.model,
        provider: config.llm.provider,
        temperature: config.llm.temperature ?? 0.7,
        maxTokens: config.llm.maxTokens,
        maxRetries: 2, // Default retries
        timeout: Math.floor(context.settings.nodeTimeoutMs / 1000), // Convert to seconds
        tools,
        maxIterations: 10,
        // Pass structured output configuration (auto-applied or explicit)
        responseFormat: effectiveResponseFormat,
        // Pass reasoning effort for reasoning models (o1, o3, etc.)
        reasoningEffort: config.llm.reasoningEffort,
        // Pass tool timing overrides from workflow config (user-configurable timing)
        runtime: config.unifiedTools?.toolTimingOverrides
          ? { toolTimingOverrides: config.unifiedTools.toolTimingOverrides }
          : undefined,
      });
    } catch (error) {
      context.log.error(
        { err: serializeError(error), model: config.llm.model },
        "workflow:agent:executionFailed"
      );
      throw error;
    }

    // 7. Track LLM usage for developer events page
    if (result.usage && context.orgId) {
      const adapter = getUsageTrackingAdapter();
      if (adapter.isReady?.()) {
        adapter.recordUsage(
          {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
            costUSD: result.usage.costUSD,
          },
          {
            organizationId: context.orgId,
            // Only set journeySessionId if there's a real journey session (not workflow testing)
            // Workflow tests use random UUIDs that don't exist in journey_sessions table
            journeySessionId: context.journey ? context.sessionId : undefined,
            journeyId: context.journey?.journeyId,
            service: LLM_SERVICE_NAMES.AGENT_WORKFLOW,
            module: config.name || "agent",
            model: config.llm.model,
            provider: config.llm.provider,
            systemPrompt: processedPrompt,
            inputMessages: messages.map((msg) => ({
              role: msg.role as "user" | "assistant" | "system" | "tool",
              content: msg.content,
            })),
            outputContent: result.content,
            outputToolCalls: result.toolCalls?.map((tc) => ({
              id: tc.id,
              name: tc.name,
              args: tc.args,
            })),
            finishReason: result.toolCalls?.length ? "tool_calls" : "stop",
            durationMs: Date.now() - startTime,
          }
        );
      }
    }

    // 8. Build output
    // Always provide token usage values (default to 0) to ensure workflow runner aggregation works
    // Even if LLM doesn't return usage metadata, we should track the call count
    const output: NodeOutput = {
      outHandle: this.determineOutHandle(result),
      response: result.content,
      toolCalls: this.convertToolCalls(result.toolCalls),
      executionTimeMs: 0, // Set by BaseNodeExecutor
      metadata: {
        model: config.llm.model,
        iterations: result.iterations,
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        costUSD: result.usage?.costUSD ?? 0,
      },
      // Pass through deferred tool calls for execution after message sent
      deferredToolCalls: result.deferredToolCalls,
      // Pass through explicit exit signal for reliable detection in handler
      exitRequested: result.exitRequested,
    };

    // Always include debug data for console logging
    const agentOutput = result.structuredResponse || {
      response: result.content,
      toolCalls: result.toolCalls,
      ...(extractStructuredData(result.content) || {}),
    };

    output.data = {
      // Debug info for console logs (always present)
      _debug: {
        response: result.content?.substring(0, 500), // Truncate for console
        toolCallCount: result.toolCalls?.length ?? 0,
        model: config.llm.model,
        iterations: result.iterations,
        usage: result.usage,
      },
      // Also store in outputVariable if configured (for downstream nodes)
      ...(config.outputVariable ? { [config.outputVariable]: agentOutput } : {}),
    };

    return output;
  }

  private buildMockOutput(response: string, config: AgentNodeConfig): NodeOutput {
    const output: NodeOutput = {
      outHandle: "default",
      response,
      toolCalls: [],
      executionTimeMs: 0,
      metadata: {
        model: "mock",
        iterations: 0,
        mock: true,
      },
    };

    const agentOutput = {
      response,
      toolCalls: [],
    };

    output.data = {
      _debug: {
        response: response.substring(0, 500),
        toolCallCount: 0,
        model: "mock",
        iterations: 0,
      },
      ...(config.outputVariable ? { [config.outputVariable]: agentOutput } : {}),
    };

    return output;
  }

  /**
   * Build tools using the unified format.
   * Resolves all tools via unified registry.
   */
  private async buildTools(
    config: AgentNodeConfig,
    context: WorkflowContext
  ): Promise<AgentTool[]> {
    // No tools configured
    if (!config.unifiedTools?.enabled?.length) {
      context.log.debug({}, "workflow:agent:noToolsConfigured");
      return [];
    }

    const unifiedConfig = config.unifiedTools;

    // Build context for system tools (if services available)
    const builtinContext = context.services ? this.buildToolContext(context, config) : null;

    // Resolve all tools via unified registry
    const tools = await unifiedToolRegistry.resolveTools(
      unifiedConfig.enabled,
      builtinContext ?? undefined,
      unifiedConfig.mcpServers
    );

    context.log.debug(
      {
        requested: unifiedConfig.enabled.length,
        resolved: tools.length,
        toolNames: tools.map((t) => t.name),
      },
      "workflow:agent:toolsLoaded"
    );

    return tools;
  }

  /**
   * Build the BuiltinToolContext from WorkflowContext.
   *
   * Builds context with available services. Per-tool service requirements
   * are checked by the unified registry's checkRequiredServices method.
   */
  private buildToolContext(
    context: WorkflowContext,
    config: AgentNodeConfig
  ): BuiltinToolContext | null {
    // If no services at all, can't build context for system tools
    if (!context.services) {
      context.log.debug({}, "workflow:agent:noServicesAvailable");
      return null;
    }

    // Log which services are available (for debugging)
    const availableServices = Object.entries(context.services)
      .filter(([, v]) => v != null)
      .map(([k]) => k);

    context.log.debug(
      { availableServices },
      "workflow:agent:buildingToolContext"
    );

    // Build context with whatever services ARE available
    // The unified registry will handle per-tool service checking
    return {
      nodeId: config.name || "agent",
      services: context.services,
      session: {
        sessionId: context.sessionId,
        journeyId: context.journey?.journeyId || "",
        userId: context.user.id,
        currentNodeId: context.journey?.currentNodeId || "workflow",
        tags: context.journey?.tags,
        context: context.journey?.variables,
      },
      clientData: context.clientData,
      log: context.log,
      // Voice settings flow from journey agent node via workflow context
      voiceMode: context.voiceMode,
      voiceProfile: context.voiceProfile,
      voiceProvider: context.voiceProvider,
      elevenLabsModel: context.elevenLabsModel,
    };
  }

  /**
   * Convert internal message format to agent format.
   */
  private convertMessages(
    history: ConversationMessage[]
  ): Array<{ role: string; content: string }> {
    return history.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(),
    }));
  }

  /**
   * Build messages array for LLM call.
   *
   * Message sources (in priority order):
   * 1. Conversation history (filtered by strategy - empty when strategy="none")
   * 2. Chat prompt messages (user/assistant messages from chat-type prompts)
   * 3. Current user message (from input.message or userMessageOverride)
   * 4. Fallback: First promptVariable value (for stateless nodes processing upstream data)
   *
   * At least one message is required for LLM providers (e.g., Gemini requires user/assistant messages).
   *
   * When strategy="none" with a text-type prompt:
   * - History is empty (by design)
   * - chatUserMessages is empty (text prompts don't have user/assistant messages)
   * - userMessage is added if present
   * - Otherwise, first promptVariable is used as fallback
   * - Error thrown if no messages can be constructed
   *
   * Recommendation: Use chat-type prompts with strategy="none" to ensure user messages are included.
   */
  private buildMessages(
    historyMessages: ConversationMessage[],
    chatUserMessages: Array<{ role: string; content: string }>,
    userMessage: string | undefined,
    promptVariables: Record<string, string> | undefined,
    promptVars: Record<string, unknown>,
    appliedStrategy: string,
    context: WorkflowContext
  ): Array<{ role: string; content: string }> {
    // Step 1: Start with conversation history (filtered by strategy)
    const messages = this.convertMessages(historyMessages);

    // Step 2: Add user/assistant messages from chat-type prompt templates
    // Chat prompts can define user/assistant messages that get prepended to conversation
    if (chatUserMessages.length > 0) {
      messages.push(...chatUserMessages);
      context.log.debug(
        { addedFromChatPrompt: chatUserMessages.length },
        "workflow:agent:chatMessagesAddedToHistory"
      );
    }

    // Step 3: Add current user message (if present and not using chat-type prompt)
    // For chat-type prompts, user message is already in chatUserMessages
    if (userMessage && chatUserMessages.length === 0) {
      messages.push({ role: "user", content: userMessage });
    }

    // Step 4: Fallback for stateless nodes - use first promptVariable as user message
    // This enables strategy="none" nodes that process input via promptVariables
    // (e.g., voice-director nodes receiving input from previous agent's response)
    if (messages.length === 0 && promptVariables && Object.keys(promptVariables).length > 0) {
      const primaryVarKey = Object.keys(promptVariables)[0];
      const primaryVarValue = promptVars[primaryVarKey];
      if (primaryVarValue && typeof primaryVarValue === "string" && primaryVarValue.trim()) {
        messages.push({ role: "user", content: primaryVarValue });
        context.log.debug(
          { variable: primaryVarKey, contentLength: primaryVarValue.length },
          "workflow:agent:promptVariableAsUserMessage"
        );
      }
    }

    // Step 5: Final validation - at least one message required for LLM providers
    if (messages.length === 0) {
      throw new Error(
        `Agent node requires at least one message to send to LLM. ` +
        `Strategy is "${appliedStrategy}", no user message provided, and no promptVariables to use as fallback. ` +
        `Tip: Use a Chat type prompt which includes user messages, or ensure promptVariables are configured.`
      );
    }

    return messages;
  }

  /**
   * Convert agent tool calls to internal format.
   */
  private convertToolCalls(
    agentCalls?: Array<{ name: string; args: unknown; result?: unknown; id: string }>
  ): ToolCall[] {
    if (!agentCalls) return [];
    return agentCalls.map((c) => ({
      id: c.id,
      name: c.name,
      args: c.args as Record<string, unknown>,
      result: c.result,
    }));
  }

  /**
   * Determine the output handle based on agent result.
   *
   * Note: exit_to_next_node is handled at the Journey level by agent-handler.ts,
   * not at the workflow level. Workflow always uses "default" to exit normally.
   */
  private determineOutHandle(_result: AgentEngineResult): string {
    // Always use default handle - let workflow end normally
    // Journey-level transition is handled by agent-handler.ts based on toolCalls
    return "default";
  }
}
