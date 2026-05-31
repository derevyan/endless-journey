/**
 * CRM Client Service
 *
 * Provides CRM-enhanced client data including stages, custom fields, and activity.
 *
 * @module modules/crm/services/client-service
 */

import { clients, crmClientFieldValues, crmClientStages, crmCustomFieldDefinitions, crmPipelineStages, journeySessions, journeys } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import type { ClientFilters, ClientStageInfo, CrmClient, CrmClientProfile } from "@journey/schemas";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getClientFieldValues } from "./field-service";
import { getClientStage } from "./stage-service";
import type { CrmServiceContext } from "./service-context";

const log = createLogger("crm-client-service");

interface PaginationOptions {
  limit?: number;
  offset?: number;
}

interface CrmClientsResult {
  clients: CrmClient[];
  total: number;
}

// =============================================================================
// CLIENT PROFILE
// =============================================================================

/**
 * Get full CRM profile for a client
 */
export async function getClientCrmProfile(
  ctx: CrmServiceContext,
  clientId: string
): Promise<CrmClientProfile | null> {
  const { db, organizationId, tagService } = ctx;
  try {
    // Get basic client info
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);

    if (!client) {
      return null;
    }

    // Get CRM data in parallel
    // Note: Using getClientTags (client-level tags only) instead of getAllTagsForUser
    // which includes session tags. CRM should only manage client-level tags.
    const [stage, customFields, clientTagRecords, sessionStats] = await Promise.all([
      getClientStage(ctx, clientId),
      getClientFieldValues(ctx, clientId),
      tagService.getClientTags(clientId),
      getClientSessionStats(ctx, clientId),
    ]);
    const tags = clientTagRecords.map((t) => t.tagName);

    const stageInfo: ClientStageInfo | null = stage
      ? {
          stageId: stage.stageId,
          stageName: stage.stageName,
          stageColor: stage.stageColor,
          assignedAt: stage.assignedAt,
          assignedBy: stage.assignedBy,
        }
      : null;

    return {
      id: client.id,
      platform: client.platform,
      platformUserId: client.platformUserId,
      firstName: client.firstName,
      lastName: client.lastName,
      username: client.username,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      stage: stageInfo,
      customFields,
      tags,
      totalSessions: sessionStats.totalSessions,
      lastActiveAt: sessionStats.lastActiveAt,
    };
  } catch (error) {
    log.error({ clientId, organizationId, err: serializeError(error) }, "crmClientService:getClientCrmProfile:error");
    throw error;
  }
}

/**
 * Get session stats for a client within an organization
 */
async function getClientSessionStats(
  ctx: CrmServiceContext,
  clientId: string
): Promise<{ totalSessions: number; lastActiveAt: Date | null }> {
  const { db, organizationId } = ctx;
  const result = await db
    .select({
      totalSessions: sql<number>`COUNT(*)::int`,
      lastActiveAt: sql<Date | null>`MAX(${journeySessions.updatedAt})`,
    })
    .from(journeySessions)
    .innerJoin(journeys, eq(journeys.id, journeySessions.journeyId))
    .where(and(eq(journeySessions.clientId, clientId), eq(journeys.organizationId, organizationId)));

  return {
    totalSessions: result[0]?.totalSessions || 0,
    lastActiveAt: result[0]?.lastActiveAt || null,
  };
}

// =============================================================================
// CLIENT LIST (PIPELINE VIEW)
// =============================================================================

/**
 * Get clients with CRM data for pipeline view
 */
export async function getCrmClients(
  ctx: CrmServiceContext,
  filters: ClientFilters = {},
  options: PaginationOptions = {}
): Promise<CrmClientsResult> {
  const { db, organizationId } = ctx;
  const { limit = 50, offset = 0 } = options;
  const { stageId, stageIds, pipelineId, journeyId, tags, search, noStage, dateFrom, dateTo } = filters;

  try {
    // Build base query - clients who have sessions in this org's journeys
    let baseConditions = sql`EXISTS (
      SELECT 1 FROM ${journeySessions}
      INNER JOIN ${journeys} ON ${journeys.id} = ${journeySessions.journeyId}
      WHERE ${journeySessions.clientId} = ${clients.id}
      AND ${journeys.organizationId} = ${organizationId}
    )`;

    // Filter by journey
    if (journeyId) {
      baseConditions = sql`EXISTS (
        SELECT 1 FROM ${journeySessions}
        WHERE ${journeySessions.clientId} = ${clients.id}
        AND ${journeySessions.journeyId} = ${journeyId}
      )`;
    }

    // Filter by search (name, username)
    let searchCondition = sql`TRUE`;
    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      searchCondition = sql`(
        LOWER(${clients.firstName}) LIKE ${searchLower}
        OR LOWER(${clients.lastName}) LIKE ${searchLower}
        OR LOWER(${clients.username}) LIKE ${searchLower}
        OR ${clients.id} LIKE ${searchLower}
      )`;
    }

    // Build stage/pipeline filter conditions (applied in SQL, not post-DB)
    let stageCondition = sql`TRUE`;

    // Handle noStage filter - clients without any stage assignment
    if (noStage) {
      stageCondition = sql`${crmClientStages.stageId} IS NULL`;
    }
    // Handle single stageId filter
    else if (stageId) {
      stageCondition = eq(crmClientStages.stageId, stageId);
    }
    // Handle stageIds array (multi-select from UI)
    else if (stageIds && stageIds.length > 0) {
      stageCondition = inArray(crmClientStages.stageId, stageIds);
    }
    // Handle pipelineId filter - only clients assigned to THIS pipeline
    else if (pipelineId) {
      // Pipeline-scoped view: only show clients with a crmClientStages entry for this pipeline
      // Clients without any assignment won't appear (correct behavior)
      stageCondition = eq(crmClientStages.pipelineId, pipelineId);
    }

    // Build date filter condition - filter by last activity date
    let dateCondition = sql`TRUE`;
    if (dateFrom || dateTo) {
      const lastActivitySubquery = sql`(
        SELECT MAX(js.updated_at) FROM journey_sessions js
        INNER JOIN journeys j ON j.id = js.journey_id
        WHERE js.client_id = ${clients.id}
        AND j.organization_id = ${organizationId}
      )`;

      if (dateFrom && dateTo) {
        // Both dates specified - filter within range
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // Include full end day
        dateCondition = sql`${lastActivitySubquery} >= ${fromDate.toISOString()} AND ${lastActivitySubquery} <= ${toDate.toISOString()}`;
      } else if (dateFrom) {
        // Only from date - filter >= dateFrom
        const fromDate = new Date(dateFrom);
        dateCondition = sql`${lastActivitySubquery} >= ${fromDate.toISOString()}`;
      } else if (dateTo) {
        // Only to date - filter <= dateTo
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // Include full end day
        dateCondition = sql`${lastActivitySubquery} <= ${toDate.toISOString()}`;
      }
    }

    // Define the lastActiveAt subquery once
    const lastActiveAtSql = sql<Date | null>`(
      SELECT MAX(js.updated_at) FROM journey_sessions js
      INNER JOIN journeys j ON j.id = js.journey_id
      WHERE js.client_id = ${clients.id}
      AND j.organization_id = ${organizationId}
    )`.as("last_active_at");

    const totalSessionsSql = sql<number>`(
      SELECT COUNT(*)::int FROM journey_sessions js
      INNER JOIN journeys j ON j.id = js.journey_id
      WHERE js.client_id = ${clients.id}
      AND j.organization_id = ${organizationId}
    )`.as("total_sessions");

    // Build full WHERE conditions
    const whereConditions = and(baseConditions, searchCondition, stageCondition, dateCondition);

    // Build JOIN condition for crmClientStages
    // When pipelineId is specified, scope the join to that pipeline only
    // This ensures we get the correct stage assignment for THIS pipeline
    const clientStageJoinCondition = pipelineId
      ? and(eq(crmClientStages.clientId, clients.id), eq(crmClientStages.organizationId, organizationId), eq(crmClientStages.pipelineId, pipelineId))
      : and(eq(crmClientStages.clientId, clients.id), eq(crmClientStages.organizationId, organizationId));

    // Get total count (with all filters applied)
    const totalResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${clients.id})::int` })
      .from(clients)
      .leftJoin(crmClientStages, clientStageJoinCondition)
      .leftJoin(crmPipelineStages, eq(crmPipelineStages.id, crmClientStages.stageId))
      .where(whereConditions);

    const total = totalResult[0]?.count || 0;

    // Get clients with stage info
    // Order by lastActiveAt descending (most recent first), nulls last
    const clientsList = await db
      .select({
        id: clients.id,
        platform: clients.platform,
        firstName: clients.firstName,
        lastName: clients.lastName,
        username: clients.username,
        stageId: crmClientStages.stageId,
        stageName: crmPipelineStages.name,
        stageColor: crmPipelineStages.color,
        lastActiveAt: lastActiveAtSql,
        totalSessions: totalSessionsSql,
      })
      .from(clients)
      .leftJoin(crmClientStages, clientStageJoinCondition)
      .leftJoin(crmPipelineStages, eq(crmPipelineStages.id, crmClientStages.stageId))
      .where(whereConditions)
      .orderBy(sql`last_active_at DESC NULLS LAST`)
      .limit(limit)
      .offset(offset);

    // Get tags for all clients in batch
    const clientIds = clientsList.map((c) => c.id);
    const tagsMap = await getTagsForClients(ctx, clientIds);

    // Filter by tags if specified (tags still require post-DB filter due to many-to-many)
    let filteredClients = clientsList;
    if (tags && tags.length > 0) {
      filteredClients = clientsList.filter((c) => {
        const clientTags = tagsMap.get(c.id) || [];
        return tags.some((tag) => clientTags.includes(tag));
      });
    }

    const result: CrmClient[] = filteredClients.map((c) => ({
      id: c.id,
      platform: c.platform,
      firstName: c.firstName,
      lastName: c.lastName,
      username: c.username,
      stageId: c.stageId,
      stageName: c.stageName,
      stageColor: c.stageColor,
      totalSessions: c.totalSessions,
      lastActiveAt: c.lastActiveAt,
      tags: tagsMap.get(c.id) || [],
    }));

    log.debug({ organizationId, filters, total, returned: result.length }, "crmClientService:getCrmClients");

    return { clients: result, total };
  } catch (error) {
    log.error({ organizationId, filters, err: serializeError(error) }, "crmClientService:getCrmClients:error");
    throw error;
  }
}

/**
 * Get tags for multiple clients efficiently
 */
async function getTagsForClients(
  ctx: CrmServiceContext,
  clientIds: string[]
): Promise<Map<string, string[]>> {
  if (clientIds.length === 0) {
    return new Map();
  }

  return ctx.tagService.getAllTagsForUsers(clientIds);
}

/**
 * Get clients grouped by stage for kanban view
 */
export async function getClientsByStages(
  ctx: CrmServiceContext,
  filters: ClientFilters = {}
): Promise<Map<string | null, CrmClient[]>> {
  const { organizationId } = ctx;
  try {
    const { clients: allClients } = await getCrmClients(ctx, filters, { limit: 500 });

    // Group by stageId
    const grouped = new Map<string | null, CrmClient[]>();

    for (const client of allClients) {
      const stageKey = client.stageId || null;
      const existing = grouped.get(stageKey) || [];
      existing.push(client);
      grouped.set(stageKey, existing);
    }

    return grouped;
  } catch (error) {
    log.error({ organizationId, filters, err: serializeError(error) }, "crmClientService:getClientsByStages:error");
    throw error;
  }
}
