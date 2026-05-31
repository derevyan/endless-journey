/**
 * Workflow Builder
 *
 * Builds workflow execution details from node outputs and LLM usage events.
 * Aggregates agent node executions with full LLM call details.
 *
 * @module @journey/ai-report/builders/workflow-builder
 */

import type {
  WorkflowExecutionDetail,
  WorkflowLLMCall,
  WorkflowToolCall,
  ReportOptions,
} from "../schemas";
import type { LLMUsageRecord, AgentNodeOutputRecord } from "./conversation-builder";
import {
  applyLLMTruncationRules,
  groupLLMEventsByModule,
  getLLMEventsForNode,
  sortLLMEventsByTimestamp,
} from "./shared";

/**
 * Build workflow executions from agent node outputs and LLM events.
 *
 * Combines data from:
 * 1. node_outputs - Agent response history and metrics
 * 2. llm_usage_events - Full LLM call details (prompts, messages, params)
 *
 * @param nodeOutputs - Node outputs from session
 * @param llmUsageEvents - LLM usage events for the session
 * @param options - Report options (for truncation settings)
 */
export function buildWorkflowExecutions(
  nodeOutputs: AgentNodeOutputRecord[],
  llmUsageEvents: LLMUsageRecord[],
  options: ReportOptions = {}
): WorkflowExecutionDetail[] {
  const executions: WorkflowExecutionDetail[] = [];

  // Filter to only agent node outputs
  const agentOutputs = nodeOutputs.filter((o) => o.nodeType === "agent");

  // Group LLM events by module (node label/id)
  const llmEventsByModule = groupLLMEventsByModule(llmUsageEvents);

  for (const output of agentOutputs) {
    const allResponses = output.data.allResponses || [];
    const metrics = output.data.conversationMetrics;

    // Get LLM events for this node
    const llmEvents = getLLMEventsForNode(llmEventsByModule, output.nodeLabel, output.nodeId);

    // Sort by timestamp
    sortLLMEventsByTimestamp(llmEvents);

    // Build LLM calls with full details
    const llmCalls = buildWorkflowLLMCalls(llmEvents, options);

    // Extract tool calls from responses
    const toolCalls = extractToolCalls(allResponses);

    // Determine status
    const lastResponse = allResponses[allResponses.length - 1];
    let status: WorkflowExecutionDetail["status"] = "running";
    if (lastResponse?.blocked) {
      status = "paused"; // Blocked = paused
    } else if (lastResponse?.success === false) {
      status = "error";
    } else if (metrics) {
      status = "completed";
    }

    // Calculate total duration
    const firstTimestamp = allResponses[0]?.executedAt || output.executedAt;
    const lastTimestamp = allResponses[allResponses.length - 1]?.executedAt || output.executedAt;
    const totalDurationMs = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();

    executions.push({
      workflowRunId: `${output.nodeId}-${firstTimestamp}`,
      nodeId: output.nodeId,
      startedAt: firstTimestamp,
      completedAt: status === "completed" ? lastTimestamp : undefined,
      status,
      steps: [], // Steps are internal workflow nodes - not tracked in current schema
      llmCalls,
      toolCalls,
      finalResponse: lastResponse?.response,
      outputVariables: undefined, // Could extract from context changes if needed
      totalDurationMs,
      totalTokens: metrics?.totalTokens || llmCalls.reduce((sum, c) => sum + c.totalTokens, 0),
      totalCostUSD: metrics?.totalCostUSD || llmCalls.reduce((sum, c) => sum + (c.costUSD || 0), 0),
    });
  }

  return executions;
}

/**
 * Build LLM call records from usage events.
 */
function buildWorkflowLLMCalls(
  events: LLMUsageRecord[],
  options: ReportOptions
): WorkflowLLMCall[] {
  return events.map((event) => {
    // Use shared truncation helper
    const { systemPrompt, systemPromptTruncated, inputMessages } = applyLLMTruncationRules(event, options);

    return {
      config: {
        model: event.model,
        provider: event.provider,
        // Temperature, maxTokens, etc. not stored in llm_usage_events currently
      },
      systemPrompt,
      systemPromptTruncated,
      inputMessages: inputMessages?.map((m) => ({
        role: m.role,
        content: m.content,
        toolCallId: m.toolCallId,
      })),
      response: event.outputContent || undefined,
      outputToolCalls: event.outputToolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
      })),
      finishReason: event.finishReason || undefined,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      costUSD: parseFloat(event.costUSD),
      durationMs: event.durationMs || 0,
      errorMessage: event.errorMessage || undefined,
    };
  });
}

/**
 * Extract tool calls from agent responses.
 */
function extractToolCalls(
  responses: NonNullable<AgentNodeOutputRecord["data"]["allResponses"]>
): WorkflowToolCall[] {
  const toolCalls: WorkflowToolCall[] = [];

  for (const response of responses) {
    if (response.toolCalls && Array.isArray(response.toolCalls)) {
      for (const tc of response.toolCalls) {
        const toolCall = tc as {
          name?: string;
          args?: unknown;
          result?: unknown;
          durationMs?: number;
          success?: boolean;
          error?: string;
        };
        toolCalls.push({
          toolName: toolCall.name || "unknown",
          input: toolCall.args,
          output: toolCall.result,
          durationMs: toolCall.durationMs || 0,
          success: toolCall.success !== false,
          error: toolCall.error,
        });
      }
    }
  }

  return toolCalls;
}

/**
 * Build workflow executions from LLM usage events only (without node outputs).
 * Useful when node outputs are not available but we have LLM events.
 */
export function buildWorkflowExecutionsFromLLMEvents(
  llmUsageEvents: LLMUsageRecord[],
  options: ReportOptions = {}
): WorkflowExecutionDetail[] {
  // Group by module
  const eventsByModule = groupLLMEventsByModule(llmUsageEvents);

  const executions: WorkflowExecutionDetail[] = [];

  for (const [module, events] of eventsByModule) {
    // Sort by timestamp
    sortLLMEventsByTimestamp(events);

    const llmCalls = buildWorkflowLLMCalls(events, options);
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    const totalTokens = events.reduce((sum, e) => sum + e.totalTokens, 0);
    const totalCost = events.reduce((sum, e) => sum + parseFloat(e.costUSD), 0);

    executions.push({
      workflowRunId: `${module}-${firstEvent?.createdAt.toISOString() || new Date().toISOString()}`,
      nodeId: module,
      startedAt: firstEvent?.createdAt.toISOString() || new Date().toISOString(),
      completedAt: lastEvent?.createdAt.toISOString(),
      status: "completed",
      steps: [],
      llmCalls,
      toolCalls: [], // Can't extract without node outputs
      finalResponse: lastEvent?.outputContent || undefined,
      totalDurationMs: events.reduce((sum, e) => sum + (e.durationMs || 0), 0),
      totalTokens,
      totalCostUSD: totalCost,
    });
  }

  return executions;
}
