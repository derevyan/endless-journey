/**
 * Workflow Event Subscriptions
 *
 * Subscribes to sync:workflow.* events from the storeEventBus and updates
 * the agent workflow and test stores for real-time UI updates.
 *
 * @module features/agent-workflows/stores/workflow-event-subscriptions
 */

import { createLogger } from "@journey/logger";
import { storeEventBus, type WorkflowSyncEvent } from "@/stores/store-event-bus";
import { agentWorkflowStore, agentWorkflowActions } from "./agent-workflow-store";
import { agentTestActions } from "./agent-test-store";

const log = createLogger("workflow-event-subscriptions");

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * Handle workflow started event - set current node and clear visited
 */
function handleWorkflowStarted(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.started" }>) {
  const { workflowKey, startNodeId } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  // Only update if this workflow is currently active in simulator
  if (mode !== "simulator" || workflowKey !== activeKey) {
    log.debug({ workflowKey, activeKey, mode }, "workflowEvent:skipped:notActive");
    return;
  }

  // Clear previous visited state and set start node as current
  agentWorkflowActions.clearSimulatorVisitedNodes();
  if (startNodeId) {
    agentWorkflowActions.setSimulatorCurrentNode(startNodeId);
    agentWorkflowActions.addSimulatorVisitedNode(startNodeId);
  }

  // Add console event
  agentTestActions.addConsoleEvent({
    type: "workflow_start",
    message: `Workflow started: ${event.payload.workflowName || workflowKey}`,
    details: {
      workflowId: event.payload.workflowId,
      workflowKey: event.payload.workflowKey,
      workflowName: event.payload.workflowName,
      startNodeId: event.payload.startNodeId,
    },
  });

  log.debug({ workflowKey, startNodeId }, "workflowEvent:started");
}

/**
 * Handle step started event - update current node
 */
function handleStepStarted(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.step.started" }>) {
  const { workflowKey, nodeId, nodeType, nodeName } = event.payload;
  const { workflowKey: activeKey, mode, edges } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Get the previous current node to find the edge
  const previousNodeId = agentWorkflowStore.state.simulatorCurrentNodeId;

  // Update current node
  agentWorkflowActions.setSimulatorCurrentNode(nodeId);
  agentWorkflowActions.addSimulatorVisitedNode(nodeId);

  // Find and mark the edge as visited
  if (previousNodeId) {
    const edge = edges.find((e) => e.source === previousNodeId && e.target === nodeId);
    if (edge) {
      agentWorkflowActions.addSimulatorVisitedEdge(edge.id);
    }
  }

  // Add console event
  agentTestActions.addConsoleEvent({
    type: "node_start",
    nodeId,
    nodeType,
    nodeName: nodeName || nodeId,
    message: `Executing: ${nodeName || nodeType} (${nodeId})`,
    details: {
      workflowId: event.payload.workflowId,
      nodeId,
      nodeType,
      nodeName,
    },
  });

  log.debug({ workflowKey, nodeId, nodeType }, "workflowEvent:stepStarted");
}

/**
 * Handle step completed event
 */
function handleStepCompleted(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.step.completed" }>) {
  const { workflowKey, nodeId, nodeType, nodeName, durationMs, outHandle, output } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Add console event with full node output for debugging
  agentTestActions.addConsoleEvent({
    type: "node_complete",
    nodeId,
    nodeType,
    nodeName: nodeName || nodeId,
    durationMs,
    message: `Completed: ${nodeName || nodeType}${durationMs ? ` (${durationMs}ms)` : ""}${outHandle ? ` → ${outHandle}` : ""}`,
    details: {
      workflowId: event.payload.workflowId,
      nodeId,
      nodeType,
      nodeName,
      outHandle,
      durationMs,
      output, // Contains node data + metadata for debugging
    },
  });

  log.debug({ workflowKey, nodeId, durationMs, outHandle }, "workflowEvent:stepCompleted");
}

/**
 * Handle step error event
 */
function handleStepError(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.step.error" }>) {
  const { workflowKey, nodeId, nodeType, nodeName, errorMessage } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Add console event
  agentTestActions.addConsoleEvent({
    type: "node_error",
    nodeId,
    nodeType,
    nodeName: nodeName || nodeId,
    message: `Error in ${nodeName || nodeType}: ${errorMessage}`,
    details: {
      workflowId: event.payload.workflowId,
      nodeId,
      nodeType,
      nodeName,
      errorMessage,
    },
  });

  log.debug({ workflowKey, nodeId, errorMessage }, "workflowEvent:stepError");
}

/**
 * Handle workflow completed event
 */
function handleWorkflowCompleted(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.completed" }>) {
  const { workflowKey, durationMs, nodesExecuted } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Clear current node (execution complete)
  agentWorkflowActions.setSimulatorCurrentNode(null);

  // Add console event
  agentTestActions.addConsoleEvent({
    type: "workflow_complete",
    durationMs,
    message: `Workflow completed${durationMs ? ` in ${durationMs}ms` : ""}${nodesExecuted ? ` (${nodesExecuted} nodes)` : ""}`,
    details: {
      workflowId: event.payload.workflowId,
      workflowKey,
      durationMs,
      nodesExecuted,
      success: event.payload.success,
    },
  });

  log.debug({ workflowKey, durationMs, nodesExecuted }, "workflowEvent:completed");
}

/**
 * Handle workflow error event
 */
function handleWorkflowError(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.error" }>) {
  const { workflowKey, errorMessage } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Clear current node (execution failed)
  agentWorkflowActions.setSimulatorCurrentNode(null);

  // Update test state
  agentTestActions.setError(errorMessage);

  // Add console event
  agentTestActions.addConsoleEvent({
    type: "workflow_error",
    message: `Workflow failed: ${errorMessage}`,
    details: {
      workflowId: event.payload.workflowId,
      workflowKey,
      errorMessage,
    },
  });

  log.debug({ workflowKey, errorMessage }, "workflowEvent:error");
}

/**
 * Handle guard blocked event
 */
function handleGuardBlocked(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.guard.blocked" }>) {
  const { workflowKey, nodeId, blockedBy, blockedMessage } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Add console event
  agentTestActions.addConsoleEvent({
    type: "node_blocked",
    nodeId,
    message: `Blocked by ${blockedBy}: ${blockedMessage || "Guard check failed"}`,
    details: {
      workflowId: event.payload.workflowId,
      workflowKey,
      nodeId,
      blockedBy,
      blockedMessage,
    },
  });

  log.debug({ workflowKey, nodeId, blockedBy }, "workflowEvent:guardBlocked");
}

/**
 * Handle workflow paused event
 */
function handleWorkflowPaused(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.paused" }>) {
  const { workflowKey, pausedAtNodeId, pauseReason } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Keep current node highlighted (paused at this node)
  // Add console event (use node_blocked as closest match)
  agentTestActions.addConsoleEvent({
    type: "node_blocked",
    nodeId: pausedAtNodeId,
    message: `Workflow paused: ${pauseReason || "awaiting input"}`,
    details: {
      workflowId: event.payload.workflowId,
      workflowKey,
      pausedAtNodeId,
      pauseReason,
    },
  });

  log.debug({ workflowKey, pausedAtNodeId, pauseReason }, "workflowEvent:paused");
}

/**
 * Handle workflow resumed event
 */
function handleWorkflowResumed(event: Extract<WorkflowSyncEvent, { type: "sync:workflow.resumed" }>) {
  const { workflowKey, resumedAtNodeId } = event.payload;
  const { workflowKey: activeKey, mode } = agentWorkflowStore.state;

  if (mode !== "simulator" || workflowKey !== activeKey) return;

  // Set the resumed node as current
  agentWorkflowActions.setSimulatorCurrentNode(resumedAtNodeId);

  // Add console event
  agentTestActions.addConsoleEvent({
    type: "node_start",
    nodeId: resumedAtNodeId,
    message: `Workflow resumed at: ${resumedAtNodeId}`,
    details: {
      workflowId: event.payload.workflowId,
      workflowKey,
      resumedAtNodeId,
      pauseDurationMs: event.payload.pauseDurationMs,
    },
  });

  log.debug({ workflowKey, resumedAtNodeId }, "workflowEvent:resumed");
}

// =============================================================================
// SUBSCRIPTION INITIALIZATION
// =============================================================================

let unsubscribe: (() => void) | null = null;

/**
 * Initialize workflow event subscriptions
 * Call this once when the workflow builder mounts
 */
export function initWorkflowEventSubscriptions(): void {
  if (unsubscribe) {
    log.warn({}, "workflowSubscriptions:alreadyInitialized");
    return;
  }

  // Subscribe to all workflow sync events
  const unsubStarted = storeEventBus.on("sync:workflow.started", handleWorkflowStarted);
  const unsubStepStarted = storeEventBus.on("sync:workflow.step.started", handleStepStarted);
  const unsubStepCompleted = storeEventBus.on("sync:workflow.step.completed", handleStepCompleted);
  const unsubStepError = storeEventBus.on("sync:workflow.step.error", handleStepError);
  const unsubCompleted = storeEventBus.on("sync:workflow.completed", handleWorkflowCompleted);
  const unsubError = storeEventBus.on("sync:workflow.error", handleWorkflowError);
  const unsubPaused = storeEventBus.on("sync:workflow.paused", handleWorkflowPaused);
  const unsubResumed = storeEventBus.on("sync:workflow.resumed", handleWorkflowResumed);
  const unsubGuardBlocked = storeEventBus.on("sync:workflow.guard.blocked", handleGuardBlocked);

  unsubscribe = () => {
    unsubStarted();
    unsubStepStarted();
    unsubStepCompleted();
    unsubStepError();
    unsubCompleted();
    unsubError();
    unsubPaused();
    unsubResumed();
    unsubGuardBlocked();
  };

  log.info({}, "workflowSubscriptions:initialized");
}

/**
 * Cleanup workflow event subscriptions
 * Call this when the workflow builder unmounts
 */
export function cleanupWorkflowEventSubscriptions(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    log.info({}, "workflowSubscriptions:cleaned");
  }
}
