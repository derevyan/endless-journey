/**
 * Workflow Service
 *
 * Service layer for Agent Workflow CRUD operations.
 * Handles database operations, validation, and business logic.
 *
 * @module modules/workflows/services/crud-service
 */

import { agentWorkflows, journeys } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import {
  validateWorkflow,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@journey/schemas";
import type {
  AgentWorkflow,
  CreateAgentWorkflow,
  JourneyConfig,
  UpdateAgentWorkflow,
  WorkflowConfiguration,
  WorkflowEdge,
  WorkflowListParams,
  WorkflowListResult,
  WorkflowNode,
  WorkflowSettings,
  WorkflowStatus,
  WorkflowSummary,
  WorkflowValidationResult,
} from "@journey/schemas";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import type { WorkflowServiceContext } from "./service-context";

const log = createLogger("service:workflows");

// ============================================================
// Service Functions
// ============================================================

/**
 * List workflows for an organization with pagination and filtering.
 */
export async function listWorkflows(
  ctx: WorkflowServiceContext,
  params: WorkflowListParams = {}
): Promise<WorkflowListResult> {
  const { status, search, limit = 50, offset = 0 } = params;

  log.debug({ orgId: ctx.organizationId, status, search, limit, offset }, "workflows:list:start");

  try {
    // Build where conditions
    const conditions = [eq(agentWorkflows.organizationId, ctx.organizationId)];

    // Exclude soft-deleted workflows
    conditions.push(isNull(agentWorkflows.deletedAt));

    if (status) {
      conditions.push(eq(agentWorkflows.status, status));
    }

    if (search) {
      const searchCondition = or(
        ilike(agentWorkflows.name, `%${search}%`),
        ilike(agentWorkflows.key, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Get total count
    const countResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(agentWorkflows)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Get workflows with pagination
    const workflows = await ctx.db
      .select()
      .from(agentWorkflows)
      .where(and(...conditions))
      .orderBy(desc(agentWorkflows.updatedAt))
      .limit(limit)
      .offset(offset);

    // Map to summary format
    const summaries: WorkflowSummary[] = workflows.map((workflow) => {
      const config = workflow.configuration;
      const nodes = config?.nodes ?? [];
      return {
        id: workflow.id,
        orgId: workflow.organizationId,
        key: workflow.key,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodeCount: nodes.length,
        agentCount: nodes.filter((node) => node.type === "agent").length,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      };
    });

    log.debug({ orgId: ctx.organizationId, total, returned: summaries.length }, "workflows:list:complete");

    return {
      workflows: summaries,
      total,
      limit,
      offset,
    };
  } catch (error) {
    log.error({ err: serializeError(error), orgId: ctx.organizationId }, "workflows:list:error");
    throw error;
  }
}

/**
 * Get a single workflow by key.
 */
export async function getWorkflowByKey(ctx: WorkflowServiceContext, key: string): Promise<AgentWorkflow | null> {
  log.debug({ orgId: ctx.organizationId, key }, "workflows:getByKey:start");

  try {
    const workflows = await ctx.db
      .select()
      .from(agentWorkflows)
      .where(and(eq(agentWorkflows.organizationId, ctx.organizationId), eq(agentWorkflows.key, key)))
      .limit(1);

    if (workflows.length === 0) {
      return null;
    }

    const workflow = workflows[0];
    return mapWorkflowToResponse(workflow);
  } catch (error) {
    log.error({ err: serializeError(error), orgId: ctx.organizationId, key }, "workflows:getByKey:error");
    throw error;
  }
}

/**
 * Create a new workflow.
 */
export async function createWorkflow(
  ctx: WorkflowServiceContext,
  userId: string,
  input: CreateAgentWorkflow
): Promise<AgentWorkflow> {
  log.debug({ orgId: ctx.organizationId, userId, key: input.key }, "workflows:create:start");

  try {
    // Check for key conflict (only non-deleted workflows)
    const existing = await ctx.db
      .select({ id: agentWorkflows.id })
      .from(agentWorkflows)
      .where(and(eq(agentWorkflows.organizationId, ctx.organizationId), eq(agentWorkflows.key, input.key), isNull(agentWorkflows.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError("Workflow", input.key);
    }

    // Get configuration or use default
    const configuration = input.configuration ?? { nodes: [], edges: [] };

    // Validate workflow graph structure
    const validation = validateWorkflow(configuration.nodes, configuration.edges);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => e.message).join(", ");
      throw new BadRequestError(`Invalid workflow graph: ${errorMessages}`, { key: input.key });
    }

    // Insert workflow
    const [workflow] = await ctx.db
      .insert(agentWorkflows)
      .values({
        organizationId: ctx.organizationId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "draft",
        configuration,
        settings: input.settings ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    log.info({ orgId: ctx.organizationId, userId, workflowId: workflow.id, key: input.key }, "workflows:create:complete");

    return mapWorkflowToResponse(workflow);
  } catch (error) {
    log.error({ err: serializeError(error), orgId: ctx.organizationId, key: input.key }, "workflows:create:error");
    throw error;
  }
}

/**
 * Update an existing workflow.
 */
export async function updateWorkflow(
  ctx: WorkflowServiceContext,
  userId: string,
  key: string,
  input: UpdateAgentWorkflow
): Promise<AgentWorkflow> {
  log.debug({ orgId: ctx.organizationId, userId, key }, "workflows:update:start");

  try {
    // Check workflow exists
    const existing = await getWorkflowByKey(ctx, key);
    if (!existing) {
      throw new NotFoundError("Workflow", key);
    }

    // If updating configuration, validate graph structure
    if (input.configuration) {
      const validation = validateWorkflow(input.configuration.nodes, input.configuration.edges);
      if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => e.message).join(", ");
        throw new BadRequestError(`Invalid workflow graph: ${errorMessages}`, { key });
      }
    }

    // Build update object
    const updates: Record<string, WorkflowConfiguration | WorkflowSettings | WorkflowStatus | string | null | Date | undefined> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.configuration !== undefined) updates.configuration = input.configuration;
    if (input.settings !== undefined) updates.settings = input.settings;
    if (input.status !== undefined) updates.status = input.status;

    // Update workflow
    const [workflow] = await ctx.db.update(agentWorkflows).set(updates).where(eq(agentWorkflows.id, existing.id)).returning();

    log.info({ orgId: ctx.organizationId, userId, workflowId: workflow.id, key }, "workflows:update:complete");

    return mapWorkflowToResponse(workflow);
  } catch (error) {
    log.error({ err: serializeError(error), orgId: ctx.organizationId, key }, "workflows:update:error");
    throw error;
  }
}

/**
 * Delete (archive) a workflow.
 */
export async function deleteWorkflow(ctx: WorkflowServiceContext, key: string, force = false): Promise<void> {
  log.debug({ orgId: ctx.organizationId, key, force }, "workflows:delete:start");

  try {
    // Check workflow exists
    const existing = await getWorkflowByKey(ctx, key);
    if (!existing) {
      throw new NotFoundError("Workflow", key);
    }

    if (!force) {
      const orgJourneys = await ctx.db
        .select({
          id: journeys.id,
          slug: journeys.slug,
          name: journeys.name,
          configuration: journeys.configuration,
        })
        .from(journeys)
        .where(eq(journeys.organizationId, ctx.organizationId));

      const journeysUsingWorkflow = orgJourneys.filter((journey) => {
        const config: JourneyConfig = journey.configuration;
        return config.nodes.some((node) => node.data.type === "agent" && node.data.workflowKey === key);
      });

      if (journeysUsingWorkflow.length > 0) {
        const sample = journeysUsingWorkflow
          .slice(0, 3)
          .map((journey) => journey.slug ?? journey.name ?? journey.id);
        const remaining = journeysUsingWorkflow.length - sample.length;
        const suffix = remaining > 0 ? ` and ${remaining} more` : "";

        log.warn(
          { orgId: ctx.organizationId, key, count: journeysUsingWorkflow.length, sample },
          "workflows:delete:inUse"
        );

        throw new ConflictError(
          `Workflow "${key}" is used in ${journeysUsingWorkflow.length} journey(s): ${sample.join(", ")}${suffix}. Use force=true to delete.`
        );
      }
    }

    // Soft delete by setting status to archived and deletedAt
    await ctx.db
      .update(agentWorkflows)
      .set({
        status: "archived",
        deletedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, existing.id));

    log.info({ orgId: ctx.organizationId, workflowId: existing.id, key }, "workflows:delete:complete");
  } catch (error) {
    log.error({ err: serializeError(error), orgId: ctx.organizationId, key }, "workflows:delete:error");
    throw error;
  }
}

/**
 * Validate workflow configuration without saving.
 */
export async function validateWorkflowConfig(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Promise<WorkflowValidationResult> {
  const validation = validateWorkflow(nodes, edges);
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

function mapWorkflowToResponse(row: typeof agentWorkflows.$inferSelect): AgentWorkflow {
  return {
    id: row.id,
    orgId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    configuration: row.configuration,
    settings: row.settings ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy ?? undefined,
    updatedBy: row.updatedBy ?? undefined,
    deletedAt: row.deletedAt ?? undefined,
  };
}
