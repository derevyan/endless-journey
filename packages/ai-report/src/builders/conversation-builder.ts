/**
 * Conversation Builder
 *
 * Builds AI node conversation history with full LLM call details.
 * Queries llm_usage_events table for complete LLM interaction data.
 *
 * @module @journey/ai-report/builders/conversation-builder
 */

import type {
  AINodeConversation,
  AIConversationTurn,
  LLMCallDetail,
  LLMConfigSnapshot,
  ConversationMetrics,
  ConversationExitReason,
  ReportOptions,
  ConversationToolCall,
} from "../schemas";
import {
  applyLLMTruncationRules,
  groupLLMEventsByModule,
  getLLMEventsForNode,
  sortLLMEventsByTimestamp,
  findLLMEventByTimestamp,
} from "./shared";

/**
 * LLM usage event record from database.
 */
export interface LLMUsageRecord {
  id: string;
  journeySessionId: string | null;
  service: string;
  module: string | null;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: string; // Numeric stored as string
  durationMs: number | null;
  systemPrompt: string | null;
  inputMessages: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolCallId?: string;
  }> | null;
  outputContent: string | null;
  outputToolCalls: Array<{
    id: string;
    name: string;
    args: unknown;
  }> | null;
  finishReason: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

/**
 * Node output data for agent nodes.
 */
export interface AgentNodeOutputRecord {
  nodeId: string;
  nodeLabel?: string;
  nodeType: string;
  data: {
    allResponses?: Array<{
      response: string;
      success: boolean;
      blocked?: boolean;
      blockedMessage?: string;
      toolCalls?: unknown[];
      durationMs?: number;
      executedAt: string;
      userMessage?: string;
      tokensUsed?: number;
      costUSD?: number;
    }>;
    conversationMetrics?: {
      turnCount: number;
      messageCount: number;
      totalTokens: number;
      totalCostUSD: number;
      conversationStartedAt: string;
      lastTurnAt: string;
    };
    lastResponse?: string;
    lastSuccess?: boolean;
    lastBlocked?: boolean;
  };
  executedAt: string;
}

/**
 * Build AI node conversations with full LLM call details.
 *
 * Combines data from two sources:
 * 1. node_outputs - Agent response history (allResponses, conversationMetrics)
 * 2. llm_usage_events - Full LLM call details (prompts, messages, params)
 *
 * @param nodeOutputs - Agent node outputs from session
 * @param llmUsageEvents - LLM usage events for the session
 * @param options - Report options (for truncation settings)
 */
export function buildAIConversations(
  nodeOutputs: AgentNodeOutputRecord[],
  llmUsageEvents: LLMUsageRecord[],
  options: ReportOptions = {}
): AINodeConversation[] {
  const conversations: AINodeConversation[] = [];

  // Filter to only agent node outputs
  const agentOutputs = nodeOutputs.filter((o) => o.nodeType === "agent");

  // Group LLM events by module (which is the node name for agent workflows)
  const llmEventsByModule = groupLLMEventsByModule(llmUsageEvents);

  for (const output of agentOutputs) {
    const allResponses = output.data.allResponses || [];
    const metrics = output.data.conversationMetrics;

    // Get LLM events for this node (match by module name or node label)
    const llmEvents = getLLMEventsForNode(llmEventsByModule, output.nodeLabel, output.nodeId);

    // Sort LLM events by timestamp
    sortLLMEventsByTimestamp(llmEvents);

    // Build turns from allResponses, enriched with LLM event data
    const turns: AIConversationTurn[] = allResponses.map((response, index) => {
      // Try to find matching LLM event for this turn - use timestamp-based matching for accuracy
      const llmEvent = findLLMEventByTimestamp(llmEvents, response.executedAt) || llmEvents[index];

      // Build LLM call detail if we have the event
      const llmCall = llmEvent ? buildLLMCallDetail(llmEvent, options) : undefined;

      return {
        turnNumber: index + 1,
        timestamp: response.executedAt,
        userMessage: response.userMessage,
        userInputType: index === 0 ? "initial_prompt" : "text",
        assistantResponse: response.response,
        responseBlocked: response.blocked || false,
        blockedReason: response.blockedMessage,
        toolCalls: (response.toolCalls || []).map((tc: unknown) => {
          const toolCall = tc as { id?: string; name?: string; args?: unknown; result?: unknown };
          return {
            id: toolCall.id || "",
            name: toolCall.name || "",
            args: toolCall.args,
            result: toolCall.result,
            success: true,
          };
        }),
        // Include full LLM call details
        llmCall,
        // Legacy fields for backward compat
        tokensUsed: response.tokensUsed || llmEvent?.totalTokens,
        costUSD: response.costUSD || (llmEvent ? parseFloat(llmEvent.costUSD) : undefined),
        durationMs: response.durationMs || llmEvent?.durationMs || undefined,
      };
    });

    // Determine conversation status
    const lastResponse = allResponses[allResponses.length - 1];
    let status: "active" | "completed" | "blocked" | "error" = "active";
    if (lastResponse?.blocked) {
      status = "blocked";
    } else if (lastResponse?.success === false) {
      status = "error";
    } else if (metrics) {
      // If we have metrics, conversation is likely completed
      status = "completed";
    }

    // Determine exit reason
    let exitReason: ConversationExitReason | undefined;
    if (status === "completed") {
      exitReason = "workflow_completed";
    } else if (status === "blocked") {
      exitReason = "blocked";
    } else if (status === "error") {
      exitReason = "error";
    } else {
      exitReason = "still_active";
    }

    // Build metrics
    const conversationMetrics: ConversationMetrics = {
      turnCount: turns.length,
      totalMessages: turns.length * 2, // user + assistant per turn
      totalTokens: metrics?.totalTokens || turns.reduce((sum, t) => sum + (t.tokensUsed || 0), 0),
      totalCostUSD: metrics?.totalCostUSD || turns.reduce((sum, t) => sum + (t.costUSD || 0), 0),
      averageTurnDurationMs:
        turns.length > 0
          ? turns.reduce((sum, t) => sum + (t.durationMs || 0), 0) / turns.length
          : undefined,
    };

    conversations.push({
      nodeId: output.nodeId,
      nodeLabel: output.nodeLabel,
      workflowKey: "unknown", // TODO: Extract from node config if needed
      startedAt: metrics?.conversationStartedAt || allResponses[0]?.executedAt || output.executedAt,
      lastTurnAt: metrics?.lastTurnAt || allResponses[allResponses.length - 1]?.executedAt,
      status,
      turns,
      metrics: conversationMetrics,
      exitReason,
    });
  }

  return conversations;
}

/**
 * Build LLM call detail from usage event record.
 */
function buildLLMCallDetail(event: LLMUsageRecord, options: ReportOptions): LLMCallDetail {
  // Use shared truncation helper
  const { systemPrompt, systemPromptTruncated, inputMessages } = applyLLMTruncationRules(event, options);

  // Build config snapshot
  const config: LLMConfigSnapshot = {
    model: event.model,
    provider: event.provider,
    // Note: Temperature, maxTokens, etc. are not stored in llm_usage_events
    // They would need to be added to the schema if we want to capture them
  };

  return {
    systemPrompt,
    systemPromptTruncated,
    inputMessages: inputMessages?.map((m) => ({
      role: m.role,
      content: m.content,
      toolCallId: m.toolCallId,
    })),
    config,
    outputContent: event.outputContent || "",
    outputToolCalls: event.outputToolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      args: tc.args,
      success: true, // LLM tool calls are successful if they were recorded
    })),
    finishReason: event.finishReason || undefined,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    totalTokens: event.totalTokens,
    costUSD: parseFloat(event.costUSD),
    durationMs: event.durationMs || 0,
    errorMessage: event.errorMessage || undefined,
  };
}

/**
 * Build AI conversations from LLM usage events only (without node outputs).
 * Useful when node outputs are not available but we have LLM events.
 */
export function buildAIConversationsFromLLMEvents(
  llmUsageEvents: LLMUsageRecord[],
  options: ReportOptions = {}
): AINodeConversation[] {
  // Group by module (agent node name)
  const eventsByModule = groupLLMEventsByModule(llmUsageEvents);

  const conversations: AINodeConversation[] = [];

  for (const [module, events] of eventsByModule) {
    // Sort by timestamp
    sortLLMEventsByTimestamp(events);

    const turns: AIConversationTurn[] = events.map((event, index) => {
      const llmCall = buildLLMCallDetail(event, options);

      // Extract user message from input messages if available
      const lastUserMessage = event.inputMessages
        ?.filter((m) => m.role === "user")
        .pop()?.content;

      const toolCalls: ConversationToolCall[] =
        event.outputToolCalls?.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
          success: true,
        })) || [];

      return {
        turnNumber: index + 1,
        timestamp: event.createdAt.toISOString(),
        userMessage: lastUserMessage,
        userInputType: index === 0 ? "initial_prompt" : "text",
        assistantResponse: event.outputContent || "",
        responseBlocked: false,
        toolCalls,
        llmCall,
        tokensUsed: event.totalTokens,
        costUSD: parseFloat(event.costUSD),
        durationMs: event.durationMs || undefined,
      };
    });

    const totalTokens = events.reduce((sum, e) => sum + e.totalTokens, 0);
    const totalCost = events.reduce((sum, e) => sum + parseFloat(e.costUSD), 0);

    conversations.push({
      nodeId: module,
      nodeLabel: module,
      workflowKey: "unknown",
      startedAt: events[0]?.createdAt.toISOString() || new Date().toISOString(),
      lastTurnAt: events[events.length - 1]?.createdAt.toISOString(),
      status: "completed",
      turns,
      metrics: {
        turnCount: turns.length,
        totalMessages: turns.length * 2,
        totalTokens,
        totalCostUSD: totalCost,
        averageTurnDurationMs:
          turns.length > 0
            ? events.reduce((sum, e) => sum + (e.durationMs || 0), 0) / turns.length
            : undefined,
      },
      exitReason: "workflow_completed",
    });
  }

  return conversations;
}
