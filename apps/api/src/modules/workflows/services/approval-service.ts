/**
 * Workflow Approval Service
 *
 * Handles user approval workflow nodes:
 * - Creating approval records when workflows pause
 * - Processing approval/rejection responses
 * - Handling timeouts with configured actions
 * - Resuming workflows after approval decisions
 *
 * @module modules/workflows/services/approval-service
 */

import { agentWorkflows, workflowApprovals } from "@journey/db";
import { createLogger } from "@journey/logger";
import { BadRequestError, ForbiddenError, NotFoundError, WorkflowEventTypes } from "@journey/schemas";
import type {
  AgentWorkflow,
  ApprovalListParams,
  ApprovalListResult,
  ApprovalRecord,
  ApprovalResponse,
  ApprovalStatus,
} from "@journey/schemas";
import { and, count, desc, eq } from "drizzle-orm";
import {
  resumeWorkflow,
  type SerializableNodeInput,
  type WorkflowContext,
  type WorkflowPauseState,
} from "@journey/llm/workflow";

import { isRecord } from "../../../lib/type-guards";
import {
  cancelApprovalTimeout,
  initApprovalTimerService,
  scheduleApprovalTimeout,
} from "../../../services/timers";
import { createWorkflowEmitter } from "./event-emitter";
import type { WorkflowServiceContext } from "./service-context";

const log = createLogger("service:workflow-approvals");

// =============================================================================
// TYPES
// =============================================================================

export interface CreateApprovalInput {
  workflowId: string;
  workflowKey: string;
  workflowRunId: string;
  orgId: string;
  nodeId: string;
  sessionId?: string;
  clientId?: string;
  pauseState: WorkflowPauseState;
}

function isSerializableNodeInput(value: unknown): value is SerializableNodeInput {
  if (!isRecord(value)) return false;
  if (typeof value.message !== "string") return false;
  if (!Array.isArray(value.conversationHistory)) return false;
  if (!isRecord(value.variables)) return false;
  if (!isRecord(value.previousNodeOutputs)) return false;
  return true;
}

function requireSerializableNodeInput(value: unknown, approvalId: string): SerializableNodeInput {
  if (isSerializableNodeInput(value)) {
    return value;
  }

  // Provide detailed error context for debugging
  if (!isRecord(value)) {
    throw new BadRequestError("Approval execution state is not an object", {
      approvalId,
      received: typeof value,
    });
  }

  const missingFields: string[] = [];
  if (typeof value.message !== "string") missingFields.push("message");
  if (!Array.isArray(value.conversationHistory)) missingFields.push("conversationHistory");
  if (!isRecord(value.variables)) missingFields.push("variables");
  if (!isRecord(value.previousNodeOutputs)) missingFields.push("previousNodeOutputs");

  throw new BadRequestError("Approval execution state is missing required fields", {
    approvalId,
    missingFields,
  });
}

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

let initialized = false;

/**
 * Initialize the approval service.
 * Must be called at app startup before handling approvals.
 */
export async function initApprovalService(ctx: WorkflowServiceContext): Promise<void> {
  if (initialized) {
    log.warn({}, "approvalService:alreadyInitialized");
    return;
  }

  // Initialize timeout timer with callback
  await initApprovalTimerService((data) => handleApprovalTimeout(ctx, data));

  initialized = true;
  log.info({}, "approvalService:initialized");
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Create a new pending approval.
 *
 * Called when a workflow hits a user_approval node and pauses.
 * Schedules a timeout if configured.
 *
 * @param input - Approval creation input
 * @returns Created approval record
 */
export async function createApproval(ctx: WorkflowServiceContext, input: CreateApprovalInput): Promise<ApprovalRecord> {
  const { workflowId, workflowRunId, orgId, nodeId, pauseState } = input;
  const { pauseData, nodeInput } = pauseState;

  log.debug(
    { workflowId, workflowRunId, orgId, nodeId, message: pauseData.approvalMessage },
    "approvalService:create:start"
  );

  // Calculate expiration
  let expiresAt: Date | null = null;
  if (pauseData.timeoutSeconds) {
    expiresAt = new Date(Date.now() + pauseData.timeoutSeconds * 1000);
  }

  // Insert approval record
  const [approval] = await ctx.db
    .insert(workflowApprovals)
    .values({
      workflowId,
      workflowRunId,
      organizationId: orgId,
      nodeId,
      message: pauseData.approvalMessage,
      status: "pending",
      executionState: nodeInput,
      timeoutSeconds: pauseData.timeoutSeconds ?? null,
      timeoutAction: pauseData.timeoutAction ?? null,
      expiresAt,
      allowedRoles: pauseData.allowedRoles ?? null,
    })
    .returning();

  // Schedule timeout if configured
  let timeoutJobId: string | null = null;
  if (pauseData.timeoutSeconds && pauseData.timeoutAction) {
    const delayMs = pauseData.timeoutSeconds * 1000;
    timeoutJobId = await scheduleApprovalTimeout(
      approval.id,
      workflowId,
      nodeId,
      pauseData.timeoutAction,
      delayMs
    );

    // Update record with job ID
    await ctx.db
      .update(workflowApprovals)
      .set({ timeoutJobId })
      .where(eq(workflowApprovals.id, approval.id));
  }

  log.info(
    {
      approvalId: approval.id,
      workflowId,
      workflowRunId,
      nodeId,
      timeoutSeconds: pauseData.timeoutSeconds,
      expiresAt: expiresAt?.toISOString(),
    },
    "approvalService:create:complete"
  );

  // Emit workflow.approval.requested event (non-blocking)
  const emit = createWorkflowEmitter(
    {
      organizationId: orgId,
      clientId: input.clientId ?? null,
      sessionId: input.sessionId ?? null,
      journeyId: "",
      performedBy: "system",
      triggeredBy: "automation",
      workflowKey: input.workflowKey,
    },
    ctx.publisher
  );

  emit({
    type: WorkflowEventTypes.WORKFLOW_APPROVAL_REQUESTED,
    payload: {
      workflowId,
      workflowKey: input.workflowKey,
      nodeId,
      nodeType: "user_approval",
      nodeName: pauseData.approvalMessage?.slice(0, 50) || "Approval Required",
      approvalMessage: pauseData.approvalMessage,
      timeoutSeconds: pauseData.timeoutSeconds,
      timeoutAction: pauseData.timeoutAction,
      allowedRoles: pauseData.allowedRoles,
    },
  });

  return mapApprovalRecord({ ...approval, timeoutJobId });
}

/**
 * List pending approvals for an organization.
 */
export async function listApprovals(
  ctx: WorkflowServiceContext,
  params: ApprovalListParams = {}
): Promise<ApprovalListResult> {
  const { status, limit = 50, offset = 0 } = params;

  log.debug({ orgId: ctx.organizationId, status, limit, offset }, "approvalService:list:start");

  // Build conditions
  const conditions = [eq(workflowApprovals.organizationId, ctx.organizationId)];
  if (status) {
    conditions.push(eq(workflowApprovals.status, status));
  }

  // Get total count efficiently using COUNT(*)
  const [{ total }] = await ctx.db
    .select({ total: count() })
    .from(workflowApprovals)
    .where(and(...conditions));

  // Get paginated results
  const approvals = await ctx.db
    .select()
    .from(workflowApprovals)
    .where(and(...conditions))
    .orderBy(desc(workflowApprovals.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    approvals: approvals.map(mapApprovalRecord),
    total,
    limit,
    offset,
  };
}

/**
 * Get a single approval by ID.
 */
export async function getApproval(
  ctx: WorkflowServiceContext,
  id: string
): Promise<ApprovalRecord | null> {
  const approvals = await ctx.db
    .select()
    .from(workflowApprovals)
    .where(and(eq(workflowApprovals.id, id), eq(workflowApprovals.organizationId, ctx.organizationId)))
    .limit(1);

  if (approvals.length === 0) {
    return null;
  }

  return mapApprovalRecord(approvals[0]);
}

/**
 * Respond to an approval (approve or reject).
 *
 * This cancels any pending timeout, updates the record,
 * and resumes the workflow.
 *
 * @param id - Approval ID
 * @param userId - User ID of responder
 * @param userRoles - User's roles for access control
 * @param response - Approval response
 * @returns Updated approval record
 */
export async function respondToApproval(
  ctx: WorkflowServiceContext,
  id: string,
  userId: string,
  userRoles: string[],
  response: ApprovalResponse
): Promise<ApprovalRecord> {
  log.debug({ id, orgId: ctx.organizationId, userId, approved: response.approved }, "approvalService:respond:start");

  // Get approval
  const approval = await getApproval(ctx, id);
  if (!approval) {
    throw new NotFoundError("Approval", id);
  }

  // Check status
  if (approval.status !== "pending") {
    throw new BadRequestError(`Approval ${id} is already ${approval.status}`);
  }

  // Check role-based access
  const allowedRoles = approval.allowedRoles ?? [];
  if (allowedRoles.length > 0) {
    const hasAllowedRole = userRoles.some((role) => allowedRoles.includes(role));
    if (!hasAllowedRole) {
      throw new ForbiddenError("User does not have required role to respond to this approval");
    }
  }

  // Cancel timeout if scheduled
  if (approval.timeoutJobId) {
    await cancelApprovalTimeout(approval.timeoutJobId);
  }

  // Update approval record
  const newStatus: ApprovalStatus = response.approved ? "approved" : "rejected";
  const now = new Date();

  await ctx.db
    .update(workflowApprovals)
    .set({
      status: newStatus,
      respondedBy: userId,
      respondedAt: now,
      responseNote: response.note ?? null,
      updatedAt: now,
    })
    .where(eq(workflowApprovals.id, id));

  log.info(
    { approvalId: id, status: newStatus, respondedBy: userId },
    "approvalService:respond:updated"
  );

  // Fetch workflow to get the key for event emission
  const workflows = await ctx.db
    .select({ key: agentWorkflows.key })
    .from(agentWorkflows)
    .where(eq(agentWorkflows.id, approval.workflowId))
    .limit(1);

  if (workflows.length === 0) {
    log.warn({ approvalId: id, workflowId: approval.workflowId }, "respondToApproval:workflowNotFound");
  }
  const workflowKey = workflows[0]?.key ?? "deleted-workflow";

  // Emit workflow.approval.response event (non-blocking)
  const emit = createWorkflowEmitter(
    {
      organizationId: ctx.organizationId,
      clientId: null,
      sessionId: null,
      journeyId: "",
      performedBy: userId,
      triggeredBy: "manual",
      workflowKey,
    },
    ctx.publisher
  );

  emit({
    type: WorkflowEventTypes.WORKFLOW_APPROVAL_RESPONSE,
    payload: {
      workflowId: approval.workflowId,
      workflowKey,
      nodeId: approval.nodeId,
      nodeType: "user_approval",
      nodeName: approval.message?.slice(0, 50) || "Approval",
      approved: response.approved,
      respondedBy: userId,
    },
  });

  // Resume workflow
  await resumeWorkflowFromApproval(ctx, approval, response.approved);

  // Return updated record
  const updated = await getApproval(ctx, id);
  if (!updated) {
    throw new NotFoundError("Approval", id);
  }

  return updated;
}

/**
 * Handle approval timeout.
 *
 * Called by the timer service when a timeout fires.
 * Applies the configured timeout action.
 */
export async function handleApprovalTimeout(
  ctx: WorkflowServiceContext,
  data: {
    approvalId: string;
    workflowId: string;
    nodeId: string;
    timeoutAction: "approve" | "reject" | "skip";
  }
): Promise<void> {
  const { approvalId, timeoutAction } = data;

  log.info({ approvalId, timeoutAction }, "approvalService:timeout:handling");

  // Get approval with org context
  const approvals = await ctx.db
    .select()
    .from(workflowApprovals)
    .where(eq(workflowApprovals.id, approvalId))
    .limit(1);

  if (approvals.length === 0) {
    log.warn({ approvalId }, "approvalService:timeout:approvalNotFound");
    return;
  }

  const approval = mapApprovalRecord(approvals[0]);

  // Check if already handled
  if (approval.status !== "pending") {
    log.info(
      { approvalId, status: approval.status },
      "approvalService:timeout:alreadyHandled"
    );
    return;
  }

  // Update status to timed_out
  const now = new Date();
  await ctx.db
    .update(workflowApprovals)
    .set({
      status: "timed_out",
      responseNote: `Timed out with action: ${timeoutAction}`,
      updatedAt: now,
    })
    .where(eq(workflowApprovals.id, approvalId));

  // Fetch workflow to get the key for event emission
  const workflowsForKey = await ctx.db
    .select({ key: agentWorkflows.key })
    .from(agentWorkflows)
    .where(eq(agentWorkflows.id, approval.workflowId))
    .limit(1);

  if (workflowsForKey.length === 0) {
    log.warn({ approvalId, workflowId: approval.workflowId }, "handleApprovalTimeout:workflowNotFound");
  }
  const workflowKey = workflowsForKey[0]?.key ?? "deleted-workflow";

  // Emit workflow.approval.response event for timeout (non-blocking)
  const emit = createWorkflowEmitter(
    {
      organizationId: approval.orgId,
      clientId: null,
      sessionId: null,
      journeyId: "",
      performedBy: "system",
      triggeredBy: "automation",
      workflowKey,
    },
    ctx.publisher
  );

  // Handle based on timeout action
  if (timeoutAction === "skip") {
    log.info({ approvalId }, "approvalService:timeout:skipped");

    emit({
      type: WorkflowEventTypes.WORKFLOW_APPROVAL_RESPONSE,
      payload: {
        workflowId: approval.workflowId,
        workflowKey,
        nodeId: approval.nodeId,
        nodeType: "user_approval",
        nodeName: approval.message?.slice(0, 50) || "Approval",
        approved: false,
        respondedBy: "timeout",
        timedOut: true,
        timeoutAction: "skip",
      },
    });

    // Don't resume - workflow stays paused indefinitely
    return;
  }

  // Resume workflow with auto-approval or auto-rejection
  const autoApproved = timeoutAction === "approve";

  emit({
    type: WorkflowEventTypes.WORKFLOW_APPROVAL_RESPONSE,
    payload: {
      workflowId: approval.workflowId,
      workflowKey,
      nodeId: approval.nodeId,
      nodeType: "user_approval",
      nodeName: approval.message?.slice(0, 50) || "Approval",
      approved: autoApproved,
      respondedBy: "timeout",
      timedOut: true,
      timeoutAction,
    },
  });

  await resumeWorkflowFromApproval(ctx, approval, autoApproved);

  log.info(
    { approvalId, timeoutAction, autoApproved },
    "approvalService:timeout:complete"
  );
}

// =============================================================================
// WORKFLOW RESUMPTION
// =============================================================================

/**
 * Resume workflow execution after approval decision.
 *
 * Loads the workflow, builds context, and calls resumeWorkflow().
 */
async function resumeWorkflowFromApproval(
  ctx: WorkflowServiceContext,
  approval: ApprovalRecord,
  approved: boolean
): Promise<void> {
  log.info(
    { approvalId: approval.id, workflowId: approval.workflowId, approved },
    "approvalService:resume:start"
  );

  if (!approval.executionState) {
    throw new BadRequestError(`Approval ${approval.id} has no execution state`);
  }

  // Load workflow
  const workflows = await ctx.db
    .select()
    .from(agentWorkflows)
    .where(eq(agentWorkflows.id, approval.workflowId))
    .limit(1);

  if (workflows.length === 0) {
    throw new NotFoundError("Workflow", approval.workflowId);
  }

  const dbWorkflow = workflows[0];
  const workflow: AgentWorkflow = {
    id: dbWorkflow.id,
    orgId: dbWorkflow.organizationId,
    key: dbWorkflow.key,
    name: dbWorkflow.name,
    description: dbWorkflow.description ?? undefined,
    status: dbWorkflow.status,
    configuration: dbWorkflow.configuration,
    settings: dbWorkflow.settings ?? null,
    createdAt: dbWorkflow.createdAt,
    updatedAt: dbWorkflow.updatedAt,
  };

  // Build minimal context for resumption
  const context: WorkflowContext = {
    orgId: approval.orgId,
    sessionId: approval.workflowRunId,
    user: {
      id: approval.respondedBy ?? "system",
    },
    log: log.child({ approvalId: approval.id, workflowId: approval.workflowId }),
    settings: {
      maxExecutionTimeMs: 60000,
      nodeTimeoutMs: 30000,
    },
  };

  // Calculate pause duration
  const pausedAtMs = approval.createdAt.getTime();

  const executionState = requireSerializableNodeInput(approval.executionState, approval.id);

  // Resume workflow
  const result = await resumeWorkflow(
    workflow,
    {
      nodeId: approval.nodeId,
      executionState,
      approved,
      pausedAtMs,
    },
    context
  );

  log.info(
    {
      approvalId: approval.id,
      workflowId: approval.workflowId,
      approved,
      success: result.success,
      blocked: result.blocked,
      paused: result.paused,
      durationMs: result.totalDurationMs,
    },
    "approvalService:resume:complete"
  );

  // Handle nested pause (another user_approval node)
  if (result.paused && result._pauseState) {
    log.info(
      { approvalId: approval.id, nextNodeId: result._pauseState.currentNodeId },
      "approvalService:resume:nestedPause"
    );

    // Create new approval for the nested user_approval node
    await createApproval(ctx, {
      workflowId: approval.workflowId,
      workflowKey: workflow.key,
      workflowRunId: approval.workflowRunId,
      orgId: approval.orgId,
      nodeId: result._pauseState.currentNodeId,
      pauseState: result._pauseState,
    });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map database row to ApprovalRecord.
 */
function mapApprovalRecord(row: typeof workflowApprovals.$inferSelect): ApprovalRecord {
  return {
    id: row.id,
    workflowId: row.workflowId,
    workflowRunId: row.workflowRunId,
    orgId: row.organizationId,
    nodeId: row.nodeId,
    message: row.message,
    status: row.status,
    executionState: isRecord(row.executionState) ? row.executionState : null,
    timeoutSeconds: row.timeoutSeconds,
    timeoutAction: row.timeoutAction,
    expiresAt: row.expiresAt,
    timeoutJobId: row.timeoutJobId,
    allowedRoles: row.allowedRoles,
    respondedBy: row.respondedBy,
    respondedAt: row.respondedAt,
    responseNote: row.responseNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
