/**
 * CRM Pipeline Service
 *
 * CRUD operations for CRM pipelines. Organizations can have multiple pipelines
 * (Sales, Support, etc.), each with their own set of stages.
 *
 * @module modules/crm/services/pipeline-service
 */

import { crmPipelines, crmPipelineStages, crmClientStages } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, NotFoundError, generateSlug } from "@journey/schemas";
import type {
  CreatePipelineInput,
  Pipeline,
  PipelineWithStageCount,
  UpdatePipelineInput,
} from "@journey/schemas";
import { and, eq, asc, sql } from "drizzle-orm";

import { assertIdsBelongToOrg, assertUniqueIds, getNextPosition, reorderByIds } from "./db-helpers";
import type { CrmServiceContext } from "./service-context";

const log = createLogger("crm-pipeline-service");

// Default pipeline configuration
const DEFAULT_PIPELINE_STAGES = [
  { name: "Unassigned", color: "#94a3b8", position: 0, isDefault: true, isSystem: true },
  { name: "Lead", color: "#60a5fa", position: 1, isDefault: false, isSystem: false },
  { name: "Qualified", color: "#34d399", position: 2, isDefault: false, isSystem: false },
  { name: "Proposal", color: "#fbbf24", position: 3, isDefault: false, isSystem: false },
  { name: "Negotiation", color: "#fb923c", position: 4, isDefault: false, isSystem: false },
  { name: "Closed Won", color: "#22c55e", position: 5, isDefault: false, isSystem: false },
  { name: "Closed Lost", color: "#ef4444", position: 6, isDefault: false, isSystem: false },
];

// =============================================================================
// PIPELINE CRUD
// =============================================================================

/**
 * Create default pipeline for a new organization
 */
export async function createDefaultPipeline(ctx: CrmServiceContext): Promise<Pipeline> {
  const { db, organizationId } = ctx;
  try {
    log.info({ organizationId }, "crmPipelineService:createDefaultPipeline:start");

    // Create default pipeline
    const pipelineName = "Sales Pipeline";
    const [pipeline] = await db
      .insert(crmPipelines)
      .values({
        organizationId,
        name: pipelineName,
        slug: generateSlug(pipelineName),
        description: "Default sales pipeline",
        position: 0,
        isDefault: true,
        isActive: true,
        color: "#6366f1", // indigo-500
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.info({ organizationId, pipelineId: pipeline.id }, "crmPipelineService:createDefaultPipeline:pipelineCreated");

    // Create default stages for this pipeline
    await db.insert(crmPipelineStages).values(
      DEFAULT_PIPELINE_STAGES.map((stage) => ({
        pipelineId: pipeline.id,
        organizationId,
        ...stage,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );

    log.info(
      { organizationId, pipelineId: pipeline.id, stageCount: DEFAULT_PIPELINE_STAGES.length },
      "crmPipelineService:createDefaultPipeline:success"
    );

    return pipeline as Pipeline;
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "crmPipelineService:createDefaultPipeline:error");
    throw error;
  }
}

/**
 * Get all pipelines for an organization
 */
export async function getPipelines(ctx: CrmServiceContext): Promise<PipelineWithStageCount[]> {
  const { db, organizationId } = ctx;
  try {
    log.debug({ organizationId }, "crmPipelineService:getPipelines:start");

    // Get pipelines with counts
    const result = await db
      .select({
        id: crmPipelines.id,
        organizationId: crmPipelines.organizationId,
        name: crmPipelines.name,
        slug: crmPipelines.slug,
        description: crmPipelines.description,
        position: crmPipelines.position,
        isDefault: crmPipelines.isDefault,
        isActive: crmPipelines.isActive,
        color: crmPipelines.color,
        createdAt: crmPipelines.createdAt,
        updatedAt: crmPipelines.updatedAt,
        stageCount: sql<number>`COUNT(DISTINCT ${crmPipelineStages.id})::int`,
        clientCount: sql<number>`COUNT(DISTINCT ${crmClientStages.clientId})::int`,
      })
      .from(crmPipelines)
      .leftJoin(crmPipelineStages, eq(crmPipelineStages.pipelineId, crmPipelines.id))
      .leftJoin(crmClientStages, eq(crmClientStages.stageId, crmPipelineStages.id))
      .where(eq(crmPipelines.organizationId, organizationId))
      .groupBy(crmPipelines.id)
      .orderBy(asc(crmPipelines.position));

    log.debug({ organizationId, count: result.length }, "crmPipelineService:getPipelines:success");
    return result as PipelineWithStageCount[];
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "crmPipelineService:getPipelines:error");
    throw error;
  }
}

/**
 * Get a single pipeline by ID
 */
export async function getPipeline(ctx: CrmServiceContext, pipelineId: string): Promise<Pipeline | null> {
  const { db, organizationId } = ctx;
  try {
    log.debug({ pipelineId, organizationId }, "crmPipelineService:getPipeline:start");

    const [pipeline] = await db
      .select()
      .from(crmPipelines)
      .where(and(eq(crmPipelines.id, pipelineId), eq(crmPipelines.organizationId, organizationId)))
      .limit(1);

    if (!pipeline) {
      log.warn({ pipelineId, organizationId }, "crmPipelineService:getPipeline:notFound");
      return null;
    }

    log.debug({ pipelineId }, "crmPipelineService:getPipeline:success");
    return pipeline as Pipeline;
  } catch (error) {
    log.error({ pipelineId, organizationId, err: serializeError(error) }, "crmPipelineService:getPipeline:error");
    throw error;
  }
}

/**
 * Get a single pipeline by slug
 */
export async function getPipelineBySlug(ctx: CrmServiceContext, slug: string): Promise<Pipeline | null> {
  const { db, organizationId } = ctx;
  try {
    log.debug({ slug, organizationId }, "crmPipelineService:getPipelineBySlug:start");

    const [pipeline] = await db
      .select()
      .from(crmPipelines)
      .where(and(eq(crmPipelines.slug, slug), eq(crmPipelines.organizationId, organizationId)))
      .limit(1);

    if (!pipeline) {
      log.warn({ slug, organizationId }, "crmPipelineService:getPipelineBySlug:notFound");
      return null;
    }

    log.debug({ slug, pipelineId: pipeline.id }, "crmPipelineService:getPipelineBySlug:success");
    return pipeline as Pipeline;
  } catch (error) {
    log.error({ slug, organizationId, err: serializeError(error) }, "crmPipelineService:getPipelineBySlug:error");
    throw error;
  }
}

/**
 * Get default pipeline for an organization
 */
export async function getDefaultPipeline(ctx: CrmServiceContext): Promise<Pipeline | null> {
  const { db, organizationId } = ctx;
  try {
    log.debug({ organizationId }, "crmPipelineService:getDefaultPipeline:start");

    const [pipeline] = await db
      .select()
      .from(crmPipelines)
      .where(and(eq(crmPipelines.organizationId, organizationId), eq(crmPipelines.isDefault, true)))
      .limit(1);

    if (!pipeline) {
      log.debug({ organizationId }, "crmPipelineService:getDefaultPipeline:notFound");
      return null;
    }

    log.debug({ organizationId, pipelineId: pipeline.id }, "crmPipelineService:getDefaultPipeline:success");
    return pipeline as Pipeline;
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "crmPipelineService:getDefaultPipeline:error");
    throw error;
  }
}

/**
 * Ensure a default pipeline exists for an organization
 * Creates one if missing (lazy initialization pattern)
 * This is idempotent - safe to call multiple times
 */
export async function ensureDefaultPipeline(ctx: CrmServiceContext): Promise<Pipeline> {
  const { organizationId } = ctx;
  try {
    // Check if default pipeline already exists
    const existing = await getDefaultPipeline(ctx);
    if (existing) {
      return existing;
    }

    // Create default pipeline if missing
    log.info({ organizationId }, "crmPipelineService:ensureDefaultPipeline:creating");
    return await createDefaultPipeline(ctx);
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "crmPipelineService:ensureDefaultPipeline:error");
    throw error;
  }
}

/**
 * Create a new pipeline
 */
export async function createPipeline(
  ctx: CrmServiceContext,
  input: CreatePipelineInput,
  performedBy?: string
): Promise<Pipeline> {
  const { db, organizationId, publisher } = ctx;
  try {
    log.info({ organizationId, name: input.name }, "crmPipelineService:createPipeline:start");

    const nextPosition = await getNextPosition(
      db,
      crmPipelines,
      crmPipelines.position,
      eq(crmPipelines.organizationId, organizationId)
    );

    const slug = generateSlug(input.name);

    // Create pipeline
    const [pipeline] = await db
      .insert(crmPipelines)
      .values({
        organizationId,
        name: input.name,
        slug,
        description: input.description || null,
        color: input.color || null,
        position: nextPosition,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create the default Unassigned system stage (cannot be deleted)
    await db.insert(crmPipelineStages).values({
      pipelineId: pipeline.id,
      organizationId,
      name: "Unassigned",
      description: "Clients without a specific stage",
      color: "#94a3b8",
      position: 0,
      isDefault: true,
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Publish CRM event for pipeline created
    if (performedBy) {
      await publisher.crm.pipelineCreated(
        { organizationId, performedBy },
        { pipelineId: pipeline.id, pipelineName: pipeline.name, slug }
      );
    }

    log.info({ organizationId, pipelineId: pipeline.id, name: input.name }, "crmPipelineService:createPipeline:success");
    return pipeline as Pipeline;
  } catch (error) {
    log.error({ organizationId, name: input.name, err: serializeError(error) }, "crmPipelineService:createPipeline:error");
    throw error;
  }
}

/**
 * Update a pipeline
 */
export async function updatePipeline(
  ctx: CrmServiceContext,
  pipelineId: string,
  input: UpdatePipelineInput,
  performedBy?: string
): Promise<Pipeline> {
  const { db, organizationId, publisher } = ctx;
  try {
    log.info({ pipelineId, organizationId }, "crmPipelineService:updatePipeline:start");

    const [pipeline] = await db
      .update(crmPipelines)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(crmPipelines.id, pipelineId), eq(crmPipelines.organizationId, organizationId)))
      .returning();

    if (!pipeline) {
      throw new NotFoundError("Pipeline", pipelineId);
    }

    // Publish CRM event for pipeline updated
    if (performedBy) {
      await publisher.crm.pipelineUpdated(
        { organizationId, performedBy },
        { pipelineId, changes: input as Record<string, unknown> }
      );
    }

    log.info({ pipelineId, organizationId }, "crmPipelineService:updatePipeline:success");
    return pipeline as Pipeline;
  } catch (error) {
    log.error({ pipelineId, organizationId, err: serializeError(error) }, "crmPipelineService:updatePipeline:error");
    throw error;
  }
}

/**
 * Delete a pipeline with safety checks
 */
export async function deletePipeline(
  ctx: CrmServiceContext,
  pipelineId: string,
  performedBy?: string
): Promise<boolean> {
  const { db, organizationId, publisher } = ctx;
  try {
    log.info({ pipelineId, organizationId }, "crmPipelineService:deletePipeline:start");

    // Get the pipeline
    const pipeline = await getPipeline(ctx, pipelineId);
    if (!pipeline) {
      throw new NotFoundError("Pipeline", pipelineId);
    }

    // Check if it's the default pipeline
    if (pipeline.isDefault) {
      throw new BadRequestError("Cannot delete the default pipeline. Set another pipeline as default first.");
    }

    // Check how many pipelines exist
    const pipelines = await getPipelines(ctx);
    if (pipelines.length <= 1) {
      throw new BadRequestError("Cannot delete the last pipeline. Organizations must have at least one pipeline.");
    }

    // Check if pipeline has clients
    const [clientCount] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${crmClientStages.clientId})::int` })
      .from(crmClientStages)
      .innerJoin(crmPipelineStages, eq(crmClientStages.stageId, crmPipelineStages.id))
      .where(eq(crmPipelineStages.pipelineId, pipelineId));

    const numClients = clientCount?.count ?? 0;

    if (numClients > 0) {
      throw new BadRequestError(`Cannot delete pipeline with ${numClients} clients. Move them to another pipeline first.`);
    }

    // Delete the pipeline (cascade will delete stages)
    await db.delete(crmPipelines).where(and(eq(crmPipelines.id, pipelineId), eq(crmPipelines.organizationId, organizationId)));

    // Publish CRM event for pipeline deleted
    if (performedBy) {
      await publisher.crm.pipelineDeleted(
        { organizationId, performedBy },
        { pipelineId, pipelineName: pipeline.name, clientCount: numClients }
      );
    }

    log.info({ pipelineId, organizationId }, "crmPipelineService:deletePipeline:success");
    return true;
  } catch (error) {
    log.error({ pipelineId, organizationId, err: serializeError(error) }, "crmPipelineService:deletePipeline:error");
    throw error;
  }
}

/**
 * Reorder pipelines
 */
export async function reorderPipelines(ctx: CrmServiceContext, pipelineIds: string[]): Promise<void> {
  const { db, organizationId } = ctx;
  try {
    log.info({ organizationId, pipelineIds }, "crmPipelineService:reorderPipelines:start");

    const uniqueIds = assertUniqueIds(pipelineIds, "Pipeline");
    await assertIdsBelongToOrg(
      db,
      crmPipelines,
      crmPipelines.id,
      crmPipelines.organizationId,
      uniqueIds,
      organizationId,
      "Pipeline"
    );

    await reorderByIds(uniqueIds, async (id, position) => {
      await db
        .update(crmPipelines)
        .set({ position, updatedAt: new Date() })
        .where(and(eq(crmPipelines.id, id), eq(crmPipelines.organizationId, organizationId)));
    });

    log.info({ organizationId, count: uniqueIds.length }, "crmPipelineService:reorderPipelines:success");
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "crmPipelineService:reorderPipelines:error");
    throw error;
  }
}

/**
 * Set a pipeline as the default
 */
export async function setDefaultPipeline(
  ctx: CrmServiceContext,
  pipelineId: string,
  performedBy?: string
): Promise<void> {
  const { db, organizationId, publisher } = ctx;
  try {
    log.info({ pipelineId, organizationId }, "crmPipelineService:setDefaultPipeline:start");

    // Get current default pipeline for event
    const [currentDefault] = await db
      .select({ id: crmPipelines.id })
      .from(crmPipelines)
      .where(and(eq(crmPipelines.organizationId, organizationId), eq(crmPipelines.isDefault, true)))
      .limit(1);

    // Unset current default
    await db
      .update(crmPipelines)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(crmPipelines.organizationId, organizationId), eq(crmPipelines.isDefault, true)));

    // Set new default
    await db
      .update(crmPipelines)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(crmPipelines.id, pipelineId), eq(crmPipelines.organizationId, organizationId)));

    // Publish CRM event for default pipeline set
    if (performedBy) {
      await publisher.crm.pipelineDefaultSet(
        { organizationId, performedBy },
        { pipelineId, previousPipelineId: currentDefault?.id ?? null }
      );
    }

    log.info({ pipelineId, organizationId }, "crmPipelineService:setDefaultPipeline:success");
  } catch (error) {
    log.error({ pipelineId, organizationId, err: serializeError(error) }, "crmPipelineService:setDefaultPipeline:error");
    throw error;
  }
}
