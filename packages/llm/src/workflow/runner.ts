/**
 * Workflow Graph Runner - Main orchestration engine
 *
 * This module executes workflow graphs by:
 * 1. Validating workflow structure
 * 2. Building adjacency map for traversal
 * 3. Executing nodes from start to end
 * 4. Following edges based on output handles
 * 5. Collecting execution trace
 */

import type { AgentWorkflow, WorkflowNode, AggregatedUsage, TokenUsage, ConversationMessage } from "@journey/schemas";
import { validateWorkflow, WorkflowEventTypes, emptyAggregatedUsage, aggregateUsage } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext, WorkflowResult, NodeTrace } from "./types";
import { buildAdjacencyMap, findNode, findNodeByType } from "./graph";
import { getNodeExecutor } from "./executor-registry";

/**
 * Helper to safely emit workflow events.
 * No-op if emit is not provided in context.
 */
function emitEvent(
  context: WorkflowContext,
  type: (typeof WorkflowEventTypes)[keyof typeof WorkflowEventTypes],
  payload: Record<string, unknown>
): void {
  if (context.emit) {
    context.emit({ type, payload });
  }
}

/**
 * Result of executing the workflow loop.
 */
interface LoopResult {
  /** Final response from agents */
  finalResponse?: string;
  /** Tool calls from final agent */
  finalToolCalls?: NodeOutput["toolCalls"];
  /** Deferred tool calls from final agent (for post-message execution) */
  finalDeferredToolCalls?: NodeOutput["deferredToolCalls"];
  /** Explicit exit signal from agent (exit_to_next_node was called) */
  exitRequested?: boolean;
  /** The end node (when loop completes normally) */
  endNode?: WorkflowNode;
  /** Early exit result (pause, block, or error) */
  earlyExit?: WorkflowResult;
  /** Aggregated token usage from all nodes */
  aggregatedUsage: AggregatedUsage;
}

/**
 * Shared execution loop for workflow traversal.
 *
 * Executes nodes until reaching 'end' node or early exit condition (pause/block).
 * This is extracted from runWorkflow and resumeWorkflow to eliminate duplication.
 */
async function executeWorkflowLoop(params: {
  workflow: { configuration: { nodes: WorkflowNode[] }; key: string };
  graph: ReturnType<typeof buildAdjacencyMap>;
  startNode: WorkflowNode;
  nodeInput: NodeInput;
  trace: NodeTrace[];
  startTime: number;
  workflowRunId: string;
  context: WorkflowContext;
}): Promise<LoopResult> {
  const { workflow, graph, startNode, nodeInput, trace, startTime, workflowRunId, context } = params;

  let currentNode: WorkflowNode = startNode;
  let finalResponse: string | undefined;
  let finalToolCalls: NodeOutput["toolCalls"];
  let finalDeferredToolCalls: NodeOutput["deferredToolCalls"];
  let exitRequested = false;
  let aggregatedUsage = emptyAggregatedUsage();

  while (currentNode.type !== "end") {
    // Check for timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > context.settings.maxExecutionTimeMs) {
      throw new Error(
        `Workflow execution timeout: ${elapsed}ms > ${context.settings.maxExecutionTimeMs}ms`
      );
    }

    // Check for abort
    if (context.abortSignal?.aborted) {
      throw new Error("Workflow execution aborted");
    }

    // Get executor
    const executor = getNodeExecutor(currentNode.type);

    // Set currentNodeId in context for executors
    context.currentNodeId = currentNode.id;

    // Execute node
    const nodeStartTime = Date.now();
    context.log.debug(
      { nodeId: currentNode.id, nodeType: currentNode.type },
      "workflow:node:executing"
    );

    // Emit workflow.step.started event
    emitEvent(context, WorkflowEventTypes.WORKFLOW_STEP_STARTED, {
      workflowId: workflowRunId,
      workflowKey: workflow.key,
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeName: currentNode.data?.name,
      input: { message: nodeInput.message },
    });

    let output: NodeOutput;
    try {
      output = await executor.execute(nodeInput, currentNode.data, context);
    } catch (error) {
      const nodeDurationMs = Date.now() - nodeStartTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Record error in trace
      trace.push({
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        status: "error",
        durationMs: nodeDurationMs,
        error: errorMessage,
      });

      // Emit workflow.step.error event
      emitEvent(context, WorkflowEventTypes.WORKFLOW_STEP_ERROR, {
        workflowId: workflowRunId,
        workflowKey: workflow.key,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        errorMessage,
        durationMs: nodeDurationMs,
      });

      // Emit workflow.error event
      emitEvent(context, WorkflowEventTypes.WORKFLOW_ERROR, {
        workflowId: workflowRunId,
        workflowKey: workflow.key,
        errorMessage,
        failedNodeId: currentNode.id,
        failedNodeType: currentNode.type,
        durationMs: Date.now() - startTime,
      });

      throw error;
    }

    // Determine trace status
    const traceStatus = output.paused ? "paused" : output.blocked ? "blocked" : "completed";

    // Record in trace
    trace.push({
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      status: traceStatus,
      outHandle: output.outHandle,
      durationMs: output.executionTimeMs,
      metadata: output.metadata,
    });

    // Aggregate token usage from node metadata (if present)
    if (output.metadata?.totalTokens !== undefined) {
      const nodeUsage: TokenUsage = {
        promptTokens: (output.metadata.promptTokens as number) ?? 0,
        completionTokens: (output.metadata.completionTokens as number) ?? 0,
        totalTokens: (output.metadata.totalTokens as number) ?? 0,
        costUSD: (output.metadata.costUSD as number) ?? 0,
      };
      aggregatedUsage = aggregateUsage(aggregatedUsage, nodeUsage);
    }

    // Handle paused state (user_approval node)
    if (output.paused && output.pauseState) {
      context.log.info(
        { nodeId: currentNode.id, reason: output.pauseReason },
        "workflow:node:paused"
      );

      // Emit workflow.paused event
      emitEvent(context, WorkflowEventTypes.WORKFLOW_PAUSED, {
        workflowId: workflowRunId,
        workflowKey: workflow.key,
        pausedAtNodeId: currentNode.id,
        pauseReason: output.pauseReason,
      });

      // Serialize state for persistence
      const serializedNodeInput = {
        message: nodeInput.message,
        conversationHistory: nodeInput.conversationHistory,
        variables: nodeInput.variables,
        previousNodeOutputs: Object.fromEntries(nodeInput.previousNodeOutputs),
      };

      return {
        earlyExit: {
          success: false,
          paused: true,
          pauseReason: output.pauseReason,
          trace,
          totalDurationMs: Date.now() - startTime,
          variables: nodeInput.variables,
          usage: aggregatedUsage.callCount > 0 ? aggregatedUsage : undefined,
          _pauseState: {
            currentNodeId: currentNode.id,
            nodeInput: serializedNodeInput,
            pauseData: output.pauseState,
          },
        },
        aggregatedUsage,
      };
    }

    // Handle blocking (guard node blocked)
    if (output.blocked) {
      context.log.info(
        { nodeId: currentNode.id, message: output.blockedMessage },
        "workflow:node:blocked"
      );

      // Emit workflow.guard.blocked event
      emitEvent(context, WorkflowEventTypes.WORKFLOW_GUARD_BLOCKED, {
        workflowId: workflowRunId,
        workflowKey: workflow.key,
        nodeId: currentNode.id,
        blockedBy: output.metadata?.blockedBy ?? "unknown",
        blockedMessage: output.blockedMessage,
        guardType: output.metadata?.isSpamBlock ? "spam" : "safety",
      });

      return {
        earlyExit: {
          success: false,
          blocked: true,
          blockedMessage: output.blockedMessage,
          trace,
          totalDurationMs: Date.now() - startTime,
          variables: nodeInput.variables,
          usage: aggregatedUsage.callCount > 0 ? aggregatedUsage : undefined,
        },
        aggregatedUsage,
      };
    }

    // Emit workflow.step.completed event
    emitEvent(context, WorkflowEventTypes.WORKFLOW_STEP_COMPLETED, {
      workflowId: workflowRunId,
      workflowKey: workflow.key,
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeName: currentNode.data?.name,
      durationMs: output.executionTimeMs,
      outHandle: output.outHandle,
      output: output.data,
    });

    // Capture agent outputs - toolCalls and exitRequested ALWAYS captured (not just when response is truthy)
    // This fixes exit detection when model returns only tool calls with empty content
    if (currentNode.type === "agent") {
      if (output.response) {
        finalResponse = output.response;
      }
      // Always capture toolCalls - needed for exit detection even with empty response
      if (output.toolCalls?.length) {
        finalToolCalls = output.toolCalls;
      }
      if (output.deferredToolCalls?.length) {
        finalDeferredToolCalls = output.deferredToolCalls;
      }
      // Capture explicit exit signal
      if (output.exitRequested) {
        exitRequested = true;
      }
    }

    // Merge output data into variables
    if (output.data) {
      nodeInput.variables = { ...nodeInput.variables, ...output.data };
    }

    // Store output for future reference
    nodeInput.previousNodeOutputs.set(currentNode.id, output);

    // Get next node via edge
    const outHandle = output.outHandle || "default";
    const nextEdge = graph.getOutgoingByHandle(currentNode.id, outHandle);

    if (!nextEdge) {
      throw new Error(`No edge from node ${currentNode.id} with handle '${outHandle}'`);
    }

    const nextNode = findNode(workflow.configuration.nodes, nextEdge.target);
    if (!nextNode) {
      throw new Error(`Node not found: ${nextEdge.target}`);
    }

    currentNode = nextNode;
  }

  return {
    finalResponse,
    finalToolCalls,
    finalDeferredToolCalls,
    exitRequested,
    endNode: currentNode,
    aggregatedUsage,
  };
}

/**
 * Options for running a workflow.
 */
export interface RunWorkflowOptions {
  /** Message to send to the workflow */
  message: string;
  /** Conversation history for multi-turn */
  conversationHistory?: ConversationMessage[];
  /** Optional node ID to start from (for testing specific parts of the workflow) */
  startNodeId?: string;
}

/**
 * Run a workflow graph.
 *
 * Execution flow:
 * 1. Validate workflow structure
 * 2. Build adjacency map
 * 3. Start from 'start' node (or custom startNodeId if provided)
 * 4. Execute each node, following edges
 * 5. Handle branching via outHandle
 * 6. Collect trace and final result
 */
export async function runWorkflow(
  workflow: AgentWorkflow,
  initialInput: RunWorkflowOptions,
  context: WorkflowContext
): Promise<WorkflowResult> {
  const startTime = Date.now();
  const trace: NodeTrace[] = [];

  // Validate workflow structure
  const validation = validateWorkflow(workflow.configuration.nodes, workflow.configuration.edges);
  if (!validation.valid) {
    throw new Error(`Invalid workflow: ${validation.errors.map((e) => e.message).join(", ")}`);
  }

  // Build graph
  const graph = buildAdjacencyMap(workflow.configuration.nodes, workflow.configuration.edges);

  // Find start node (custom startNodeId or default 'start' node)
  let startNode: WorkflowNode | undefined;
  if (initialInput.startNodeId) {
    startNode = findNode(workflow.configuration.nodes, initialInput.startNodeId);
    if (!startNode) {
      throw new Error(`Start node not found: ${initialInput.startNodeId}`);
    }
  } else {
    startNode = findNodeByType(workflow.configuration.nodes, "start");
    if (!startNode) {
      throw new Error("Workflow has no start node");
    }
  }

  // Initialize input with journey variables (for if_else conditions to access session context)
  const nodeInput: NodeInput = {
    message: initialInput.message,
    conversationHistory: initialInput.conversationHistory || [],
    variables: context.journey?.variables || {},
    previousNodeOutputs: new Map(),
  };

  // Initialize workflow-level variables from configuration defaults
  // This ensures variables defined in workflow.configuration.variables get their default values
  if (workflow.configuration.variables) {
    for (const varDef of workflow.configuration.variables) {
      if (varDef.defaultValue !== undefined && !(varDef.name in nodeInput.variables)) {
        (nodeInput.variables as Record<string, unknown>)[varDef.name] = varDef.defaultValue;
      }
    }
  }

  // DEBUG: Log what variables are available for workflow conditions
  context.log.info({
    hasJourney: !!context.journey,
    hasJourneyVariables: !!context.journey?.variables,
    variablesKeys: Object.keys(nodeInput.variables),
    hasUserResponse: !!(nodeInput.variables as any).userResponse,
    userResponseInputType: (nodeInput.variables as any)?.userResponse?.inputType,
    elevenLabsModel: (nodeInput.variables as any)?.elevenLabsModel
  }, "workflow:debug:nodeInputVariables");

  // Generate workflow run ID for this execution
  const workflowRunId = `wfr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Set workflowRunId in context for executors
  context.workflowRunId = workflowRunId;

  context.log.info(
    { workflowKey: workflow.key, nodeCount: workflow.configuration.nodes.length },
    "workflow:run:start"
  );

  // Emit workflow.started event
  emitEvent(context, WorkflowEventTypes.WORKFLOW_STARTED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    workflowName: workflow.name,
    startNodeId: startNode.id,
    triggerSource: context.journey ? "journey" : "api",
    journeyId: context.journey?.journeyId,
    sessionId: context.sessionId,
    input: { message: initialInput.message },
  });

  // Execute the workflow loop
  const loopResult = await executeWorkflowLoop({
    workflow,
    graph,
    startNode,
    nodeInput,
    trace,
    startTime,
    workflowRunId,
    context,
  });

  // Handle early exit (pause or block)
  if (loopResult.earlyExit) {
    return loopResult.earlyExit;
  }

  // Execute end node with events
  const endNode = loopResult.endNode!;

  // Emit step.started for End node
  emitEvent(context, WorkflowEventTypes.WORKFLOW_STEP_STARTED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    nodeId: endNode.id,
    nodeType: endNode.type,
    nodeName: endNode.data.name || "End",
  });

  const endStartTime = Date.now();
  const endExecutor = getNodeExecutor("end");
  const endOutput = await endExecutor.execute(nodeInput, endNode.data, context);
  const endDurationMs = Date.now() - endStartTime;

  // Emit step.completed for End node
  emitEvent(context, WorkflowEventTypes.WORKFLOW_STEP_COMPLETED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    nodeId: endNode.id,
    nodeType: endNode.type,
    nodeName: endNode.data.name || "End",
    durationMs: endDurationMs,
    outHandle: undefined,
    output: endOutput,
  });

  trace.push({
    nodeId: endNode.id,
    nodeType: endNode.type,
    status: "completed",
    durationMs: endDurationMs,
  });

  // Use end node response if available, otherwise last agent response
  const finalResponse = endOutput.response || loopResult.finalResponse;

  const totalDurationMs = Date.now() - startTime;

  context.log.info(
    {
      workflowKey: workflow.key,
      totalDurationMs,
      nodesExecuted: trace.length,
    },
    "workflow:run:complete"
  );

  // Emit workflow.completed event
  emitEvent(context, WorkflowEventTypes.WORKFLOW_COMPLETED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    durationMs: totalDurationMs,
    nodesExecuted: trace.length,
    output: nodeInput.variables,
  });

  return {
    success: true,
    response: finalResponse,
    toolCalls: loopResult.finalToolCalls,
    trace,
    totalDurationMs,
    variables: nodeInput.variables,
    usage: loopResult.aggregatedUsage.callCount > 0 ? loopResult.aggregatedUsage : undefined,
    deferredToolCalls: loopResult.finalDeferredToolCalls,
    exitRequested: loopResult.exitRequested,
  };
}

/**
 * Input for resuming a paused workflow.
 */
export interface ResumeWorkflowInput {
  /** The node where workflow was paused */
  nodeId: string;
  /** Serialized execution state from pause */
  executionState: {
    message: string;
    conversationHistory: ConversationMessage[];
    variables: Record<string, unknown>;
    previousNodeOutputs: Record<string, NodeOutput>;
  };
  /** Whether the approval was approved (true) or rejected (false) */
  approved: boolean;
  /** Timestamp when workflow was paused (for duration calculation) */
  pausedAtMs: number;
}

/**
 * Resume a paused workflow from user approval response.
 *
 * This function restores workflow state and continues execution
 * from the approval node, following the appropriate edge based
 * on the approval decision.
 */
export async function resumeWorkflow(
  workflow: AgentWorkflow,
  resumeInput: ResumeWorkflowInput,
  context: WorkflowContext
): Promise<WorkflowResult> {
  const startTime = Date.now();
  const trace: NodeTrace[] = [];

  // Validate workflow structure
  const validation = validateWorkflow(workflow.configuration.nodes, workflow.configuration.edges);
  if (!validation.valid) {
    throw new Error(`Invalid workflow: ${validation.errors.map((e) => e.message).join(", ")}`);
  }

  // Build graph
  const graph = buildAdjacencyMap(workflow.configuration.nodes, workflow.configuration.edges);

  // Find the paused node
  const pausedNode = findNode(workflow.configuration.nodes, resumeInput.nodeId);
  if (!pausedNode) {
    throw new Error(`Cannot resume: node ${resumeInput.nodeId} not found`);
  }

  // Restore state from serialized input
  const nodeInput: NodeInput = {
    message: resumeInput.executionState.message,
    conversationHistory: resumeInput.executionState.conversationHistory,
    variables: resumeInput.executionState.variables,
    previousNodeOutputs: new Map(
      Object.entries(resumeInput.executionState.previousNodeOutputs)
    ),
  };

  // Generate new workflow run ID for resumed execution
  const workflowRunId = `wfr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  context.workflowRunId = workflowRunId;

  const pauseDurationMs = Date.now() - resumeInput.pausedAtMs;

  context.log.info(
    {
      workflowKey: workflow.key,
      nodeId: resumeInput.nodeId,
      approved: resumeInput.approved,
      pauseDurationMs,
    },
    "workflow:resume:start"
  );

  // Emit workflow.resumed event
  emitEvent(context, WorkflowEventTypes.WORKFLOW_RESUMED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    resumedAtNodeId: resumeInput.nodeId,
    pauseDurationMs,
  });

  // Record the approval decision in trace
  trace.push({
    nodeId: pausedNode.id,
    nodeType: pausedNode.type,
    status: "completed",
    outHandle: resumeInput.approved ? "approved" : "rejected",
    durationMs: pauseDurationMs,
    metadata: { resumed: true, approved: resumeInput.approved },
  });

  // Get next node based on approval decision
  const outHandle = resumeInput.approved ? "approved" : "rejected";
  const nextEdge = graph.getOutgoingByHandle(pausedNode.id, outHandle);

  if (!nextEdge) {
    throw new Error(`No edge from node ${pausedNode.id} with handle '${outHandle}'`);
  }

  const startNode = findNode(workflow.configuration.nodes, nextEdge.target);
  if (!startNode) {
    throw new Error(`Node not found: ${nextEdge.target}`);
  }

  // Execute the workflow loop from the next node after approval
  const loopResult = await executeWorkflowLoop({
    workflow,
    graph,
    startNode,
    nodeInput,
    trace,
    startTime,
    workflowRunId,
    context,
  });

  // Handle early exit (pause or block)
  if (loopResult.earlyExit) {
    return loopResult.earlyExit;
  }

  // Execute end node with events
  const endNode = loopResult.endNode!;

  // Emit step.started for End node
  emitEvent(context, WorkflowEventTypes.WORKFLOW_STEP_STARTED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    nodeId: endNode.id,
    nodeType: endNode.type,
    nodeName: endNode.data.name || "End",
  });

  const endStartTime = Date.now();
  const endExecutor = getNodeExecutor("end");
  const endOutput = await endExecutor.execute(nodeInput, endNode.data, context);
  const endDurationMs = Date.now() - endStartTime;

  // Emit step.completed for End node
  emitEvent(context, WorkflowEventTypes.WORKFLOW_STEP_COMPLETED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    nodeId: endNode.id,
    nodeType: endNode.type,
    nodeName: endNode.data.name || "End",
    durationMs: endDurationMs,
    outHandle: undefined,
    output: endOutput,
  });

  trace.push({
    nodeId: endNode.id,
    nodeType: endNode.type,
    status: "completed",
    durationMs: endDurationMs,
  });

  const finalResponse = endOutput.response || loopResult.finalResponse;

  const totalDurationMs = Date.now() - startTime;

  context.log.info(
    {
      workflowKey: workflow.key,
      totalDurationMs,
      nodesExecuted: trace.length,
    },
    "workflow:resume:complete"
  );

  emitEvent(context, WorkflowEventTypes.WORKFLOW_COMPLETED, {
    workflowId: workflowRunId,
    workflowKey: workflow.key,
    durationMs: totalDurationMs,
    nodesExecuted: trace.length,
    output: nodeInput.variables,
  });

  return {
    success: true,
    response: finalResponse,
    toolCalls: loopResult.finalToolCalls,
    trace,
    totalDurationMs,
    variables: nodeInput.variables,
    usage: loopResult.aggregatedUsage.callCount > 0 ? loopResult.aggregatedUsage : undefined,
    deferredToolCalls: loopResult.finalDeferredToolCalls,
    exitRequested: loopResult.exitRequested,
  };
}
