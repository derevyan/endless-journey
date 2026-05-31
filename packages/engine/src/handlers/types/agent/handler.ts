/**
 * Agent Workflow Node Handler
 *
 * Delegates agent execution to Agent Workflows. The agent node in journeys
 * is a thin reference layer - all agent logic (prompts, LLM config, tools,
 * conversation history) is defined in the referenced workflow.
 *
 * Key Features:
 * - Configurable execution modes: immediate, welcome_first, wait_for_input
 * - Welcome message with variable substitution (for welcome_first mode)
 * - Initial prompt for first execution (for immediate mode)
 * - Subsequent turns always use last_user_message
 * - Workflow-based execution via workflowKey reference
 * - Passes conversation history to workflow for context continuity
 * - Deterministic exit routing via edge guards
 * - Optional timeout-based exit
 *
 * @module handlers/agent-handler
 */

import { serializeError } from "@journey/logger";
import {
  BadRequestError,
  EngineError,
  NotFoundError,
  AgentWorkflowError,
  SYSTEM_TOOL_NAMES,
  type AgentNodeData,
  type AgentNodeOutput,
  type AgentState,
  type AgentWorkflow,
  type AgentExecutionMode,
  type ConversationMessage,
  type AIContextSettings,
} from "@journey/schemas";
import type { ActivationContext } from "../../../lifecycle/types";
import type {
  AgentWorkflowContext,
  AgentWorkflowInput,
  AgentWorkflowService,
  ExecutionContext,
  HandlerResult,
  JourneyEvent,
  NodeEventResult,
  TemplateService,
} from "../../../types";
import {
  assertNodeData,
  getOrBuildEvaluationContext,
  storeNodeOutput,
  sanitizeNodeLabel,
  isTimerEdge,
  WorkflowContextBuilder,
} from "../../../utils";
import {
  buildUserProfileContext,
  buildNodeOutputContext,
  buildSessionContext,
} from "../../../services";
import { createAgentStateManager, type AgentStateManager } from "../../../state";
import { BaseNodeHandler } from "../../base-handler";


// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default maximum number of responses to keep in agent allResponses history.
 * Prevents unbounded memory growth in long conversations.
 * Can be overridden per-agent via AgentNodeData.maxResponseHistory (if added to schema).
 */
const DEFAULT_MAX_RESPONSE_HISTORY = 50;

/**
 * Timeout for deferred tool execution (in milliseconds).
 * Deferred tools execute after the message is sent to the user.
 * This timeout prevents a hung tool from blocking subsequent deferred tools.
 */
const DEFERRED_TOOL_TIMEOUT_MS = 30_000;

// =============================================================================
// AI RESPONSE PARSING (Quick-Reply Buttons)
// =============================================================================

export interface AIResponseWithButtons {
  response: string;
  buttons?: Array<{ label: string; emoji?: string }>;
}

/**
 * Parse AI response as JSON to extract response text and optional buttons.
 * Treats the entire response as plain text if parsing fails.
 * @exported for testing
 */
export function parseAIResponse(responseText: string): AIResponseWithButtons {
  try {
    const parsed = JSON.parse(responseText);
    // Ensure response field exists, fallback to original text
    return {
      response: typeof parsed.response === "string" ? parsed.response : responseText,
      buttons: Array.isArray(parsed.buttons) ? parsed.buttons : undefined,
    };
  } catch {
    return { response: responseText };
  }
}

/**
 * Convert AI-generated buttons to ButtonConfig format for messenger.
 * Combines emoji + label and generates unique IDs.
 * @exported for testing
 */
export function buttonsToConfig(
  buttons: Array<{ label: string; emoji?: string }>
): Array<{ id: string; text: string }> {
  return buttons.slice(0, 4).map((btn, idx) => ({
    id: `ai-reply-${idx}`,
    text: btn.emoji ? `${btn.emoji} ${btn.label}`.slice(0, 35) : btn.label.slice(0, 35),
  }));
}

// =============================================================================
// TIMER SCHEDULING
// =============================================================================

/**
 * Schedule timeout timer for agent node if configured.
 * Timer is scheduled once when first entering the node.
 * Unlike message nodes, agent timers do NOT reset on user activity.
 *
 * @returns Timer ID if scheduled, undefined if no timer configured or already scheduled
 */
async function scheduleTimeoutTimer(
  context: ExecutionContext,
  nodeData: AgentNodeData,
  agentState: AgentStateManager
): Promise<string | undefined> {
  const { services, log, node, outgoingEdges } = context;

  // Skip if already scheduled (tracked in agent state)
  if (agentState.hasTimer()) {
    return agentState.getTimerId();
  }

  // Check if timeout is configured
  const timeoutSeconds = nodeData.timeout?.seconds;
  if (!timeoutSeconds || timeoutSeconds <= 0) {
    return undefined;
  }

  // Find timer edge
  const timerEdge = outgoingEdges.find(isTimerEdge);
  if (!timerEdge) {
    log.warn({ nodeId: node.id, timeoutSeconds }, "agent:timerConfigured:noTimerEdge");
    return undefined;
  }

  // Schedule the timer
  const delayMs = timeoutSeconds * 1000;
  const timerId = await services.timer.scheduleTimer(delayMs, timerEdge.id);

  log.info(
    { nodeId: node.id, delayMs, edgeId: timerEdge.id, timerId },
    "agent:timerScheduled"
  );

  return timerId;
}

// =============================================================================
// TEMPLATE PROCESSING
// =============================================================================

/**
 * Process welcome message with variable substitution.
 * Uses the template service to resolve {{variable}} patterns.
 */
async function processWelcomeMessage(
  template: string,
  context: ExecutionContext
): Promise<string> {
  const evalContext = await getOrBuildEvaluationContext(context);
  return context.services.template.substitute(template, evalContext);
}

/**
 * Resolve workflow input based on execution state.
 *
 * Design principle: conversationHistory is the SINGLE SOURCE OF TRUTH for all messages.
 * The `message` field is only used for EXTERNAL inputs that are NOT in history:
 * - initialPrompt template (first execution in immediate mode)
 * - userMessageOverride (set by upstream workflow nodes)
 *
 * For normal user messages: they are already in conversationHistory, so message = "".
 * This prevents duplicate messages being sent to the LLM.
 */
async function resolveWorkflowInput(
  context: ExecutionContext,
  nodeData: AgentNodeData,
  conversationHistory: ConversationMessage[],
  agentState: AgentStateManager
): Promise<AgentWorkflowInput> {
  const { services, log } = context;
  // executionMode is validated in execute() before this is called
  const mode = nodeData.executionMode!;

  let message = "";
  let source = "from_history";
  const isFirstExecution = !agentState.isWorkflowInitialized();

  // Only pass `message` when it's an EXTERNAL input not already in conversationHistory.
  // In all other cases, the user's message is already in conversationHistory -
  // passing it separately would cause duplicates in the LLM input.
  if (isFirstExecution) {
    if (mode === "immediate" && nodeData.initialPrompt?.template) {
      // EXTERNAL INPUT: Template-generated prompt is NOT in history
      const template = nodeData.initialPrompt.template;
      const evalContext = await getOrBuildEvaluationContext(context);
      message = services.template.substitute(template, evalContext);
      source = "initial_prompt";
    }
    // else: message stays "" - the user message is already in conversationHistory
  }
  // For subsequent executions: message stays "" - history contains all messages

  log.debug(
    { nodeId: context.node.id, source, isFirstExecution, messageLength: message.length },
    "agent:inputResolved"
  );

  return { message, conversationHistory };
}

// =============================================================================
// AI CONTEXT BUILDING
// =============================================================================

/**
 * Build AI context string from journey agent node's aiContext settings.
 * This context is appended to the workflow's system prompt.
 *
 * Uses the AIContextBuilder service functions to generate well-formatted
 * markdown context for LLMs.
 */
function buildAIContextForWorkflow(
  aiContext: AIContextSettings,
  context: ExecutionContext,
  evalContext: Record<string, unknown>,
  templateService: TemplateService
): string {
  const { session } = context;
  const parts: string[] = [];

  // 1. User profile context (name, email, etc.)
  if (aiContext.includeUserProfile) {
    const profile = buildUserProfileContext(evalContext);
    if (profile) parts.push(profile);
  }

  // 2. Node context (most recent node output, smart extraction by node type)
  if (aiContext.includeNodeContext) {
    const nodeOutputs = session.nodeOutputs ?? {};
    const recentOutput = Object.values(nodeOutputs)
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .at(0);
    if (recentOutput) {
      const nodeContext = buildNodeOutputContext(
        recentOutput.nodeLabel,
        recentOutput.nodeType,
        recentOutput.data
      );
      if (nodeContext) parts.push(nodeContext);
    }
  }

  // 3. Full session context (tags, variables, history)
  if (aiContext.includeSessionContext) {
    const sessionContext = buildSessionContext({
      tags: session.tags,
      context: session.context,
      history: session.history,
    });
    if (sessionContext) parts.push(sessionContext);
  }

  // 4. Custom context template with variable substitution
  if (aiContext.customContext) {
    const resolved = templateService.substitute(aiContext.customContext, evalContext);
    if (resolved) {
      parts.push("## Additional Context\n" + resolved);
    }
  }

  return parts.filter(Boolean).join("\n\n---\n\n");
}

// =============================================================================
// WORKFLOW EXECUTION SUPPORT
// =============================================================================

/**
 * Execute a workflow and return a handler result.
 * This bridges the workflow runner with the journey engine.
 */
async function executeWorkflowWithInput(
  workflowService: AgentWorkflowService,
  workflow: AgentWorkflow,
  context: ExecutionContext,
  nodeData: AgentNodeData,
  conversationHistory: ConversationMessage[],
  agentState: AgentStateManager
): Promise<HandlerResult> {
  const { node, session, services, log, clientData, outgoingEdges, stateManager } = context;
  const forceExitNode = process.env.TELEGRAM_PARITY_FORCE_EXIT === "true";

  // Typing indicator support - start if enabled and adapter supports it
  const typingEnabled = nodeData.typingIndicatorEnabled !== false; // default true
  const chatId = session.platformUserId;
  const adapter = services.adapter;

  // Helper to start typing indicator (safe - logs warning on failure)
  const startTyping = async () => {
    if (typingEnabled && adapter?.startTypingIndicator) {
      try {
        await adapter.startTypingIndicator(chatId);
      } catch (error) {
        log.warn({ err: serializeError(error) }, "agent:typingIndicator:startFailed");
      }
    }
  };

  // Helper to stop typing indicator (safe - no-op if not started or not supported)
  const stopTyping = () => {
    if (typingEnabled && adapter?.stopTypingIndicator) {
      adapter.stopTypingIndicator(chatId);
    }
  };

  // Build full evaluation context for workflow template/expression access
  // This includes vars.*, nodes.*, session.*, user.* namespaces
  const evalContext = await getOrBuildEvaluationContext(context);

  // Build workflow variables using centralized builder
  // Merges: session context → journey variables → node settings → initial context
  const contextBuilder = new WorkflowContextBuilder(evalContext)
    .withSessionContext(session.context || {})
    .withJourneyVariables()
    .withNodeSettings(nodeData)
    .withInitialContext(nodeData.initialContext, services.template);

  // Add mindstate if available in evalContext
  if (evalContext.mindstate) {
    contextBuilder.withMindstate(evalContext.mindstate as Record<string, Record<string, unknown>>);
  }

  const workflowVariables = contextBuilder.build();

  log.debug({
    workflowVariablesKeys: contextBuilder.getKeys(),
    hasUserResponse: !!workflowVariables.userResponse,
    userResponseInputType: (workflowVariables.userResponse as Record<string, unknown>)?.inputType,
  }, "agent:workflowVariables");

  const workflowContext: AgentWorkflowContext = {
    orgId: context.organizationId || "",
    sessionId: session.sessionId,
    user: {
      id: clientData?.id || session.userId || "",
      firstName: clientData?.firstName,
      lastName: clientData?.lastName,
      email: undefined,
      metadata: {},
    },
    journey: {
      journeyId: session.journeyId,
      currentNodeId: node.id,
      variables: workflowVariables,
      tags: session.tags,
    },
    clientData: clientData,
    log,
    settings: {
      maxExecutionTimeMs: 60000, // 1 minute default
      nodeTimeoutMs: 30000, // 30 seconds per node
      mockLlm: process.env.FORCE_MOCK_LLM === "true",
    },
    // Inject services for built-in tools in workflow agent nodes
    services,
    // Wire in workflow event emitter for real-time SSE updates (if available)
    emit: services.workflowEventEmitter,
    // Full evaluation context with all namespaces (vars.*, nodes.*, session.*, user.*)
    evalContext,
    // Voice settings - prefer nodeData, fallback to workflowVariables (journey vars)
    voiceMode: nodeData.voiceMode || (workflowVariables.voiceMode as typeof nodeData.voiceMode),
    voiceProfile: nodeData.voiceProfile || (workflowVariables.voiceProfile as string | undefined),
    voiceProvider: nodeData.voiceProvider || (workflowVariables.voiceProvider as typeof nodeData.voiceProvider),
    elevenLabsModel: nodeData.elevenLabsModel || (workflowVariables.elevenLabsModel as typeof nodeData.elevenLabsModel),
    // AI context settings - builds additional context to append to workflow system prompt
    additionalSystemContext: nodeData.aiContext
      ? buildAIContextForWorkflow(nodeData.aiContext, context, evalContext, services.template)
      : undefined,
  };

  // Resolve workflow input based on execution state (first vs subsequent)
  const input = await resolveWorkflowInput(context, nodeData, conversationHistory, agentState);

  // Mark workflow as initialized after first execution
  if (!agentState.isWorkflowInitialized()) {
    agentState.markWorkflowInitialized();
  }

  // Start typing indicator before workflow execution (LLM processing)
  await startTyping();

  // Execute workflow with full conversation history
  let result;
  try {
    result = await workflowService.runWorkflow({ workflow, input, context: workflowContext });
  } catch (error) {
    // Stop typing on error
    stopTyping();

    // Emit user-friendly error to simulator console
    services.eventLogger.logEvent({
      type: "engine.error",
      nodeId: node.id,
      payload: {
        code: "agent_workflow_error",
        message: "The AI agent encountered an issue. Please try again.",
      },
    });
    if (forceExitNode) {
      const completionEdges = outgoingEdges.filter((e) => !isTimerEdge(e));
      if (completionEdges.length > 0) {
        log.warn({ nodeId: node.id, forced: true }, "agent:exitToNextNode:workflowError");
        return {
          action: "transition",
          targetNodeId: completionEdges[0].target,
          trigger: "workflow_error",
        };
      }
    }
    // Wrap with domain context for better debugging (if not already a domain error)
    if (error instanceof AgentWorkflowError || error instanceof EngineError) {
      throw error;
    }
    throw new AgentWorkflowError(
      `Agent workflow failed for node ${node.id}`,
      session.journeyId,
      node.id,
      workflow.key,
      false, // isRetryable - most workflow errors are not retryable
      error
    );
  }

  // Stop typing after workflow completes successfully
  stopTyping();

  // Accumulate token usage from this workflow execution
  if (result.usage) {
    agentState.accumulateUsage(result.usage);
  }

  // Increment message count for multi-turn conversations
  agentState.incrementMessageCount();

  log.info(
    {
      nodeId: node.id,
      workflowKey: workflow.key,
      success: result.success,
      blocked: result.blocked,
      nodesExecuted: result.trace.length,
      durationMs: result.totalDurationMs,
      tokensThisTurn: result.usage?.totalTokens ?? 0,
      totalTokensAccumulated: agentState.getTotalTokens(),
    },
    "agent:workflow:complete"
  );

  // Store as node output (for cross-node references via {{nodes.Label.field}} and impersonate mode replay)
  // Store BEFORE handling blocked/success paths so all executions are captured
  // Use hybrid model: store both last response and all responses for multi-turn conversations

  // Get existing output to build on (for multi-turn conversations)
  const nodeLabel = sanitizeNodeLabel(node.data.label || "");
  const existingOutput = session.nodeOutputs?.[nodeLabel];
  const existingData = existingOutput?.data as Partial<AgentNodeOutput> | undefined;
  const allResponses = existingData?.allResponses ? [...existingData.allResponses] : [];

  // Get the last user message for context
  const lastUserMessage = services.conversationHistory.getLastUserMessage(conversationHistory);

  // Append current response to history
  allResponses.push({
    response: result.response ?? "",
    success: result.success,
    blocked: result.blocked || false,
    blockedMessage: result.blockedMessage,
    toolCalls: result.toolCalls || [],
    durationMs: result.totalDurationMs,
    traceLength: result.trace?.length || 0,
    executedAt: new Date().toISOString(),
    userMessage: lastUserMessage,
    tokensUsed: result.usage?.totalTokens ?? 0,
    costUSD: result.usage?.totalCostUSD ?? 0,
  });

  // Trim response history to prevent unbounded memory growth
  // Get limit from node config or use default
  const maxResponseHistory = (nodeData as { maxResponseHistory?: number }).maxResponseHistory ?? DEFAULT_MAX_RESPONSE_HISTORY;
  if (allResponses.length > maxResponseHistory) {
    // Keep the most recent responses, remove oldest ones
    allResponses.splice(0, allResponses.length - maxResponseHistory);
  }

  // Build hybrid output data with last + all responses
  const outputData = {
    // Last response (for easy downstream access via {{nodes.Label.lastResponse}})
    lastResponse: result.response,
    lastSuccess: result.success,
    lastBlocked: result.blocked || false,
    lastBlockedMessage: result.blockedMessage,
    lastToolCalls: result.toolCalls || [],
    lastDurationMs: result.totalDurationMs,
    lastTraceLength: result.trace?.length || 0,
    lastTurnTokens: result.usage?.totalTokens ?? 0,
    lastTurnCostUSD: result.usage?.totalCostUSD ?? 0,

    // All responses (complete history for impersonate/export)
    allResponses,

    // Conversation metrics from agent state
    conversationMetrics: {
      turnCount: allResponses.length,
      messageCount: agentState.getMessageCount(),
      totalTokens: agentState.getTotalTokens(),
      totalCostUSD: agentState.getTotalCostUSD(),
      conversationStartedAt: agentState.getState().conversationStartedAt,
      lastTurnAt: new Date().toISOString(),
    },
  };

  storeNodeOutput(session, node, outputData, stateManager);

  // Debug: Log workflow result summary for diagnosing message delivery issues
  log.info(
    {
      nodeId: node.id,
      success: result.success,
      hasResponse: !!result.response,
      responseLength: result.response?.length,
      exitRequested: result.exitRequested,
      deferredToolCount: result.deferredToolCalls?.length,
      deferredToolNames: result.deferredToolCalls?.map((t) => t.name),
      toolCallCount: result.toolCalls?.length,
      toolCallNames: result.toolCalls?.map((t) => t.name),
    },
    "agent:workflow:resultSummary"
  );

  // If workflow was blocked by a guard
  if (result.blocked) {
    if (forceExitNode) {
      const completionEdges = outgoingEdges.filter((e) => !isTimerEdge(e));
      if (completionEdges.length > 0) {
        log.info({ nodeId: node.id, forced: true }, "agent:exitToNextNode:blocked");
        return {
          action: "transition",
          targetNodeId: completionEdges[0].target,
          trigger: "workflow_blocked",
        };
      }
    }
    if (result.blockedMessage) {
      await services.messenger.sendMessage(
        result.blockedMessage,
        undefined,
        undefined,
        undefined,
        nodeData.voiceMode ? { voice: { mode: nodeData.voiceMode, profile: nodeData.voiceProfile, provider: nodeData.voiceProvider, elevenLabsModel: nodeData.elevenLabsModel } } : undefined
      );
    }
    return { action: "wait" };
  }

  // Check if exit should happen BEFORE response (immediate timing)
  // When exit_to_next_node is IMMEDIATE ("Before response"), we skip sending the message
  // When exit_to_next_node is DEFERRED ("After response"), we send the message first
  // Key insight: If exit_to_next_node is in deferredToolCalls[], it's deferred; otherwise immediate
  const exitIsDeferred = result.deferredToolCalls?.some((tc) => tc.name === SYSTEM_TOOL_NAMES.EXIT_TO_NEXT_NODE);
  const shouldSkipMessageForExit = result.exitRequested && !exitIsDeferred;

  // Debug: Log message delivery decision for diagnosing timing issues
  log.info(
    {
      nodeId: node.id,
      exitIsDeferred,
      exitRequested: result.exitRequested,
      shouldSkipMessageForExit,
      willSendMessage: result.success && !!result.response && !shouldSkipMessageForExit,
    },
    "agent:message:decisionTrace"
  );

  // If workflow completed successfully, send the response
  // Note: send_message tool should NOT be enabled for journey agents to avoid duplicates
  // Journey engine handles all message delivery via result.response
  // Skip message if exit_to_next_node was called with immediate timing ("Before response")
  if (result.success && result.response && !shouldSkipMessageForExit) {
    // Parse JSON response for structured output with optional quick-reply buttons
    const { response, buttons } = parseAIResponse(result.response);
    const buttonConfigs = buttons?.length ? buttonsToConfig(buttons) : undefined;

    // Debug: Log structured output parsing result
    log.debug(
      {
        nodeId: node.id,
        hasButtons: !!buttons?.length,
        buttonCount: buttons?.length ?? 0,
        responseLength: response.length,
        rawResponseLength: result.response.length,
        isJson: result.response.startsWith("{"),
      },
      "agent:parseAIResponse:result"
    );

    if (buttonConfigs) {
      // Store activeButtons for button click label lookup
      const activeButtons = buttonConfigs.map((btn) => ({
        id: btn.id,
        text: btn.text,
        source: "agent" as const,
        // No targetNodeId - agent re-execute logic handles routing
      }));
      context.stateManager.setActiveButtons(activeButtons);

      log.debug(
        { nodeId: node.id, buttonCount: buttonConfigs.length },
        "agent:quickReplyButtons:sending"
      );
    }

    await services.messenger.sendMessage(
      response,
      buttonConfigs,
      undefined,
      undefined,
      nodeData.voiceMode ? { voice: { mode: nodeData.voiceMode, profile: nodeData.voiceProfile, provider: nodeData.voiceProvider, elevenLabsModel: nodeData.elevenLabsModel } } : undefined
    );
  } else if (shouldSkipMessageForExit) {
    // Log when we skip message due to immediate exit timing
    log.info(
      { nodeId: node.id, hasResponse: !!result.response },
      "agent:message:skippedForImmediateExit"
    );
  } else if (result.success && !result.response?.trim()) {
    // BUG INDICATOR: LLM workflow succeeded but produced no response content
    // This causes silent message skipping - user never receives their response!
    //
    // Debug checklist:
    // 1. Check agent:workflow:resultSummary log above for hasResponse/responseLength
    // 2. Look for engine:complete - did LLM generate tokens?
    // 3. Check structured output config - is response being captured correctly?
    // 4. Trace: agent-engine.ts:830 → agent.ts:368 → here
    log.warn(
      {
        nodeId: node.id,
        responseLength: result.response?.length ?? 0,
        responseType: typeof result.response,
        exitRequested: result.exitRequested,
        shouldSkipMessageForExit,
      },
      "agent:message:skippedDueToEmptyResponse"
    );
  }

  // Execute deferred tools AFTER message sent (fire-and-forget)
  // These tools have timing="deferred" and were not executed during workflow
  if (result.deferredToolCalls?.length) {
    log.info(
      { nodeId: node.id, count: result.deferredToolCalls.length },
      "agent:deferredTools:executing"
    );

    for (const deferred of result.deferredToolCalls) {
      try {
        // Use Promise.race to enforce timeout - prevents hung tools from blocking the loop
        await Promise.race([
          deferred.execute(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Deferred tool timeout after ${DEFERRED_TOOL_TIMEOUT_MS}ms: ${deferred.name}`)),
              DEFERRED_TOOL_TIMEOUT_MS
            )
          ),
        ]);
        log.debug(
          { nodeId: node.id, toolName: deferred.name },
          "agent:deferredTool:success"
        );
      } catch (error) {
        // Fire-and-forget: log error but don't fail the handler
        // User already received their response - this is background cleanup
        log.error(
          { nodeId: node.id, toolName: deferred.name, err: serializeError(error) },
          "agent:deferredTool:error"
        );
      }
    }
  }

  // Check if the agent explicitly requested to exit to the next node
  const shouldExitNode = result.exitRequested === true;

  // Only transition if exit was explicitly requested
  const completionEdges = outgoingEdges.filter((e) => !isTimerEdge(e));
  if ((shouldExitNode || forceExitNode) && completionEdges.length > 0) {
    log.info(
      { nodeId: node.id, forced: forceExitNode && !shouldExitNode },
      "agent:exitToNextNode:triggered"
    );
    return {
      action: "transition",
      targetNodeId: completionEdges[0].target,
      trigger: "workflow_complete",
    };
  }

  // Stay on agent node, wait for next user message
  log.debug({ nodeId: node.id }, "agent:waiting:nextMessage");
  return { action: "wait" };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export class AgentNodeHandler extends BaseNodeHandler<AgentNodeData> {
  readonly nodeType = "agent" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { node, log, services } = context;
    const nodeData = assertNodeData<AgentNodeData>(node, "agent");
    const agentState = createAgentStateManager(
      context.getState<AgentState>(),
      context.setState
    );

    // Validate required fields
    if (!nodeData.workflowKey) {
      throw new BadRequestError("Agent node requires workflowKey", { nodeId: node.id });
    }
    if (!nodeData.executionMode) {
      throw new BadRequestError("Agent node requires executionMode field", { nodeId: node.id });
    }
    const executionMode = nodeData.executionMode;

    log.info(
      {
        nodeId: node.id,
        nodeLabel: nodeData.label,
        executionMode,
        initialGreetingSent: agentState.isInitialGreetingSent(),
      },
      "agent:executeStart"
    );

    // Schedule timeout timer if configured (once per node entry)
    // Timer does NOT reset on user messages - fires at fixed time from entry
    const timerId = await scheduleTimeoutTimer(context, nodeData, agentState);
    if (timerId && !agentState.hasTimer()) {
      agentState.setTimerId(timerId);
    }

    // Build conversation history from session for context continuity
    const conversationHistory = services.conversationHistory.buildFromEvents(context.session.history);

    // =======================================================================
    // MODE: wait_for_input
    // Wait for user message before any execution
    // =======================================================================
    if (executionMode === "wait_for_input") {
      if (!services.conversationHistory.hasRecentUserMessage(conversationHistory)) {
        log.debug({ nodeId: node.id }, "agent:waitForInput:waiting");
        return { action: "wait" };
      }
      // User has provided input, proceed to workflow execution
    }

    // =======================================================================
    // MODE: welcome_first
    // Send welcome message, wait for user input, then execute workflow
    // =======================================================================
    if (executionMode === "welcome_first") {
      // Step 1: Send welcome message if not already sent
      if (!agentState.isInitialGreetingSent()) {
        if (nodeData.welcome?.message) {
          const welcomeMessage = await processWelcomeMessage(
            nodeData.welcome.message,
            context
          );
          await services.messenger.sendMessage(
            welcomeMessage,
            undefined,
            undefined,
            undefined,
            nodeData.voiceMode ? { voice: { mode: nodeData.voiceMode, profile: nodeData.voiceProfile, provider: nodeData.voiceProvider, elevenLabsModel: nodeData.elevenLabsModel } } : undefined
          );
          log.info({ nodeId: node.id }, "agent:welcomeSent");
        }

        // Mark as sent (even if no message configured - prevents re-entering this block)
        agentState.markInitialGreetingSent();

        // Wait for user input
        log.debug({ nodeId: node.id }, "agent:welcomeFirst:waitingForUser");
        return { action: "wait" };
      }

      // Step 2: Check for user input
      if (!services.conversationHistory.hasRecentUserMessage(conversationHistory)) {
        log.debug({ nodeId: node.id }, "agent:welcomeFirst:stillWaiting");
        return { action: "wait" };
      }
      // User has provided input, proceed to workflow execution
    }

    // =======================================================================
    // MODE: immediate (or after welcome/wait conditions met)
    // Execute workflow immediately
    // =======================================================================

    log.info({ nodeId: node.id, workflowKey: nodeData.workflowKey }, "agent:workflow:loading");

    const workflowService = services.agentWorkflow;
    if (!workflowService) {
      throw new EngineError("Agent workflow service not configured", undefined, node.id);
    }

    await workflowService.initialize?.();

    // Load workflow from service
    const workflow = await workflowService.loadWorkflow({
      organizationId: context.organizationId || "",
      workflowKey: nodeData.workflowKey,
    });
    if (!workflow) {
      log.error({ nodeId: node.id, workflowKey: nodeData.workflowKey }, "agent:workflow:notFound");
      services.eventLogger.logEvent({
        type: "engine.error",
        nodeId: node.id,
        payload: {
          code: "workflow_not_found",
          message: "Agent configuration not found. Please check the journey setup.",
        },
      });
      throw new NotFoundError("Workflow", nodeData.workflowKey);
    }

    if (workflow.status !== "active") {
      log.error({ nodeId: node.id, workflowKey: nodeData.workflowKey, status: workflow.status }, "agent:workflow:notActive");
      services.eventLogger.logEvent({
        type: "engine.error",
        nodeId: node.id,
        payload: {
          code: "workflow_not_active",
          message: "Agent is not active. Please activate it in the workflow editor.",
        },
      });
      throw new BadRequestError(`Workflow "${nodeData.workflowKey}" is not active`, {
        status: workflow.status,
        workflowKey: nodeData.workflowKey,
      });
    }

    log.debug(
      { nodeId: node.id, workflowKey: nodeData.workflowKey, historyLength: conversationHistory.length },
      "agent:workflow:executing"
    );

    // Delegate to workflow execution
    return executeWorkflowWithInput(workflowService, workflow, context, nodeData, conversationHistory, agentState);
  }

  /**
   * Handle incoming events during agent execution
   *
   * Processes:
   * - User messages: persist to conversation store, trigger re-execution
   * - Timeout events: send timeout message (if configured), then fall through for edge routing
   *
   * @returns null if event not handled (let normal routing proceed)
   * @returns NodeEventResult with instructions for re-execution
   */
  async handleEvent(event: JourneyEvent, context: ExecutionContext): Promise<NodeEventResult | null> {
    const { session, node, services, log } = context;
    const nodeData = assertNodeData<AgentNodeData>(node, "agent");

    // Handle timeout events - send message if configured, then fall through for edge routing
    if (event.type === "timeout") {
      log.info({ nodeId: node.id }, "agent:timeout:triggered");

      // Send timeout message if configured
      if (nodeData.timeout?.timeoutMessage) {
        try {
          const evalContext = await getOrBuildEvaluationContext(context);
          const resolvedMessage = services.template.substitute(nodeData.timeout.timeoutMessage, evalContext);
          await services.messenger.sendMessage(resolvedMessage);
          log.info({ nodeId: node.id }, "agent:timeout:messageSent");
        } catch (error) {
          log.error(
            { err: serializeError(error), nodeId: node.id },
            "agent:timeout:messageFailed"
          );
        }
      }

      // Return null to let normal routing handle the timer edge transition
      return null;
    }

    // Handle button_click for AI quick-reply buttons
    // AI reply buttons have "ai-reply-" prefix, re-execute agent to process user choice
    if (event.type === "button_click") {
      const buttonId = event.payload.buttonId;

      // Only handle our quick-reply buttons, let other buttons route normally
      if (!buttonId || !buttonId.startsWith("ai-reply-")) {
        return null;
      }

      log.info(
        { nodeId: node.id, buttonId },
        "agent:quickReplyButton:clicked"
      );

      // Re-execute agent - button text is already in conversation history
      return {
        handled: true,
        action: "continue",
        reExecute: true,
        timerAction: "none",
      };
    }

    // Only handle text messages - other events fall through to normal routing
    if (event.type !== "message" || !event.payload.text) {
      return null;
    }

    const text = event.payload.text;

    // Re-execute agent node to process the message
    return {
      handled: true,
      action: "continue",
      reExecute: true,
      timerAction: "none", // Agent workflow handles its own timeouts
    };
  }

  async onActivate(context: ActivationContext): Promise<void> {
    const { node, log } = context;
    const nodeData = assertNodeData<AgentNodeData>(node, "agent");

    log.debug(
      { nodeId: node.id, workflowKey: nodeData.workflowKey },
      "agent:activated"
    );
  }

  async onDeactivate(context: ActivationContext): Promise<void> {
    const { node, log } = context;

    log.debug({ nodeId: node.id }, "agent:deactivated");
  }
}

export const agentHandler = new AgentNodeHandler();
