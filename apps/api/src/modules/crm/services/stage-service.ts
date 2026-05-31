/**
 * CRM Stage Service
 *
 * CRUD operations for pipeline stages and client stage assignments.
 * Manages the CRM pipeline workflow.
 *
 * @module modules/crm/services/stage-service
 */

import { clients, crmClientStages, crmPipelines, crmPipelineStages, crmStageHistory } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, NotFoundError } from "@journey/schemas";
import type {
  ClientStageAssignment,
  CreateStageInput,
  CrmOperationEventContext,
  PipelineStage,
  PipelineStageWithCount,
  StageHistoryEntry,
  UpdateStageInput,
} from "@journey/schemas";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { assertIdsBelongToOrg, assertUniqueIds, getNextPosition, reorderByIds } from "./db-helpers";
import { ensureDefaultPipeline } from "./pipeline-service";
import type { CrmServiceContext } from "./service-context";

const log = createLogger("crm-stage-service");

// =============================================================================
// PIPELINE STAGES CRUD
// =============================================================================

/**
 * Get all pipeline stages for an organization, optionally filtered by pipeline
 */
export async function getPipelineStages(ctx: CrmServiceContext, pipelineId?: string): Promise<PipelineStageWithCount[]> {
  const { db, organizationId } = ctx;
  try {
    const conditions = [eq(crmPipelineStages.organizationId, organizationId)];
    if (pipelineId) {
      conditions.push(eq(crmPipelineStages.pipelineId, pipelineId));
    }

    const stages = await db
      .select({
        id: crmPipelineStages.id,
        pipelineId: crmPipelineStages.pipelineId,
        organizationId: crmPipelineStages.organizationId,
        name: crmPipelineStages.name,
        description: crmPipelineStages.description,
        color: crmPipelineStages.color,
        position: crmPipelineStages.position,
        isDefault: crmPipelineStages.isDefault,
        isSystem: crmPipelineStages.isSystem,
        createdAt: crmPipelineStages.createdAt,
        updatedAt: crmPipelineStages.updatedAt,
        clientCount: sql<number>`COALESCE(
          (SELECT COUNT(*) FROM crm_client_stages WHERE stage_id = ${crmPipelineStages.id})::int,
          0
        )`,
      })
      .from(crmPipelineStages)
      .where(and(...conditions))
      .orderBy(asc(crmPipelineStages.position));

    log.debug({ organizationId, pipelineId, count: stages.length }, "crmStageService:getPipelineStages");
    return stages as PipelineStageWithCount[];
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "crmStageService:getPipelineStages:error");
    throw error;
  }
}

/**
 * Get a single pipeline stage by ID
 */
export async function getPipelineStageById(ctx: CrmServiceContext, stageId: string): Promise<PipelineStage | null> {
  const { db, organizationId } = ctx;
  try {
    const [stage] = await db
      .select()
      .from(crmPipelineStages)
      .where(and(eq(crmPipelineStages.id, stageId), eq(crmPipelineStages.organizationId, organizationId)))
      .limit(1);

    return stage || null;
  } catch (error) {
    log.error({ stageId, organizationId, err: serializeError(error) }, "crmStageService:getPipelineStageById:error");
    throw error;
  }
}

/**
 * Create a new pipeline stage
 */
export async function createPipelineStage(
  ctx: CrmServiceContext,
  data: CreateStageInput,
  performedBy?: string
): Promise<PipelineStage> {
  const { db, organizationId, publisher } = ctx;
  try {
    const nextPosition = await getNextPosition(
      db,
      crmPipelineStages,
      crmPipelineStages.position,
      and(
        eq(crmPipelineStages.pipelineId, data.pipelineId),
        eq(crmPipelineStages.organizationId, organizationId)
      )
    );

    // If this is the first stage or isDefault is true, handle default logic
    if (data.isDefault) {
      // Remove default from other stages in this pipeline
      await db.update(crmPipelineStages).set({ isDefault: false, updatedAt: new Date() }).where(eq(crmPipelineStages.pipelineId, data.pipelineId));
    }

    const [stage] = await db
      .insert(crmPipelineStages)
      .values({
        pipelineId: data.pipelineId,
        organizationId,
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        position: nextPosition,
        isDefault: data.isDefault || nextPosition === 0, // First stage is default
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Publish CRM event for stage created
    if (performedBy) {
      await publisher.crm.stageCreated(
        { organizationId, performedBy },
        { stageId: stage.id, stageName: stage.name, pipelineId: data.pipelineId }
      );
    }

    log.info({ organizationId, stageId: stage.id, name: data.name }, "crmStageService:createPipelineStage");
    return stage;
  } catch (error) {
    log.error({ organizationId, data, err: serializeError(error) }, "crmStageService:createPipelineStage:error");
    throw error;
  }
}

/**
 * Update a pipeline stage
 */
export async function updatePipelineStage(
  ctx: CrmServiceContext,
  stageId: string,
  data: UpdateStageInput,
  performedBy?: string
): Promise<PipelineStage | null> {
  const { db, organizationId, publisher } = ctx;
  try {
    // Get the stage to find its pipelineId
    const [currentStage] = await db
      .select({ pipelineId: crmPipelineStages.pipelineId })
      .from(crmPipelineStages)
      .where(and(eq(crmPipelineStages.id, stageId), eq(crmPipelineStages.organizationId, organizationId)))
      .limit(1);

    if (!currentStage) {
      return null;
    }

    // If setting as default, handle default logic
    if (data.isDefault) {
      // Remove default from other stages in the SAME pipeline
      await db
        .update(crmPipelineStages)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(crmPipelineStages.pipelineId, currentStage.pipelineId), sql`${crmPipelineStages.id} != ${stageId}`));
    }

    const [stage] = await db
      .update(crmPipelineStages)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        updatedAt: new Date(),
      })
      .where(and(eq(crmPipelineStages.id, stageId), eq(crmPipelineStages.organizationId, organizationId)))
      .returning();

    if (stage) {
      // Publish CRM event for stage updated
      if (performedBy) {
        await publisher.crm.stageUpdated(
          { organizationId, performedBy },
          { stageId, changes: data as Record<string, unknown>, pipelineId: currentStage.pipelineId }
        );
      }

      log.info({ stageId, organizationId }, "crmStageService:updatePipelineStage");
    }
    return stage || null;
  } catch (error) {
    log.error({ stageId, organizationId, data, err: serializeError(error) }, "crmStageService:updatePipelineStage:error");
    throw error;
  }
}

/**
 * Delete a pipeline stage (with system stage protection)
 */
export async function deletePipelineStage(
  ctx: CrmServiceContext,
  stageId: string,
  performedBy?: string
): Promise<boolean> {
  const { db, organizationId, publisher } = ctx;
  try {
    // First, check if this is a system stage and get stage info
    const [stage] = await db
      .select({
        isSystem: crmPipelineStages.isSystem,
        name: crmPipelineStages.name,
        pipelineId: crmPipelineStages.pipelineId,
      })
      .from(crmPipelineStages)
      .where(and(eq(crmPipelineStages.id, stageId), eq(crmPipelineStages.organizationId, organizationId)))
      .limit(1);

    if (!stage) {
      return false;
    }

    // Prevent deletion of system stages
    if (stage.isSystem) {
      throw new BadRequestError(`Cannot delete system stage "${stage.name}". System stages are protected.`);
    }

    // Get client count in this stage
    const [clientCountResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(crmClientStages)
      .where(eq(crmClientStages.stageId, stageId));

    const clientCount = clientCountResult?.count ?? 0;

    const result = await db
      .delete(crmPipelineStages)
      .where(and(eq(crmPipelineStages.id, stageId), eq(crmPipelineStages.organizationId, organizationId)))
      .returning({ id: crmPipelineStages.id });

    const deleted = result.length > 0;
    if (deleted) {
      // Publish CRM event for stage deleted
      if (performedBy) {
        await publisher.crm.stageDeleted(
          { organizationId, performedBy },
          { stageId, stageName: stage.name, pipelineId: stage.pipelineId, clientCount }
        );
      }

      log.info({ stageId, organizationId }, "crmStageService:deletePipelineStage");
    }
    return deleted;
  } catch (error) {
    log.error({ stageId, organizationId, err: serializeError(error) }, "crmStageService:deletePipelineStage:error");
    throw error;
  }
}

/**
 * Reorder pipeline stages (pipeline-scoped)
 */
export async function reorderPipelineStages(
  ctx: CrmServiceContext,
  pipelineId: string,
  stageIds: string[],
  performedBy?: string
): Promise<void> {
  const { db, organizationId, publisher } = ctx;
  try {
    const uniqueIds = assertUniqueIds(stageIds, "Stage");
    await assertIdsBelongToOrg(
      db,
      crmPipelineStages,
      crmPipelineStages.id,
      crmPipelineStages.organizationId,
      uniqueIds,
      organizationId,
      "Stage",
      eq(crmPipelineStages.pipelineId, pipelineId)
    );

    await reorderByIds(uniqueIds, async (id, position) => {
      await db
        .update(crmPipelineStages)
        .set({ position, updatedAt: new Date() })
        .where(
          and(
            eq(crmPipelineStages.id, id),
            eq(crmPipelineStages.pipelineId, pipelineId),
            eq(crmPipelineStages.organizationId, organizationId)
          )
        );
    });

    // Publish CRM event for stages reordered
    if (performedBy) {
      await publisher.crm.stagesReordered({ organizationId, performedBy }, { pipelineId, stageIds: uniqueIds });
    }

    log.info({ organizationId, pipelineId, stageCount: uniqueIds.length }, "crmStageService:reorderPipelineStages");
  } catch (error) {
    log.error({ organizationId, pipelineId, stageIds, err: serializeError(error) }, "crmStageService:reorderPipelineStages:error");
    throw error;
  }
}

// =============================================================================
// CLIENT STAGE ASSIGNMENTS
// =============================================================================

/**
 * Get client's current stage assignment in a specific pipeline
 */
export async function getClientStage(
  ctx: CrmServiceContext,
  clientId: string,
  pipelineId?: string
): Promise<ClientStageAssignment | null> {
  const { db, organizationId } = ctx;
  try {
    const conditions = [eq(crmClientStages.clientId, clientId), eq(crmClientStages.organizationId, organizationId)];

    if (pipelineId) {
      conditions.push(eq(crmClientStages.pipelineId, pipelineId));
    }

    const [assignment] = await db
      .select({
        id: crmClientStages.id,
        clientId: crmClientStages.clientId,
        organizationId: crmClientStages.organizationId,
        pipelineId: crmClientStages.pipelineId,
        pipelineName: crmPipelines.name,
        pipelineColor: crmPipelines.color,
        stageId: crmClientStages.stageId,
        stageName: crmPipelineStages.name,
        stageColor: crmPipelineStages.color,
        assignedBy: crmClientStages.assignedBy,
        assignedAt: crmClientStages.assignedAt,
        notes: crmClientStages.notes,
      })
      .from(crmClientStages)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmClientStages.stageId))
      .innerJoin(crmPipelines, eq(crmPipelines.id, crmClientStages.pipelineId))
      .where(and(...conditions))
      .limit(1);

    return assignment || null;
  } catch (error) {
    log.error({ clientId, organizationId, pipelineId, err: serializeError(error) }, "crmStageService:getClientStage:error");
    throw error;
  }
}

/**
 * Get ALL stage assignments for a client across all pipelines
 * Returns an array of stages, one per pipeline the client is in
 */
export async function getClientStages(ctx: CrmServiceContext, clientId: string): Promise<ClientStageAssignment[]> {
  const { db, organizationId } = ctx;
  try {
    const assignments = await db
      .select({
        id: crmClientStages.id,
        clientId: crmClientStages.clientId,
        organizationId: crmClientStages.organizationId,
        pipelineId: crmClientStages.pipelineId,
        pipelineName: crmPipelines.name,
        pipelineColor: crmPipelines.color,
        stageId: crmClientStages.stageId,
        stageName: crmPipelineStages.name,
        stageColor: crmPipelineStages.color,
        assignedBy: crmClientStages.assignedBy,
        assignedAt: crmClientStages.assignedAt,
        notes: crmClientStages.notes,
      })
      .from(crmClientStages)
      .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmClientStages.stageId))
      .innerJoin(crmPipelines, eq(crmPipelines.id, crmClientStages.pipelineId))
      .where(and(eq(crmClientStages.clientId, clientId), eq(crmClientStages.organizationId, organizationId)))
      .orderBy(asc(crmPipelines.position));

    log.debug({ clientId, organizationId, stageCount: assignments.length }, "crmStageService:getClientStages");
    return assignments;
  } catch (error) {
    log.error({ clientId, organizationId, err: serializeError(error) }, "crmStageService:getClientStages:error");
    throw error;
  }
}

/**
 * Assign a client to a stage in a pipeline
 * A client can be in multiple pipelines, each with its own stage
 *
 * @param clientId - The client ID to assign
 * @param organizationId - The organization ID
 * @param stageId - The target stage ID
 * @param assignedBy - User ID who triggered the action (null for system)
 * @param notes - Optional notes for the assignment
 * @param ctx - Optional context for event publishing (triggeredBy, sessionId, journeyId)
 */
export async function assignClientToStage(
  ctx: CrmServiceContext,
  clientId: string,
  stageId: string,
  assignedBy: string | null,
  notes?: string,
  operationContext: CrmOperationEventContext = { triggeredBy: "manual" }
): Promise<void> {
  const { db, organizationId, publisher } = ctx;
  try {
    // Verify client exists
    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);

    if (!client) {
      throw new NotFoundError("Client", clientId);
    }

    // Verify stage exists and get its pipeline info
    const [stage] = await db
      .select({
        id: crmPipelineStages.id,
        name: crmPipelineStages.name,
        pipelineId: crmPipelineStages.pipelineId,
        pipelineName: crmPipelines.name,
      })
      .from(crmPipelineStages)
      .innerJoin(crmPipelines, eq(crmPipelines.id, crmPipelineStages.pipelineId))
      .where(and(eq(crmPipelineStages.id, stageId), eq(crmPipelineStages.organizationId, organizationId)))
      .limit(1);

    if (!stage) {
      throw new NotFoundError("Stage", stageId);
    }

    const pipelineId = stage.pipelineId;

    // Get current stage in THIS PIPELINE for history
    const currentStage = await getClientStage(ctx, clientId, pipelineId);
    const previousAssignedAt = currentStage?.assignedAt;

    // Calculate duration in previous stage (in milliseconds)
    let durationMs: number | null = null;
    if (previousAssignedAt) {
      durationMs = Date.now() - previousAssignedAt.getTime();
    }

    // Insert or update client stage assignment (unique per client + pipeline)
    await db
      .insert(crmClientStages)
      .values({
        clientId,
        organizationId,
        pipelineId,
        stageId,
        assignedBy,
        assignedAt: new Date(),
        notes: notes || null,
      })
      .onConflictDoUpdate({
        target: [crmClientStages.clientId, crmClientStages.pipelineId],
        set: {
          stageId,
          assignedBy,
          assignedAt: new Date(),
          notes: notes || null,
        },
      });

    // Record in stage history
    await db.insert(crmStageHistory).values({
      clientId,
      organizationId,
      pipelineId,
      fromStageId: currentStage?.stageId || null,
      toStageId: stageId,
      changedBy: assignedBy,
      changedAt: new Date(),
      notes: notes || null,
      durationMs,
    });

    // Publish CRM event - stored in events table, queried via /api/events/crm
    const eventContext = {
      organizationId,
      clientId,
      sessionId: operationContext.sessionId,
      journeyId: operationContext.journeyId,
      performedBy: assignedBy || "system",
      triggeredBy: operationContext.triggeredBy ?? "manual",
    };

    const isNewAssignment = !currentStage;

    if (isNewAssignment) {
      // Client entering pipeline for first time
      await publisher.crm.pipelineEntered(eventContext, {
        pipelineId,
        pipelineName: stage.pipelineName,
        stageId: stage.id,
        stageName: stage.name,
      });
    } else {
      // Client moving between stages
      await publisher.crm.stageChanged(eventContext, {
        pipelineId,
        pipelineName: stage.pipelineName,
        fromStageId: currentStage.stageId,
        fromStageName: currentStage.stageName,
        toStageId: stage.id,
        toStageName: stage.name,
        durationMs: durationMs,
        notes: notes ?? null,
      });
    }

    log.info({ clientId, organizationId, fromStageId: currentStage?.stageId, toStageId: stageId }, "crmStageService:assignClientToStage");
  } catch (error) {
    log.error({ clientId, organizationId, stageId, err: serializeError(error) }, "crmStageService:assignClientToStage:error");
    throw error;
  }
}

/**
 * Get stage history for a client (optionally filtered by pipeline)
 */
export async function getClientStageHistory(
  ctx: CrmServiceContext,
  clientId: string,
  pipelineId?: string
): Promise<StageHistoryEntry[]> {
  const { db, organizationId } = ctx;
  try {
    const conditions = [eq(crmStageHistory.clientId, clientId), eq(crmStageHistory.organizationId, organizationId)];

    if (pipelineId) {
      conditions.push(eq(crmStageHistory.pipelineId, pipelineId));
    }

    const history = await db
      .select({
        id: crmStageHistory.id,
        clientId: crmStageHistory.clientId,
        pipelineId: crmStageHistory.pipelineId,
        fromStageId: crmStageHistory.fromStageId,
        toStageId: crmStageHistory.toStageId,
        changedBy: crmStageHistory.changedBy,
        changedAt: crmStageHistory.changedAt,
        notes: crmStageHistory.notes,
        durationMs: crmStageHistory.durationMs,
      })
      .from(crmStageHistory)
      .where(and(...conditions))
      .orderBy(desc(crmStageHistory.changedAt));

    // Fetch stage names and pipeline names
    const stageIds = new Set<string>();
    const pipelineIds = new Set<string>();
    for (const h of history) {
      if (h.fromStageId) stageIds.add(h.fromStageId);
      stageIds.add(h.toStageId);
      if (h.pipelineId) pipelineIds.add(h.pipelineId);
    }

    const stageNames = new Map<string, string>();
    const pipelineNames = new Map<string, string>();

    if (stageIds.size > 0) {
      const stages = await db
        .select({ id: crmPipelineStages.id, name: crmPipelineStages.name })
        .from(crmPipelineStages)
        .where(eq(crmPipelineStages.organizationId, organizationId));

      for (const s of stages) {
        stageNames.set(s.id, s.name);
      }
    }

    if (pipelineIds.size > 0) {
      const pipelines = await db
        .select({ id: crmPipelines.id, name: crmPipelines.name })
        .from(crmPipelines)
        .where(eq(crmPipelines.organizationId, organizationId));

      for (const p of pipelines) {
        pipelineNames.set(p.id, p.name);
      }
    }

    return history.map((h) => ({
      ...h,
      pipelineName: h.pipelineId ? pipelineNames.get(h.pipelineId) || null : null,
      fromStageName: h.fromStageId ? stageNames.get(h.fromStageId) || null : null,
      toStageName: stageNames.get(h.toStageId) || "",
    }));
  } catch (error) {
    log.error({ clientId, organizationId, pipelineId, err: serializeError(error) }, "crmStageService:getClientStageHistory:error");
    throw error;
  }
}

/**
 * Get all clients in a specific stage
 */
export async function getClientsByStage(
  ctx: CrmServiceContext,
  stageId: string,
  limit = 50,
  offset = 0
): Promise<{ clientId: string; assignedAt: Date | null }[]> {
  const { db, organizationId } = ctx;
  try {
    const results = await db
      .select({
        clientId: crmClientStages.clientId,
        assignedAt: crmClientStages.assignedAt,
      })
      .from(crmClientStages)
      .where(and(eq(crmClientStages.organizationId, organizationId), eq(crmClientStages.stageId, stageId)))
      .orderBy(desc(crmClientStages.assignedAt))
      .limit(limit)
      .offset(offset);

    return results;
  } catch (error) {
    log.error({ organizationId, stageId, err: serializeError(error) }, "crmStageService:getClientsByStage:error");
    throw error;
  }
}

/**
 * Get default stage for organization, optionally filtered by pipeline
 */
export async function getDefaultStage(ctx: CrmServiceContext, pipelineId?: string): Promise<PipelineStage | null> {
  const { db, organizationId } = ctx;
  try {
    const conditions = [eq(crmPipelineStages.organizationId, organizationId), eq(crmPipelineStages.isDefault, true)];

    if (pipelineId) {
      conditions.push(eq(crmPipelineStages.pipelineId, pipelineId));
    }

    const [stage] = await db
      .select()
      .from(crmPipelineStages)
      .where(and(...conditions))
      .limit(1);

    return stage || null;
  } catch (error) {
    log.error({ organizationId, pipelineId, err: serializeError(error) }, "crmStageService:getDefaultStage:error");
    throw error;
  }
}

// =============================================================================
// AUTO-ASSIGNMENT HELPERS
// =============================================================================

/**
 * Auto-assign a client to the default pipeline's "Unassigned" stage
 * Used when a new client first interacts with the system
 * Does nothing if client already has a stage in the default pipeline
 * Creates the default pipeline if it doesn't exist (lazy initialization)
 */
export async function assignClientToDefaultPipeline(ctx: CrmServiceContext, clientId: string): Promise<void> {
  const { organizationId } = ctx;
  try {
    // Ensure default pipeline exists (creates if missing)
    const defaultPipeline = await ensureDefaultPipeline(ctx);

    // Check if client already has a stage in the default pipeline
    const existingStage = await getClientStage(ctx, clientId, defaultPipeline.id);
    if (existingStage) {
      log.debug({ clientId, organizationId, existingStageId: existingStage.stageId }, "crmStageService:assignClientToDefaultPipeline:alreadyHasStage");
      return;
    }

    // Get the default (Unassigned) stage for this pipeline
    const defaultStage = await getDefaultStage(ctx, defaultPipeline.id);
    if (!defaultStage) {
      log.warn({ organizationId, pipelineId: defaultPipeline.id }, "crmStageService:assignClientToDefaultPipeline:noDefaultStage");
      return;
    }

    // Assign client to the default stage (null assignedBy for system assignment)
    await assignClientToStage(ctx, clientId, defaultStage.id, null, "Auto-assigned on first interaction");

    log.info({ clientId, organizationId, pipelineId: defaultPipeline.id, stageId: defaultStage.id }, "crmStageService:assignClientToDefaultPipeline:success");
  } catch (error) {
    // Non-blocking - don't fail the main operation if CRM assignment fails
    log.error({ clientId, organizationId, err: serializeError(error) }, "crmStageService:assignClientToDefaultPipeline:error");
  }
}

/**
 * Remove a client from a pipeline
 * Deletes the client stage assignment and logs the removal
 *
 * @param clientId - The client ID to remove
 * @param organizationId - The organization ID
 * @param pipelineId - The pipeline to remove from
 * @param removedBy - User ID who triggered the action (null for system)
 * @param ctx - Optional context for event publishing (triggeredBy, sessionId, journeyId)
 */
export async function removeClientFromPipeline(
  ctx: CrmServiceContext,
  clientId: string,
  pipelineId: string,
  removedBy?: string | null,
  operationContext: CrmOperationEventContext = { triggeredBy: "manual" }
): Promise<boolean> {
  const { db, organizationId, publisher } = ctx;
  try {
    // Get current stage for history logging
    const currentStage = await getClientStage(ctx, clientId, pipelineId);
    if (!currentStage) {
      log.debug({ clientId, organizationId, pipelineId }, "crmStageService:removeClientFromPipeline:notInPipeline");
      return false;
    }

    // Calculate duration in current stage (in milliseconds)
    let durationMs: number | null = null;
    if (currentStage.assignedAt) {
      durationMs = Date.now() - currentStage.assignedAt.getTime();
    }

    // Delete the client stage assignment
    const result = await db
      .delete(crmClientStages)
      .where(and(eq(crmClientStages.clientId, clientId), eq(crmClientStages.pipelineId, pipelineId), eq(crmClientStages.organizationId, organizationId)))
      .returning({ clientId: crmClientStages.clientId });

    if (result.length === 0) {
      return false;
    }

    // Record removal in stage history (toStageId is null for removal)
    await db.insert(crmStageHistory).values({
      clientId,
      organizationId,
      pipelineId,
      fromStageId: currentStage.stageId,
      toStageId: currentStage.stageId, // Use same stage as we're removing, not transitioning
      changedBy: removedBy || null,
      changedAt: new Date(),
      notes: "Removed from pipeline",
      durationMs,
    });

    // Publish CRM event - stored in events table, queried via /api/events/crm
    await publisher.crm.pipelineExited(
      {
        organizationId,
        clientId,
        sessionId: operationContext.sessionId,
        journeyId: operationContext.journeyId,
        performedBy: removedBy || "system",
        triggeredBy: operationContext.triggeredBy ?? "manual",
      },
      {
        pipelineId,
        pipelineName: currentStage.pipelineName,
        lastStageId: currentStage.stageId,
        lastStageName: currentStage.stageName,
      }
    );

    log.info({ clientId, organizationId, pipelineId, fromStageId: currentStage.stageId }, "crmStageService:removeClientFromPipeline:success");
    return true;
  } catch (error) {
    log.error({ clientId, organizationId, pipelineId, err: serializeError(error) }, "crmStageService:removeClientFromPipeline:error");
    throw error;
  }
}

/**
 * Assign a client to a specific pipeline's default stage
 * Used when client enters a journey that's linked to a specific pipeline
 */
export async function assignClientToPipeline(
  ctx: CrmServiceContext,
  clientId: string,
  pipelineId: string,
  notes?: string
): Promise<void> {
  const { organizationId } = ctx;
  try {
    // Check if client already has a stage in this pipeline
    const existingStage = await getClientStage(ctx, clientId, pipelineId);
    if (existingStage) {
      log.debug({ clientId, organizationId, pipelineId, existingStageId: existingStage.stageId }, "crmStageService:assignClientToPipeline:alreadyHasStage");
      return;
    }

    // Get the default stage for this pipeline
    const defaultStage = await getDefaultStage(ctx, pipelineId);
    if (!defaultStage) {
      log.warn({ organizationId, pipelineId }, "crmStageService:assignClientToPipeline:noDefaultStage");
      return;
    }

    // Assign client to the default stage
    await assignClientToStage(ctx, clientId, defaultStage.id, null, notes || "Auto-assigned from journey");

    log.info({ clientId, organizationId, pipelineId, stageId: defaultStage.id }, "crmStageService:assignClientToPipeline:success");
  } catch (error) {
    log.error({ clientId, organizationId, pipelineId, err: serializeError(error) }, "crmStageService:assignClientToPipeline:error");
    throw error;
  }
}
