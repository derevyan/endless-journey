/**
 * AI Report Service
 *
 * Business logic for generating AI-optimized execution reports.
 * Extracts session data, LLM usage, interactions, and builds structured reports.
 *
 * @module modules/ai-report/services/ai-report-service
 */

import { eq, asc } from "drizzle-orm";
import { llmUsageEvents, journeySessions, nodeOutputs, interactions, clients } from "@journey/db/schema";
import { NotFoundError } from "@journey/schemas";
import {
  buildExecutionReport,
  type LLMUsageRecord,
  type NodeOutputRecord,
  type SessionData,
  type JourneyData,
  type UserData,
  type InteractionRecord,
} from "@journey/ai-report/builders";
import type { ReportOptions, AIExecutionReport } from "@journey/ai-report/schemas";
import type { AiReportServiceContext } from "./service-context";

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Interaction row type from database select.
 */
interface InteractionRow {
  id: string;
  timestamp: Date;
  type: string;
  nodeId: string | null;
  payload: unknown;
}

/**
 * Raw session data from database query.
 */
interface RawSessionData {
  session: typeof journeySessions.$inferSelect;
  interactionRows: InteractionRow[];
  llmUsageRows: Array<typeof llmUsageEvents.$inferSelect>;
  nodeOutputRows: Array<typeof nodeOutputs.$inferSelect>;
  userData: typeof clients.$inferSelect | undefined;
}

// =============================================================================
// STATE DERIVATION HELPERS
// =============================================================================

/**
 * Derive current context (variables) from interaction history.
 * Applies all session.variables events to build final state.
 *
 * @param interactionRows - Chronologically ordered interaction events
 * @returns Current variable context derived from event history
 */
export function deriveContextFromInteractions(interactionRows: InteractionRow[]): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  for (const row of interactionRows) {
    if (row.type === "session.variables") {
      const payload = row.payload as {
        key?: string;
        value?: unknown;
        changes?: Array<{ key: string; value: unknown }>;
      };

      // Handle single change format
      if (payload.key !== undefined) {
        if (payload.value === null || payload.value === undefined) {
          delete context[payload.key];
        } else {
          context[payload.key] = payload.value;
        }
      }

      // Handle batch changes format
      if (payload.changes && Array.isArray(payload.changes)) {
        for (const change of payload.changes) {
          if (change.value === null || change.value === undefined) {
            delete context[change.key];
          } else {
            context[change.key] = change.value;
          }
        }
      }
    }
  }

  return context;
}

/**
 * Derive current tags from interaction history.
 * Applies all session.tags events to build final tag list.
 *
 * @param interactionRows - Chronologically ordered interaction events
 * @returns Current tag list derived from event history
 */
export function deriveTagsFromInteractions(interactionRows: InteractionRow[]): string[] {
  const tags = new Set<string>();

  for (const row of interactionRows) {
    if (row.type === "session.tags") {
      const payload = row.payload as {
        action?: "add" | "remove" | "set";
        tag?: string;
        tags?: string[];
      };

      if (payload.action === "add" && payload.tag) {
        tags.add(payload.tag);
      } else if (payload.action === "remove" && payload.tag) {
        tags.delete(payload.tag);
      } else if (payload.action === "set" && payload.tags) {
        tags.clear();
        for (const t of payload.tags) {
          tags.add(t);
        }
      }
    }
  }

  return Array.from(tags);
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch all raw data needed to build a session report.
 *
 * @param ctx - Service context with db client
 * @param sessionId - Session UUID to fetch data for
 * @returns Raw session data from database
 * @throws NotFoundError if session doesn't exist
 */
export async function fetchSessionData(ctx: AiReportServiceContext, sessionId: string): Promise<RawSessionData> {
  const { db } = ctx;

  // 1. Get session with basic data
  const session = await db
    .select()
    .from(journeySessions)
    .where(eq(journeySessions.id, sessionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!session) {
    throw new NotFoundError("Session", sessionId);
  }

  // 2. Fetch all required data in parallel
  const [interactionRows, llmUsageRows, nodeOutputRows, userData] = await Promise.all([
    // Interactions
    db
      .select()
      .from(interactions)
      .where(eq(interactions.sessionId, sessionId))
      .orderBy(asc(interactions.timestamp)),

    // LLM usage events
    db
      .select()
      .from(llmUsageEvents)
      .where(eq(llmUsageEvents.journeySessionId, sessionId))
      .orderBy(asc(llmUsageEvents.createdAt)),

    // Node outputs
    db
      .select()
      .from(nodeOutputs)
      .where(eq(nodeOutputs.sessionId, sessionId))
      .orderBy(asc(nodeOutputs.executedAt)),

    // Client info
    db
      .select()
      .from(clients)
      .where(eq(clients.id, session.clientId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  return {
    session,
    interactionRows: interactionRows as InteractionRow[],
    llmUsageRows,
    nodeOutputRows,
    userData,
  };
}

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

/**
 * Transform raw session data into builder format.
 *
 * @param rawData - Raw data from database queries
 * @returns Transformed session data for report builder
 */
export function transformSessionData(rawData: RawSessionData): SessionData {
  const { session, interactionRows, nodeOutputRows } = rawData;

  const sessionData: SessionData = {
    id: session.id,
    status: session.status as SessionData["status"],
    currentNodeId: session.currentNodeId,
    startedAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    context: deriveContextFromInteractions(interactionRows),
    tags: deriveTagsFromInteractions(interactionRows),
    nodeOutputs: {},
  };

  // Build node outputs map (keyed by nodeId to prevent key collisions)
  for (const output of nodeOutputRows) {
    sessionData.nodeOutputs[output.nodeId] = {
      label: output.sanitizedLabel ?? undefined,
      data: output.data,
    };
  }

  return sessionData;
}

/**
 * Transform journey entity into builder format.
 */
export function transformJourneyData(journey: {
  id: string;
  name: string;
  slug: string | null;
  configuration: unknown;
}): JourneyData {
  return {
    id: journey.id,
    name: journey.name,
    slug: journey.slug ?? undefined,
    configuration: journey.configuration as JourneyData["configuration"],
  };
}

/**
 * Transform raw user/client data into builder format.
 */
export function transformUserData(
  rawData: RawSessionData
): UserData {
  const { userData, session } = rawData;
  return {
    id: userData?.id || session.clientId || "anonymous",
    platformUserId: userData?.platformUserId ?? undefined,
    firstName: userData?.firstName ?? undefined,
    lastName: userData?.lastName ?? undefined,
  };
}

/**
 * Transform interaction rows into builder format.
 */
export function transformInteractionRecords(interactionRows: InteractionRow[]): InteractionRecord[] {
  return interactionRows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    eventType: row.type,
    nodeId: row.nodeId,
    payload: row.payload,
  }));
}

/**
 * Transform LLM usage rows into builder format.
 */
export function transformLLMUsageRecords(
  llmUsageRows: Array<typeof llmUsageEvents.$inferSelect>
): LLMUsageRecord[] {
  return llmUsageRows.map((row) => ({
    id: row.id,
    journeySessionId: row.journeySessionId,
    service: row.service,
    module: row.module,
    model: row.model,
    provider: row.provider,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    costUSD: row.costUSD ?? "0",
    durationMs: row.durationMs,
    systemPrompt: row.systemPrompt,
    inputMessages: row.inputMessages as LLMUsageRecord["inputMessages"],
    outputContent: row.outputContent,
    outputToolCalls: row.outputToolCalls as LLMUsageRecord["outputToolCalls"],
    finishReason: row.finishReason,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  }));
}

/**
 * Transform node output rows into builder format.
 */
export function transformNodeOutputRecords(
  nodeOutputRows: Array<typeof nodeOutputs.$inferSelect>
): NodeOutputRecord[] {
  return nodeOutputRows.map((row) => ({
    nodeId: row.nodeId,
    nodeLabel: row.nodeLabel ?? undefined,
    nodeType: row.nodeType ?? "unknown",
    data: row.data,
    executedAt: row.executedAt.toISOString(),
  }));
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Input parameters for generating an AI report.
 */
export interface GenerateReportParams {
  /** Session UUID */
  sessionId: string;
  /** Journey entity (already fetched with access check) */
  journey: {
    id: string;
    name: string;
    slug: string | null;
    configuration: unknown;
  };
  /** Report options from query params */
  options: ReportOptions;
}

/**
 * Result of report generation including metadata for logging.
 */
export interface GenerateReportResult {
  /** The generated execution report */
  report: AIExecutionReport;
  /** Metadata for logging */
  metadata: {
    journeyLogCount: number;
    aiConversationCount: number;
    llmUsageEventCount: number;
  };
}

/**
 * Generate an AI-optimized execution report for a session.
 *
 * This is the main service function that orchestrates:
 * 1. Fetching all required data from database
 * 2. Transforming data into builder format
 * 3. Building the final report
 *
 * @param ctx - Service context with db client
 * @param params - Report generation parameters
 * @returns Generated report with metadata
 * @throws NotFoundError if session doesn't exist
 */
export async function generateReport(
  ctx: AiReportServiceContext,
  params: GenerateReportParams
): Promise<GenerateReportResult> {
  const { sessionId, journey, options } = params;

  // 1. Fetch all raw data
  const rawData = await fetchSessionData(ctx, sessionId);

  // 2. Transform data to builder format
  const sessionData = transformSessionData(rawData);
  const journeyData = transformJourneyData(journey);
  const userData = transformUserData(rawData);
  const interactionRecords = transformInteractionRecords(rawData.interactionRows);
  const llmUsageRecords = transformLLMUsageRecords(rawData.llmUsageRows);
  const nodeOutputRecords = transformNodeOutputRecords(rawData.nodeOutputRows);

  // 3. Build the report
  const report = buildExecutionReport(
    sessionData,
    journeyData,
    userData,
    interactionRecords,
    llmUsageRecords,
    nodeOutputRecords,
    options
  );

  return {
    report,
    metadata: {
      journeyLogCount: report.journeyLog.length,
      aiConversationCount: report.aiConversations.length,
      llmUsageEventCount: llmUsageRecords.length,
    },
  };
}

/**
 * Get session's journey ID for access control check.
 *
 * @param ctx - Service context with db client
 * @param sessionId - Session UUID
 * @returns Journey ID if session exists
 * @throws NotFoundError if session doesn't exist
 */
export async function getSessionJourneyId(ctx: AiReportServiceContext, sessionId: string): Promise<string> {
  const { db } = ctx;

  const session = await db
    .select({ journeyId: journeySessions.journeyId })
    .from(journeySessions)
    .where(eq(journeySessions.id, sessionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!session) {
    throw new NotFoundError("Session", sessionId);
  }

  return session.journeyId;
}
