/**
 * Mindstate Analysis Service
 *
 * Message analysis using the @journey/mindstate ECS pipeline.
 * Handles real-time and preview analysis of user messages.
 *
 * @module modules/mindstates/services/analysis-service
 */

import { clientMindstates, interactions, mindstateAnalysisLog } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import { executePipeline, type PipelineContext, type PipelineResult, type StateUpdateOutput, type Message } from "@journey/mindstate";
import type { AgentInsight, AnalysisTrigger, MainAgent, PipelineMetrics, StateChange, StateParameter, SystemAgent } from "@journey/schemas";
import { EventTypes, NotFoundError } from "@journey/schemas";
import { desc, eq } from "drizzle-orm";

import { isRecord, isString } from "../../../lib/type-guards";
import { getClientMindstateById } from "./client-mindstate-service";
import { getDefinitionById } from "./definition-service";
import type { MindstateServiceContext } from "./service-context";

const log = createLogger("mindstate-analysis-service");

const HISTORY_LIMIT = 50;

// =============================================================================
// TYPES
// =============================================================================

export interface AnalysisResult {
  mindstateId: string;
  changes: StateChange[];
  newInsights: AgentInsight[];
  metrics: PipelineMetrics;
  responseMessage?: string;
}

export interface PreviewAnalysisConfig {
  message: string;
  currentState: StateParameter[];
  systemAgents: SystemAgent[];
  mainAgent: MainAgent;
  messageHistory?: Array<{ role: "user" | "assistant"; content: string; id?: string; timestamp?: number }>;
}

export interface PreviewAnalysisResult {
  response: string;
  insights: AgentInsight[];
  stateChanges: StateChange[];
  updatedState: StateParameter[];
  metrics: PipelineMetrics;
}

export interface AnalysisLogEntry {
  id: string;
  trigger: AnalysisTrigger;
  changes: StateChange[];
  newInsights: AgentInsight[];
  metrics: PipelineMetrics | null;
  inputMessage: string | null;
  responseMessage: string | null;
  createdAt: Date | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map pipeline state update changes to StateChange schema format
 * Shared by both production and preview analysis
 */
function mapPipelineChangesToStateChanges(changes: StateUpdateOutput["changes"]): StateChange[] {
  return changes.map((change) => ({
    parameterId: change.parameterId,
    parameterName: change.parameterName,
    previousValue: change.oldValue,
    newValue: change.newValue,
    reasoning: change.reasoning,
    agentId: change.agentId,
  }));
}

function mapInteractionToMessage(row: {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
}): Message | null {
  if (row.type === EventTypes.USER_MESSAGE) {
    if (!isRecord(row.payload)) return null;
    const text = row.payload.text;
    if (!isString(text)) return null;
    return {
      id: row.id,
      role: "user",
      content: text,
      timestampMs: row.timestamp.getTime(),
    };
  }

  if (row.type === EventTypes.ENGINE_MESSAGE) {
    if (!isRecord(row.payload)) return null;
    const content = row.payload.content;
    if (!isString(content)) return null;
    return {
      id: row.id,
      role: "assistant",
      content,
      timestampMs: row.timestamp.getTime(),
    };
  }

  return null;
}

async function loadSessionMessages(ctx: MindstateServiceContext, sessionId: string): Promise<Message[]> {
  const rows = await ctx.db
    .select({
      id: interactions.id,
      type: interactions.type,
      payload: interactions.payload,
      timestamp: interactions.timestamp,
    })
    .from(interactions)
    .where(eq(interactions.sessionId, sessionId))
    .orderBy(desc(interactions.timestamp))
    .limit(HISTORY_LIMIT);

  const messages: Message[] = [];
  for (const row of rows) {
    const message = mapInteractionToMessage(row);
    if (message) {
      messages.push(message);
    }
  }

  return messages.reverse();
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Analyze a user message and update mindstate
 * Uses @journey/mindstate pipeline for ECS-based analysis
 */
export async function analyzeMessage(
  ctx: MindstateServiceContext,
  mindstateId: string,
  message: string,
  trigger: AnalysisTrigger = "message",
  sessionId?: string
): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    // Get the client mindstate
    const mindstate = await getClientMindstateById(ctx, mindstateId);
    if (!mindstate) {
      throw new NotFoundError("ClientMindstate", mindstateId);
    }

    // Get the definition for main agent config
    const definition = await getDefinitionById(ctx, mindstate.definitionId);
    if (!definition) {
      throw new NotFoundError("MindstateDefinition", mindstate.definitionId);
    }

    const messages = sessionId ? await loadSessionMessages(ctx, sessionId) : [];

    // Build pipeline context
    const pipelineContext: PipelineContext = {
      userState: mindstate.stateParameters,
      systemAgents: mindstate.systemAgents,
      mainAgent: definition.mainAgentConfig,
      messages,
    };

    // Execute the pipeline
    const result: PipelineResult = await executePipeline({
      userMessage: message,
      context: pipelineContext,
    });

    // Map changes to StateChange format
    const stateChanges = mapPipelineChangesToStateChanges(result.changes);

    // Update the client mindstate in the database
    await ctx.db
      .update(clientMindstates)
      .set({
        stateParameters: result.updatedState,
        agentInsights: [...mindstate.agentInsights, ...result.newInsights].slice(-100), // Keep last 100 insights
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clientMindstates.id, mindstateId));

    // Log the analysis
    // Serialize failed agents to JSON-friendly format
    const serializedFailedAgents = (result.failedAgents ?? []).map((fa) => ({
      agentId: fa.agentId,
      agentName: fa.agentName,
      error: fa.error instanceof Error ? fa.error.message : String(fa.error),
      affectedParams: fa.affectedParams,
    }));

    await ctx.db.insert(mindstateAnalysisLog).values({
      clientMindstateId: mindstateId,
      sessionId: sessionId ?? null,
      trigger,
      metrics: result.metrics,
      changes: stateChanges,
      newInsights: result.newInsights,
      inputMessage: message,
      responseMessage: result.assistantMessage.content,

      // Debugging and audit data for production troubleshooting
      failedAgents: serializedFailedAgents,
      conflicts: result.conflicts ?? [],
      mainAgentError: result.mainAgentError?.message ?? null,
      partialSuccess: result.partialSuccess ?? false,
      allAgentsFailed: result.allAgentsFailed ?? false,

      createdAt: new Date(),
    });

    log.info(
      {
        mindstateId,
        trigger,
        changesCount: stateChanges.length,
        durationMs: Date.now() - startTime,
      },
      "analysisService:analyzeMessage:complete"
    );

    return {
      mindstateId,
      changes: stateChanges,
      newInsights: result.newInsights,
      metrics: result.metrics,
      responseMessage: result.assistantMessage.content,
    };
  } catch (error) {
    log.error({ mindstateId, trigger, err: serializeError(error) }, "analysisService:analyzeMessage:error");
    throw error;
  }
}

/**
 * Analyze a message in preview/testing mode
 * Runs the full pipeline but doesn't persist to database
 * Used by the MindState Builder for testing definitions
 */
export async function previewAnalyzeMessage(config: PreviewAnalysisConfig): Promise<PreviewAnalysisResult> {
  const startTime = Date.now();

  try {
    const history = config.messageHistory ?? [];
    const now = Date.now();

    // Transform message history to full Message objects
    const messages = history.map((msg, idx) => ({
      id: msg.id ?? `preview-msg-${idx}`,
      role: msg.role,
      content: msg.content,
      timestampMs: msg.timestamp ? new Date(msg.timestamp).getTime() : now - (history.length - idx) * 1000,
    }));

    // Build pipeline context from config
    const pipelineContext: PipelineContext = {
      userState: config.currentState,
      systemAgents: config.systemAgents,
      mainAgent: config.mainAgent,
      messages,
    };

    // Execute the pipeline
    const result: PipelineResult = await executePipeline({
      userMessage: config.message,
      context: pipelineContext,
    });

    // Map changes to StateChange format
    const stateChanges = mapPipelineChangesToStateChanges(result.changes);

    log.info(
      {
        changesCount: stateChanges.length,
        insightsCount: result.newInsights.length,
        durationMs: Date.now() - startTime,
      },
      "analysisService:previewAnalyzeMessage:complete"
    );

    return {
      response: result.assistantMessage.content,
      insights: result.newInsights,
      stateChanges,
      updatedState: result.updatedState,
      metrics: result.metrics,
    };
  } catch (error) {
    log.error({ err: serializeError(error) }, "analysisService:previewAnalyzeMessage:error");
    throw error;
  }
}

/**
 * Get analysis history for a client mindstate
 */
export async function getAnalysisHistory(
  ctx: MindstateServiceContext,
  mindstateId: string,
  limit = 50
): Promise<AnalysisLogEntry[]> {
  try {
    const results = await ctx.db
      .select()
      .from(mindstateAnalysisLog)
      .where(eq(mindstateAnalysisLog.clientMindstateId, mindstateId))
      .orderBy(mindstateAnalysisLog.createdAt)
      .limit(limit);

    return results.map((row) => ({
      id: row.id,
      trigger: row.trigger,
      changes: row.changes ?? [],
      newInsights: row.newInsights ?? [],
      metrics: row.metrics,
      inputMessage: row.inputMessage,
      responseMessage: row.responseMessage,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    log.error({ mindstateId, err: serializeError(error) }, "analysisService:getAnalysisHistory:error");
    throw error;
  }
}
