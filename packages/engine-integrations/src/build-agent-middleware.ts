/**
 * Build Agent Middleware from Configuration
 *
 * Converts the AgentMiddlewareConfig schema into actual middleware instances
 * from @journey/llm. This utility is used to construct the middleware pipeline
 * for agent execution based on node configuration.
 *
 * @see packages/llm/src/middleware for middleware implementations
 */

import {
  createModelCallLimitMiddleware,
  createModelFallbackMiddleware,
  createPIIMiddleware,
  createSummarizationMiddleware,
  createTodoListMiddleware,
  createHumanInTheLoopMiddleware,
  createLLMGuardMiddleware,
  type AgentMiddleware,
} from "@journey/llm";
import { llmConfig, type AgentMiddlewareConfig, type ConversationHistoryStrategy, EventTypes } from "@journey/schemas";
import { createLogger } from "@journey/logger";
import type { EventLogger } from "@journey/engine";

const log = createLogger("engine:middleware-builder");

/**
 * Build middleware instances from AgentMiddlewareConfig
 *
 * Iterates through the middleware configuration and creates the appropriate
 * middleware instances from @journey/llm's built-in middleware.
 *
 * @param config - The middleware configuration from AgentNodeData
 * @param options - Additional options for middleware building
 * @returns Array of middleware instances ready for the agent pipeline
 *
 * @example
 * ```typescript
 * const middleware = buildAgentMiddleware(nodeData.middleware, {
 *   conversationHistory: nodeData.conversationHistory,
 * });
 *
 * const result = await executeAgentWithMiddleware(
 *   systemPrompt,
 *   messages,
 *   {
 *     model: "gpt-4o",
 *     tools: [...],
 *     middleware: { middleware },
 *   }
 * );
 * ```
 */
export function buildAgentMiddleware(
  config: AgentMiddlewareConfig | undefined,
  options: {
    /** Conversation history config for summarization middleware integration */
    conversationHistory?: {
      enabled?: boolean;
      strategy?: ConversationHistoryStrategy;
      summarization?: {
        model?: string;
        trigger?: { messages?: number; tokens?: number };
        keep?: { messages?: number };
      };
    };
    /** Node context for HITL middleware */
    nodeId?: string;
    sessionId?: string;
    /** Event logger for emitting system.hitl events */
    eventLogger?: EventLogger;
  } = {}
): AgentMiddleware[] {
  const middleware: AgentMiddleware[] = [];

  if (!config) {
    return middleware;
  }

  // 0. LLM Guard (priority 3 - runs FIRST to block unsafe content)
  // Uses llmConfig.guards.workers as default if no custom workers specified
  if (config.llmGuard?.enabled) {
    middleware.push(
      createLLMGuardMiddleware({
        workers: config.llmGuard.workers,
        workerTimeoutMs: config.llmGuard.workerTimeoutMs,
        blockedMessage: config.llmGuard.blockedMessage,
        spamBlockedMessage: config.llmGuard.spamBlockedMessage,
      })
    );
    log.debug(
      {
        workerCount: config.llmGuard.workers?.length ?? llmConfig.guards.workers.length,
        workers: config.llmGuard.workers?.map((w) => w.id) ?? llmConfig.guards.workers.map((w) => w.id),
      },
      "middleware:builder:llmGuard:added"
    );
  }

  // 1. Model Fallback (priority 5 - runs first as outermost wrapper)
  if (config.modelFallback?.enabled && config.modelFallback.fallbackModels.length > 0) {
    middleware.push(createModelFallbackMiddleware(...config.modelFallback.fallbackModels));
    log.debug(
      { fallbackModels: config.modelFallback.fallbackModels },
      "middleware:builder:modelFallback:added"
    );
  }

  // 2. PII Detection (priority 10 - filter input early)
  if (config.piiDetection?.enabled) {
    const { types, strategy, scanInput, scanOutput } = config.piiDetection;

    // Create a middleware instance for each PII type
    for (const piiType of types) {
      middleware.push(
        createPIIMiddleware(piiType, {
          strategy,
          applyToInput: scanInput,
          applyToOutput: scanOutput,
        })
      );
    }
    log.debug(
      { types, strategy, scanInput, scanOutput },
      "middleware:builder:piiDetection:added"
    );
  }

  // 3. Summarization (priority 15 - from conversation history config)
  // Note: This integrates with the existing summarization config in conversationHistory
  const historyConfig = options.conversationHistory;
  if (
    historyConfig?.strategy === "summarize" &&
    historyConfig.summarization
  ) {
    middleware.push(
      createSummarizationMiddleware({
        model: historyConfig.summarization.model || llmConfig.summarization.model.id,
        trigger: {
          messages: historyConfig.summarization.trigger?.messages ?? llmConfig.summarization.triggerMessages,
          tokens: historyConfig.summarization.trigger?.tokens,
        },
        keep: {
          messages: historyConfig.summarization.keep?.messages ?? llmConfig.summarization.keepMessages,
        },
      })
    );
    log.debug(
      { config: historyConfig.summarization },
      "middleware:builder:summarization:added"
    );
  }

  // 4. Model Call Limit (priority 20 - check limits)
  if (config.modelCallLimit?.enabled) {
    middleware.push(
      createModelCallLimitMiddleware({
        runLimit: config.modelCallLimit.runLimit,
        threadLimit: config.modelCallLimit.threadLimit,
        exitBehavior: config.modelCallLimit.exitBehavior,
      })
    );
    log.debug(
      {
        runLimit: config.modelCallLimit.runLimit,
        threadLimit: config.modelCallLimit.threadLimit,
        exitBehavior: config.modelCallLimit.exitBehavior,
      },
      "middleware:builder:modelCallLimit:added"
    );
  }

  // 5. Todo List (priority 25 - tool injection)
  if (config.todoList?.enabled) {
    middleware.push(
      createTodoListMiddleware({
        systemPrompt: config.todoList.systemPrompt,
        maxTodos: config.todoList.maxTodos,
      })
    );
    log.debug(
      { maxTodos: config.todoList.maxTodos },
      "middleware:builder:todoList:added"
    );
  }

  // 6. Human-in-the-Loop (priority 30 - tool wrapping)
  if (config.humanInTheLoop?.enabled && config.humanInTheLoop.requireApprovalFor.length > 0) {
    // Build interruptOn config from the list of tool names
    const interruptOn: Record<string, { timeout?: number; timeoutBehavior?: "approve" | "reject" | "skip" }> = {};
    for (const toolName of config.humanInTheLoop.requireApprovalFor) {
      interruptOn[toolName] = {
        timeout: config.humanInTheLoop.timeout,
        timeoutBehavior: config.humanInTheLoop.timeoutBehavior,
      };
    }

    middleware.push(
      createHumanInTheLoopMiddleware({
        interruptOn,
        defaultTimeout: config.humanInTheLoop.timeout,
        // Note: requestDecision callback needs to be provided by the engine
        // This is a placeholder - real implementation needs UI integration
        eventHandler: (event) => {
          log.info(
            {
              type: event.type,
              requestId: event.requestId,
              toolName: event.toolName,
              decision: event.decision,
              nodeId: options.nodeId,
              sessionId: options.sessionId,
            },
            "middleware:hitl:event"
          );

          // Emit llm.hitl event for "decision" events (approve/reject/edit/skip)
          if (event.type === "decision" && event.decision && options.eventLogger) {
            options.eventLogger.logEvent({
              type: EventTypes.LLM_HITL,
              nodeId: options.nodeId || "",
              payload: {
                requestId: event.requestId,
                toolName: event.toolName,
                decision: event.decision,
                message: event.message,
                wasEdited: event.decision === "edit",
              },
            });
          }
        },
      })
    );
    log.debug(
      { toolNames: config.humanInTheLoop.requireApprovalFor },
      "middleware:builder:humanInTheLoop:added"
    );
  }

  log.info(
    {
      count: middleware.length,
      types: middleware.map((m) => m.name),
    },
    "middleware:builder:complete"
  );

  return middleware;
}
