/**
 * Events Service
 *
 * Data access helpers for interaction/event queries and replay.
 *
 * @module modules/events/services/event-service
 */

import { clients, events as eventsTable, interactions, journeys, journeySessions, llmUsageEvents } from "@journey/db";
import type {
  CrmEventFilters,
  CrmEventListItem,
  EventListFilters,
  EventStats,
  InteractionEventListItem,
  LlmEventFilters,
  LlmMessage,
  LlmToolCall,
  LlmUsageEvent,
  LlmUsageStats,
  ReplayEventRecord,
  ReplayFilters,
} from "@journey/schemas";
import { and, asc, count, desc, eq, gt, gte, inArray, like, lte, sql } from "drizzle-orm";

import { isRecord } from "../../../lib/type-guards";
import type { EventServiceContext } from "./service-context";

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isLlmMessage(value: unknown): value is LlmMessage {
  if (!isRecord(value)) return false;
  const role = value.role;
  if (role !== "user" && role !== "assistant" && role !== "system" && role !== "tool") return false;
  if (typeof value.content !== "string") return false;
  if (value.toolCallId !== undefined && typeof value.toolCallId !== "string") return false;
  return true;
}

function parseLlmMessages(value: unknown): LlmMessage[] | null {
  if (!Array.isArray(value)) return null;
  const messages: LlmMessage[] = [];
  for (const item of value) {
    if (!isLlmMessage(item)) return null;
    messages.push(item);
  }
  return messages;
}

function isLlmToolCall(value: unknown): value is LlmToolCall {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string";
}

function parseLlmToolCalls(value: unknown): LlmToolCall[] | null {
  if (!Array.isArray(value)) return null;
  const toolCalls: LlmToolCall[] = [];
  for (const item of value) {
    if (!isLlmToolCall(item)) return null;
    toolCalls.push({
      id: item.id,
      name: item.name,
      args: item.args,
    });
  }
  return toolCalls;
}

export async function listInteractionEvents(
  ctx: EventServiceContext,
  filters: EventListFilters
): Promise<{ events: InteractionEventListItem[]; total: number }> {
  const conditions = [eq(journeys.organizationId, filters.organizationId)];

  if (filters.types && filters.types.length > 0) {
    conditions.push(inArray(interactions.type, filters.types));
  }
  if (filters.startDate) {
    conditions.push(gte(interactions.timestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(interactions.timestamp, new Date(filters.endDate)));
  }
  if (filters.sessionId) {
    conditions.push(eq(interactions.sessionId, filters.sessionId));
  }
  if (filters.journeyId) {
    conditions.push(eq(journeySessions.journeyId, filters.journeyId));
  }

  const rows = await ctx.db
    .select({
      id: interactions.id,
      sessionId: interactions.sessionId,
      type: interactions.type,
      nodeId: interactions.nodeId,
      payload: interactions.payload,
      metadata: interactions.metadata,
      timestamp: interactions.timestamp,
      journeyId: journeySessions.journeyId,
      journeyName: journeys.name,
      clientId: journeySessions.clientId,
    })
    .from(interactions)
    .innerJoin(journeySessions, eq(interactions.sessionId, journeySessions.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(and(...conditions))
    .orderBy(desc(interactions.timestamp))
    .limit(filters.limit)
    .offset(filters.offset);

  const events: InteractionEventListItem[] = rows.map((row) => ({
    ...row,
    metadata: asRecord(row.metadata),
  }));

  const countResult = await ctx.db
    .select({ count: count() })
    .from(interactions)
    .innerJoin(journeySessions, eq(interactions.sessionId, journeySessions.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(and(...conditions));

  return { events, total: countResult[0]?.count || 0 };
}

export async function getEventStats(ctx: EventServiceContext, organizationId: string): Promise<EventStats> {
  const typeStats = await ctx.db
    .select({
      type: interactions.type,
      count: count(),
    })
    .from(interactions)
    .innerJoin(journeySessions, eq(interactions.sessionId, journeySessions.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(eq(journeys.organizationId, organizationId))
    .groupBy(interactions.type);

  const totalResult = await ctx.db
    .select({ count: count() })
    .from(interactions)
    .innerJoin(journeySessions, eq(interactions.sessionId, journeySessions.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(eq(journeys.organizationId, organizationId));

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentResult = await ctx.db
    .select({ count: count() })
    .from(interactions)
    .innerJoin(journeySessions, eq(interactions.sessionId, journeySessions.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(and(eq(journeys.organizationId, organizationId), gte(interactions.timestamp, last24h)));

  return {
    total: totalResult[0]?.count || 0,
    last24h: recentResult[0]?.count || 0,
    byType: typeStats.reduce<Record<string, number>>((acc, stat) => {
      acc[stat.type] = stat.count;
      return acc;
    }, {}),
  };
}

export async function listEventTypes(ctx: EventServiceContext, organizationId: string): Promise<string[]> {
  const types = await ctx.db
    .selectDistinct({ type: interactions.type })
    .from(interactions)
    .innerJoin(journeySessions, eq(interactions.sessionId, journeySessions.id))
    .innerJoin(journeys, eq(journeySessions.journeyId, journeys.id))
    .where(eq(journeys.organizationId, organizationId));

  return types.map((row) => row.type);
}

export async function listCrmEvents(
  ctx: EventServiceContext,
  filters: CrmEventFilters
): Promise<{ events: CrmEventListItem[]; total: number }> {
  const conditions = [
    eq(eventsTable.organizationId, filters.organizationId),
    inArray(eventsTable.type, filters.eventTypes),
  ];

  if (filters.startDate) {
    conditions.push(gte(eventsTable.timestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(eventsTable.timestamp, new Date(filters.endDate)));
  }

  const rows = await ctx.db
    .select({
      id: eventsTable.id,
      type: eventsTable.type,
      clientId: eventsTable.clientId,
      organizationId: eventsTable.organizationId,
      payload: eventsTable.payload,
      performedBy: eventsTable.performedBy,
      timestamp: eventsTable.timestamp,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientUsername: clients.username,
    })
    .from(eventsTable)
    .leftJoin(clients, eq(eventsTable.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(eventsTable.timestamp))
    .limit(filters.limit)
    .offset(filters.offset);

  const events: CrmEventListItem[] = rows.map((row) => ({
    ...row,
    payload: asRecord(row.payload),
  }));

  const countResult = await ctx.db
    .select({ count: count() })
    .from(eventsTable)
    .where(and(...conditions));

  return { events, total: countResult[0]?.count || 0 };
}

export async function listLlmEvents(
  ctx: EventServiceContext,
  filters: LlmEventFilters
): Promise<{ events: LlmUsageEvent[]; total: number }> {
  const conditions = [eq(llmUsageEvents.organizationId, filters.organizationId)];

  if (filters.services && filters.services.length > 0) {
    conditions.push(inArray(llmUsageEvents.service, filters.services));
  }
  if (filters.models && filters.models.length > 0) {
    conditions.push(inArray(llmUsageEvents.model, filters.models));
  }
  if (filters.providers && filters.providers.length > 0) {
    conditions.push(inArray(llmUsageEvents.provider, filters.providers));
  }
  if (filters.startDate) {
    conditions.push(gte(llmUsageEvents.createdAt, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(llmUsageEvents.createdAt, new Date(filters.endDate)));
  }

  const rows = await ctx.db
    .select({
      id: llmUsageEvents.id,
      organizationId: llmUsageEvents.organizationId,
      userId: llmUsageEvents.userId,
      journeyId: llmUsageEvents.journeyId,
      journeySessionId: llmUsageEvents.journeySessionId,
      clientId: llmUsageEvents.clientId,
      service: llmUsageEvents.service,
      module: llmUsageEvents.module,
      tool: llmUsageEvents.tool,
      model: llmUsageEvents.model,
      provider: llmUsageEvents.provider,
      promptTokens: llmUsageEvents.promptTokens,
      completionTokens: llmUsageEvents.completionTokens,
      totalTokens: llmUsageEvents.totalTokens,
      costUSD: llmUsageEvents.costUSD,
      durationMs: llmUsageEvents.durationMs,
      systemPrompt: llmUsageEvents.systemPrompt,
      inputMessages: llmUsageEvents.inputMessages,
      outputContent: llmUsageEvents.outputContent,
      outputToolCalls: llmUsageEvents.outputToolCalls,
      finishReason: llmUsageEvents.finishReason,
      errorMessage: llmUsageEvents.errorMessage,
      metadata: llmUsageEvents.metadata,
      createdAt: llmUsageEvents.createdAt,
      journeyName: journeys.name,
      journeySlug: journeys.slug,
    })
    .from(llmUsageEvents)
    .leftJoin(journeys, eq(llmUsageEvents.journeyId, journeys.id))
    .where(and(...conditions))
    .orderBy(desc(llmUsageEvents.createdAt))
    .limit(filters.limit)
    .offset(filters.offset);

  const events: LlmUsageEvent[] = rows.map((row) => ({
    ...row,
    inputMessages: parseLlmMessages(row.inputMessages),
    outputToolCalls: parseLlmToolCalls(row.outputToolCalls),
    metadata: asRecord(row.metadata),
  }));

  const countResult = await ctx.db
    .select({ count: count() })
    .from(llmUsageEvents)
    .where(and(...conditions));

  return { events, total: countResult[0]?.count || 0 };
}

export async function getLlmStats(ctx: EventServiceContext, organizationId: string): Promise<LlmUsageStats> {
  const stats = await ctx.db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${llmUsageEvents.totalTokens}), 0)`.mapWith(Number),
      totalCostUSD: sql<string>`COALESCE(SUM(${llmUsageEvents.costUSD}), 0)`,
      callCount: count(),
    })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.organizationId, organizationId));

  const byModel = await ctx.db
    .select({
      model: llmUsageEvents.model,
      totalTokens: sql<number>`COALESCE(SUM(${llmUsageEvents.totalTokens}), 0)`.mapWith(Number),
      totalCostUSD: sql<string>`COALESCE(SUM(${llmUsageEvents.costUSD}), 0)`,
      callCount: count(),
    })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.organizationId, organizationId))
    .groupBy(llmUsageEvents.model);

  const byService = await ctx.db
    .select({
      service: llmUsageEvents.service,
      totalTokens: sql<number>`COALESCE(SUM(${llmUsageEvents.totalTokens}), 0)`.mapWith(Number),
      totalCostUSD: sql<string>`COALESCE(SUM(${llmUsageEvents.costUSD}), 0)`,
      callCount: count(),
    })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.organizationId, organizationId))
    .groupBy(llmUsageEvents.service);

  const distinctServices = await ctx.db
    .selectDistinct({ service: llmUsageEvents.service })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.organizationId, organizationId));

  const distinctModels = await ctx.db
    .selectDistinct({ model: llmUsageEvents.model })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.organizationId, organizationId));

  const distinctProviders = await ctx.db
    .selectDistinct({ provider: llmUsageEvents.provider })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.organizationId, organizationId));

  return {
    totals: {
      tokens: stats[0]?.totalTokens || 0,
      costUSD: stats[0]?.totalCostUSD || "0",
      calls: stats[0]?.callCount || 0,
    },
    byModel: byModel.reduce<Record<string, { tokens: number; costUSD: string; calls: number }>>(
      (acc, stat) => {
        acc[stat.model] = {
          tokens: stat.totalTokens,
          costUSD: stat.totalCostUSD,
          calls: stat.callCount,
        };
        return acc;
      },
      {}
    ),
    byService: byService.reduce<Record<string, { tokens: number; costUSD: string; calls: number }>>(
      (acc, stat) => {
        acc[stat.service] = {
          tokens: stat.totalTokens,
          costUSD: stat.totalCostUSD,
          calls: stat.callCount,
        };
        return acc;
      },
      {}
    ),
    filters: {
      services: distinctServices.map((s) => s.service),
      models: distinctModels.map((m) => m.model),
      providers: distinctProviders.map((p) => p.provider),
    },
  };
}

export async function replayEvents(
  ctx: EventServiceContext,
  filters: ReplayFilters
): Promise<{ events: ReplayEventRecord[]; total: number }> {
  const conditions = [eq(eventsTable.organizationId, filters.organizationId)];

  if (filters.sinceSequence !== undefined) {
    conditions.push(gt(eventsTable.sequence, filters.sinceSequence));
  }
  if (filters.startDate) {
    conditions.push(gte(eventsTable.timestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(eventsTable.timestamp, new Date(filters.endDate)));
  }
  if (filters.clientId) {
    conditions.push(eq(eventsTable.clientId, filters.clientId));
  }
  if (filters.sessionId) {
    conditions.push(eq(eventsTable.sessionId, filters.sessionId));
  }
  if (filters.journeyId) {
    conditions.push(eq(eventsTable.journeyId, filters.journeyId));
  }

  if (filters.types && filters.types.length > 0) {
    const typeConditions = filters.types.map((type) => {
      if (type.endsWith(".*")) {
        const prefix = type.slice(0, -1);
        return like(eventsTable.type, `${prefix}%`);
      }
      return eq(eventsTable.type, type);
    });

    if (typeConditions.length === 1) {
      conditions.push(typeConditions[0]);
    } else {
      conditions.push(
        sql`(${sql.join(
          typeConditions.map((cond) => sql`${cond}`),
          sql` OR `
        )})`
      );
    }
  }

  const rows = await ctx.db
    .select()
    .from(eventsTable)
    .where(and(...conditions))
    .orderBy(filters.order === "asc" ? asc(eventsTable.sequence) : desc(eventsTable.sequence))
    .limit(filters.limit)
    .offset(filters.offset);

  const events: ReplayEventRecord[] = rows.map((row) => ({
    ...row,
    payload: asRecord(row.payload) ?? {},
    metadata: asRecord(row.metadata) ?? {},
  }));

  const countResult = await ctx.db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(...conditions));

  return { events, total: countResult[0]?.count || 0 };
}

export async function getLatestReplaySequence(ctx: EventServiceContext, organizationId: string): Promise<number> {
  const result = await ctx.db
    .select({ maxSequence: sql<number>`max(${eventsTable.sequence})` })
    .from(eventsTable)
    .where(eq(eventsTable.organizationId, organizationId));

  return result[0]?.maxSequence || 0;
}
