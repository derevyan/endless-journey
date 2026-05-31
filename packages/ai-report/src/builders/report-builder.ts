/**
 * Report Builder
 *
 * Main orchestrator for building AI execution reports.
 *
 * @module @journey/ai-report/builders/report-builder
 */

import { createLogger } from "@journey/logger";
import type {
  AIExecutionReport,
  ReportOptions,
  JourneyGraph,
  ReportSummary,
} from "../schemas";
import { buildJourneyLog, type InteractionRecord, type NodeInfo } from "./journey-log-builder";
import { buildTransitions } from "./transition-builder";
import { buildMessages, extractErrors } from "./message-builder";
import { buildButtonClicks, buildUnprocessedEvents } from "./button-click-builder";
import { buildAIConversations, type LLMUsageRecord, type AgentNodeOutputRecord } from "./conversation-builder";
import { buildWorkflowExecutions } from "./workflow-builder";
import { buildVariableChanges } from "./variable-builder";
import { buildCRMActions } from "./crm-builder";
import { buildHITLDecisions } from "./hitl-builder";
import { buildPerformanceAnalysis } from "./performance-builder";
import { detectIssues } from "../analyzers/issue-detector";
import { buildPathDescription } from "../analyzers/path-analyzer";

const log = createLogger("ai-report");

/**
 * Node output with label metadata.
 * Keyed by nodeId to prevent collisions from duplicate labels.
 */
export interface NodeOutputEntry {
  label?: string;
  data: unknown;
}

/**
 * Session data from database.
 */
export interface SessionData {
  id: string;
  status: "active" | "completed" | "dropped" | "paused" | "error";
  mode?: "live" | "test" | "simulation";
  currentNodeId: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  context: Record<string, unknown>;
  tags: string[];
  /** Node outputs keyed by nodeId (not label) to prevent key collisions */
  nodeOutputs: Record<string, NodeOutputEntry>;
}

/**
 * Journey data from database.
 */
export interface JourneyData {
  id: string;
  name: string;
  slug?: string;
  configuration: {
    nodes: Array<{
      id: string;
      type: string;
      data: { label?: string; [key: string]: unknown };
      position?: { x: number; y: number };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
      label?: string;
      data?: unknown;
    }>;
  };
}

/**
 * User data from database.
 */
export interface UserData {
  id: string;
  platformUserId?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Build journey graph from configuration.
 */
function buildJourneyGraph(journey: JourneyData): JourneyGraph {
  const nodeTypeCounts: Record<string, number> = {};

  for (const node of journey.configuration.nodes) {
    nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] || 0) + 1;
  }

  return {
    nodes: journey.configuration.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.data.label,
      data: n.data,
      position: n.position,
    })),
    edges: journey.configuration.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      data: e.data,
    })),
    nodeTypeCounts,
  };
}

/**
 * Build node map from journey configuration.
 */
function buildNodeMap(journey: JourneyData): Map<string, NodeInfo> {
  const nodeMap = new Map<string, NodeInfo>();

  for (const node of journey.configuration.nodes) {
    nodeMap.set(node.id, {
      id: node.id,
      type: node.type,
      label: node.data.label,
    });
  }

  return nodeMap;
}

/**
 * Build summary from report sections.
 */
function buildSummary(
  journeyLog: ReturnType<typeof buildJourneyLog>,
  messages: ReturnType<typeof buildMessages>,
  transitions: ReturnType<typeof buildTransitions>,
  buttonClicks: ReturnType<typeof buildButtonClicks>,
  errors: ReturnType<typeof extractErrors>,
  llmUsageEvents: LLMUsageRecord[],
  totalDurationMs: number
): ReportSummary {
  const userMessages = messages.filter((m) => m.direction === "inbound" && m.isTextInput).length;
  const botMessages = messages.filter((m) => m.direction === "outbound").length;
  const nodeIds = new Set(transitions.map((t) => t.toNodeId));

  // Calculate LLM metrics
  const totalTokensUsed = llmUsageEvents.reduce((sum, e) => sum + e.totalTokens, 0);
  const totalLlmCostUSD = llmUsageEvents.reduce((sum, e) => sum + parseFloat(e.costUSD), 0);
  const llmCallCount = llmUsageEvents.length;

  return {
    pathDescription: buildPathDescription(transitions),
    nodesVisited: transitions.length,
    uniqueNodes: nodeIds.size,
    totalMessages: messages.length,
    userMessages,
    botMessages,
    buttonClicks: buttonClicks.length,
    timeoutsTriggered: journeyLog.filter((e) => e.eventType === "timer_expired").length,
    errorsCount: errors.length,
    warningsCount: 0, // Will be populated by issue detection
    totalDurationMs,
    // LLM metrics (optional, only if there are LLM events)
    totalTokensUsed: llmCallCount > 0 ? totalTokensUsed : undefined,
    totalLlmCostUSD: llmCallCount > 0 ? totalLlmCostUSD : undefined,
    llmCallCount: llmCallCount > 0 ? llmCallCount : undefined,
  };
}

/**
 * Node output record with additional metadata.
 */
export interface NodeOutputRecord {
  nodeId: string;
  nodeLabel?: string;
  nodeType: string;
  data: unknown;
  executedAt: string;
}

/**
 * Build comprehensive AI execution report.
 *
 * @param session - Session data from database
 * @param journey - Journey configuration
 * @param user - User data
 * @param interactions - Interaction events
 * @param llmUsageEvents - LLM usage events (optional, for full AI conversation details)
 * @param nodeOutputRecords - Node outputs (optional, for workflow execution details)
 * @param options - Report options
 */
export function buildExecutionReport(
  session: SessionData,
  journey: JourneyData,
  user: UserData,
  interactions: InteractionRecord[],
  llmUsageEvents: LLMUsageRecord[] = [],
  nodeOutputRecords: NodeOutputRecord[] = [],
  options: ReportOptions = {}
): AIExecutionReport {
  const {
    includeGraph = true,
    includeMessages = true,
    maxEvents,
    fromTimestamp,
    toTimestamp,
  } = options;

  log.info({ sessionId: session.id }, "aiReport:buildExecutionReport:start");

  // Build node map for enrichment
  const nodeMap = buildNodeMap(journey);

  // Filter interactions if needed
  let filteredInteractions = interactions;
  if (fromTimestamp) {
    filteredInteractions = filteredInteractions.filter((i) => i.timestamp >= fromTimestamp);
  }
  if (toTimestamp) {
    filteredInteractions = filteredInteractions.filter((i) => i.timestamp <= toTimestamp);
  }
  if (maxEvents) {
    filteredInteractions = filteredInteractions.slice(0, maxEvents);
  }

  // Build report sections
  const journeyLog = buildJourneyLog(filteredInteractions, nodeMap);
  const transitions = buildTransitions(filteredInteractions, nodeMap);
  const messages = includeMessages ? buildMessages(filteredInteractions, nodeMap) : [];
  const errors = extractErrors(filteredInteractions, nodeMap);
  const buttonClicks = buildButtonClicks(filteredInteractions, nodeMap);
  const unprocessedEvents = buildUnprocessedEvents(buttonClicks);
  const crmActions = buildCRMActions(filteredInteractions, nodeMap);
  const hitlDecisions = buildHITLDecisions(filteredInteractions, nodeMap);

  // Calculate total duration
  const startTime = new Date(session.startedAt).getTime();
  const endTime = session.completedAt
    ? new Date(session.completedAt).getTime()
    : new Date(session.updatedAt).getTime();
  const totalDurationMs = endTime - startTime;

  // Build summary
  const summary = buildSummary(journeyLog, messages, transitions, buttonClicks, errors, llmUsageEvents, totalDurationMs);

  // Detect issues
  const issues = detectIssues(journeyLog, buttonClicks, errors, transitions);

  // Update warnings count in summary
  summary.warningsCount = issues.filter((i) => i.severity === "warning").length;

  const report: AIExecutionReport = {
    reportVersion: "1.0",
    generatedAt: new Date().toISOString(),
    reportType: session.status === "active" ? "in_progress" : "completed",

    session: {
      id: session.id,
      status: session.status,
      mode: session.mode,
      currentNodeId: session.currentNodeId,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      totalDurationMs,
    },

    journey: {
      id: journey.id,
      name: journey.name,
      slug: journey.slug,
    },

    journeyGraph: includeGraph ? buildJourneyGraph(journey) : undefined,

    user: {
      id: user.id,
      platformUserId: user.platformUserId,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.id,
      tags: session.tags,
    },

    summary,
    journeyLog,
    transitions,
    messages,
    errors,
    workflowExecutions: buildWorkflowExecutions(
      nodeOutputRecords as AgentNodeOutputRecord[],
      llmUsageEvents,
      options
    ),
    aiConversations: buildAIConversations(
      nodeOutputRecords as AgentNodeOutputRecord[],
      llmUsageEvents,
      options
    ),
    crmActions: crmActions.length > 0 ? crmActions : undefined,
    hitlDecisions: hitlDecisions.length > 0 ? hitlDecisions : undefined,
    variableChanges: buildVariableChanges(filteredInteractions, nodeMap),
    currentVariables: session.context,
    currentTags: session.tags,
    nodeOutputs: session.nodeOutputs,
    buttonClicks,
    unprocessedEvents,
    issues,
    performanceAnalysis: buildPerformanceAnalysis(
      transitions,
      buildWorkflowExecutions(nodeOutputRecords as AgentNodeOutputRecord[], llmUsageEvents, options)
    ),
  };

  log.info(
    {
      sessionId: session.id,
      journeyLogCount: journeyLog.length,
      transitionCount: transitions.length,
      issueCount: issues.length,
    },
    "aiReport:buildExecutionReport:complete"
  );

  return report;
}
