/**
 * Workflow Version Service
 *
 * CRUD operations for workflow version history, scoped to organizations.
 * Versions store snapshots of workflow configurations for restore/audit purposes.
 *
 * @module modules/workflows/services/version-service
 */

import { agentWorkflows, workflowVersions } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  generateNextVersionId,
} from "@journey/schemas";
import type {
  AtomicWorkflowSaveInput,
  AtomicWorkflowSaveResult,
  SaveWorkflowVersionInput,
  VersionedWorkflowData,
  WorkflowConfiguration,
  WorkflowVersion,
} from "@journey/schemas";
import { and, desc, eq, isNull } from "drizzle-orm";

import { getErrorCode } from "../../../lib/db-errors";
import type { WorkflowServiceContext } from "./service-context";

const log = createLogger("workflow-version-service");

/**
 * Get workflow by key (ensuring it belongs to the organization and is not deleted)
 */
async function getWorkflowByKey(ctx: WorkflowServiceContext, key: string) {
  const workflows = await ctx.db
    .select({ id: agentWorkflows.id })
    .from(agentWorkflows)
    .where(and(eq(agentWorkflows.key, key), eq(agentWorkflows.organizationId, ctx.organizationId), isNull(agentWorkflows.deletedAt)))
    .limit(1);

  return workflows[0] ?? null;
}

/**
 * Get all versions for a workflow (scoped to organization)
 * Returns versions ordered by creation date (newest first)
 */
export async function listWorkflowVersions(
  ctx: WorkflowServiceContext,
  workflowKey: string
): Promise<WorkflowVersion[]> {
  try {
    // First verify the workflow belongs to the organization
    const workflow = await getWorkflowByKey(ctx, workflowKey);

    if (!workflow) {
      log.debug({ workflowKey, orgId: ctx.organizationId }, "workflowVersionService:listVersions:workflowNotFound");
      return [];
    }

    const results = await ctx.db
      .select({
        id: workflowVersions.id,
        workflowId: workflowVersions.workflowId,
        versionId: workflowVersions.versionId,
        notes: workflowVersions.notes,
        createdBy: workflowVersions.createdBy,
        createdAt: workflowVersions.createdAt,
      })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflow.id))
      .orderBy(desc(workflowVersions.createdAt));

    log.debug({ workflowKey, count: results.length }, "workflowVersionService:listVersions");
    return results.map(mapWorkflowVersion);
  } catch (error) {
    log.error({ workflowKey, orgId: ctx.organizationId, err: serializeError(error) }, "workflowVersionService:listVersions:error");
    throw error;
  }
}

/**
 * Save a new version of a workflow
 * Stores a snapshot of the current workflow configuration
 */
export async function saveWorkflowVersion(
  ctx: WorkflowServiceContext,
  workflowKey: string,
  userId: string,
  data: SaveWorkflowVersionInput
): Promise<WorkflowVersion> {
  try {
    // First verify the workflow belongs to the organization
    const workflow = await getWorkflowByKey(ctx, workflowKey);

    if (!workflow) {
      log.warn({ workflowKey, orgId: ctx.organizationId }, "workflowVersionService:saveVersion:workflowNotFound");
      throw new NotFoundError("Workflow", workflowKey);
    }

    const [version] = await ctx.db
      .insert(workflowVersions)
      .values({
        workflowId: workflow.id,
        versionId: data.versionId,
        notes: data.notes || null,
        configuration: data.configuration,
        createdBy: userId,
      })
      .returning({
        id: workflowVersions.id,
        workflowId: workflowVersions.workflowId,
        versionId: workflowVersions.versionId,
        notes: workflowVersions.notes,
        createdBy: workflowVersions.createdBy,
        createdAt: workflowVersions.createdAt,
      });

    // Verify insert succeeded
    if (!version) {
      log.error({ workflowKey, versionId: data.versionId }, "workflowVersionService:saveVersion:insertFailed");
      throw new BadRequestError("Failed to create version record");
    }

    log.info({ workflowKey, versionId: data.versionId, userId }, "workflowVersionService:saveVersion:success");
    return mapWorkflowVersion(version);
  } catch (error) {
    // Handle unique constraint violation (duplicate versionId for this workflow)
    if (getErrorCode(error) === "23505") {
      log.warn({ workflowKey, versionId: data.versionId }, "workflowVersionService:saveVersion:duplicateVersion");
      throw new ConflictError(`Version ${data.versionId} already exists for this workflow`);
    }
    log.error({ workflowKey, orgId: ctx.organizationId, err: serializeError(error) }, "workflowVersionService:saveVersion:error");
    throw error;
  }
}

/**
 * Get a specific version of a workflow with full configuration
 */
export async function getWorkflowVersion(
  ctx: WorkflowServiceContext,
  workflowKey: string,
  versionId: string
): Promise<VersionedWorkflowData | null> {
  try {
    // First verify the workflow belongs to the organization
    const workflow = await getWorkflowByKey(ctx, workflowKey);

    if (!workflow) {
      log.debug({ workflowKey, orgId: ctx.organizationId }, "workflowVersionService:getVersion:workflowNotFound");
      return null;
    }

    const results = await ctx.db
      .select({
        id: workflowVersions.id,
        workflowId: workflowVersions.workflowId,
        versionId: workflowVersions.versionId,
        notes: workflowVersions.notes,
        configuration: workflowVersions.configuration,
        createdBy: workflowVersions.createdBy,
        createdAt: workflowVersions.createdAt,
      })
      .from(workflowVersions)
      .where(and(eq(workflowVersions.workflowId, workflow.id), eq(workflowVersions.versionId, versionId)));

    if (results.length === 0) {
      log.debug({ workflowKey, versionId }, "workflowVersionService:getVersion:notFound");
      return null;
    }

    const result = results[0];
    log.debug({ workflowKey, versionId }, "workflowVersionService:getVersion:found");

    const configuration = result.configuration ?? null;
    if (!configuration) {
      log.warn({ workflowKey, versionId }, "workflowVersionService:getVersion:missingConfiguration");
      return null;
    }

    return {
      version: mapWorkflowVersion(result),
      data: configuration,
    };
  } catch (error) {
    log.error({ workflowKey, versionId, orgId: ctx.organizationId, err: serializeError(error) }, "workflowVersionService:getVersion:error");
    throw error;
  }
}

/**
 * Delete a specific version of a workflow
 */
export async function deleteWorkflowVersion(
  ctx: WorkflowServiceContext,
  workflowKey: string,
  versionId: string
): Promise<boolean> {
  try {
    // First verify the workflow belongs to the organization
    const workflow = await getWorkflowByKey(ctx, workflowKey);

    if (!workflow) {
      log.debug({ workflowKey, orgId: ctx.organizationId }, "workflowVersionService:deleteVersion:workflowNotFound");
      return false;
    }

    const result = await ctx.db
      .delete(workflowVersions)
      .where(and(eq(workflowVersions.workflowId, workflow.id), eq(workflowVersions.versionId, versionId)))
      .returning({ id: workflowVersions.id });

    const deleted = result.length > 0;
    if (deleted) {
      log.info({ workflowKey, versionId }, "workflowVersionService:deleteVersion:success");
    } else {
      log.debug({ workflowKey, versionId }, "workflowVersionService:deleteVersion:notFound");
    }

    return deleted;
  } catch (error) {
    log.error({ workflowKey, versionId, orgId: ctx.organizationId, err: serializeError(error) }, "workflowVersionService:deleteVersion:error");
    throw error;
  }
}

// =============================================================================
// ATOMIC SAVE (Server-side version ID generation)
// =============================================================================

/**
 * Get the next version ID for a workflow by querying existing versions
 * @param workflowId - Workflow UUID to check versions for
 * @returns Next version ID in format v001, v002, etc.
 */
async function getNextVersionId(ctx: WorkflowServiceContext, workflowId: string): Promise<string> {
  const versions = await ctx.db
    .select({ versionId: workflowVersions.versionId })
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId))
    .orderBy(desc(workflowVersions.createdAt))
    .limit(1);

  const latestVersionId = versions.length > 0 ? versions[0].versionId : null;
  return generateNextVersionId(latestVersionId);
}

/**
 * Atomic save - updates workflow AND creates version in a transaction
 *
 * This is the preferred save method as it:
 * 1. Generates version ID server-side (prevents collisions)
 * 2. Uses a transaction (ensures consistency)
 * 3. Updates both workflow and version in one call (reduces network roundtrips)
 */
export async function saveVersionAtomic(
  ctx: WorkflowServiceContext,
  workflowKey: string,
  userId: string,
  data: AtomicWorkflowSaveInput
): Promise<AtomicWorkflowSaveResult> {
  try {
    // First verify the workflow belongs to the organization
    const workflow = await getWorkflowByKey(ctx, workflowKey);

    if (!workflow) {
      log.warn({ workflowKey, orgId: ctx.organizationId }, "workflowVersionService:saveVersionAtomic:workflowNotFound");
      throw new NotFoundError("Workflow", workflowKey);
    }

    // Generate version ID server-side
    const versionId = await getNextVersionId(ctx, workflow.id);

    // Use transaction to ensure both operations succeed or both fail
    const result = await ctx.db.transaction(async (tx) => {
      // 1. Update workflow configuration and metadata
      const updateData: Record<string, unknown> = {
        configuration: data.configuration,
        updatedAt: new Date(),
      };

      // Only update optional fields if provided
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.settings !== undefined) updateData.settings = data.settings;

      await tx.update(agentWorkflows).set(updateData).where(eq(agentWorkflows.id, workflow.id));

      // 2. Create version record
      const [version] = await tx
        .insert(workflowVersions)
        .values({
          workflowId: workflow.id,
          versionId,
          notes: data.notes || null,
          configuration: data.configuration,
          createdBy: userId,
        })
        .returning({
          id: workflowVersions.id,
          workflowId: workflowVersions.workflowId,
          versionId: workflowVersions.versionId,
          notes: workflowVersions.notes,
          createdBy: workflowVersions.createdBy,
          createdAt: workflowVersions.createdAt,
        });

      if (!version) {
        throw new BadRequestError("Failed to create version record");
      }

      return version;
    });

    log.info({ workflowKey, versionId, userId }, "workflowVersionService:saveVersionAtomic:success");

    return {
      version: mapWorkflowVersion(result),
      versionId,
    };
  } catch (error) {
    // Handle unique constraint violation (duplicate versionId - extremely rare due to server-side generation)
    if (getErrorCode(error) === "23505") {
      log.warn({ workflowKey }, "workflowVersionService:saveVersionAtomic:duplicateVersion");
      throw new ConflictError("Version ID collision - please retry");
    }
    log.error({ workflowKey, orgId: ctx.organizationId, err: serializeError(error) }, "workflowVersionService:saveVersionAtomic:error");
    throw error;
  }
}

function mapWorkflowVersion(row: {
  id: string;
  workflowId: string;
  versionId: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date | null;
}): WorkflowVersion {
  if (!row.createdAt) {
    throw new BadRequestError("Workflow version missing creation timestamp");
  }

  return {
    id: row.id,
    workflowId: row.workflowId,
    versionId: row.versionId,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}
