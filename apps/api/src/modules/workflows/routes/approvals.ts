/**
 * Workflow Approval Routes
 *
 * API endpoints for managing workflow user approvals.
 * Allows listing pending approvals and responding to them.
 *
 * @module modules/workflows/routes/approvals
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, NotFoundError, type ApprovalStatus, type ApprovalRecord } from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson, validateQuery } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:workflow-approvals");

// ============================================================
// Validation Schemas
// ============================================================

const ListApprovalsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "timed_out"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const RespondToApprovalBodySchema = z.object({
  approved: z.boolean(),
  note: z.string().max(1000).optional(),
});

// ============================================================
// Router
// ============================================================

export const workflowApprovals = createProtectedRouter({
  defaultPermission: { resource: "workflow", action: "read" },
});

/**
 * GET /workflows/approvals - List pending approvals for organization
 */
workflowApprovals.get("/", async (c) => {
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, ListApprovalsQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }
  const { status, limit, offset } = queryResult.data;

  const result = await services.workflow.listApprovals({
    status,
    limit,
    offset,
  });

  log.debug(
    { organizationId: organization.id, total: result.total, returned: result.approvals.length },
    "workflowApprovals:list"
  );

  return c.json({
    approvals: result.approvals.map(formatApprovalResponse),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
});

/**
 * GET /workflows/approvals/:id - Get a specific approval
 */
workflowApprovals.get("/:id", async (c) => {
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);
  const id = c.req.param("id");

  const approval = await services.workflow.getApproval(id);
  if (!approval) {
    throw new NotFoundError("Approval", id);
  }

  log.debug({ organizationId: organization.id, approvalId: id }, "workflowApprovals:get");

  return c.json(formatApprovalResponse(approval));
});

/**
 * POST /workflows/approvals/:id/respond - Approve or reject
 */
workflowApprovals.post(
  "/:id/respond",
  protect({ permission: { resource: "workflow", action: "execute" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);
    const id = c.req.param("id");

    const parseResult = await validateJson(c, RespondToApprovalBodySchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const { approved, note } = parseResult.data;

    // Get user roles from organization context
    const userRoles: string[] = organization.role ? [organization.role] : [];

    try {
      const result = await services.workflow.respondToApproval(
        id,
        user.id,
        userRoles,
        { approved, note }
      );

      log.info(
        {
          organizationId: organization.id,
          userId: user.id,
          approvalId: id,
          approved,
        },
        "workflowApprovals:respond"
      );

      return c.json(formatApprovalResponse(result));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      log.error(
        { err: serializeError(error), approvalId: id },
        "workflowApprovals:respond:error"
      );

      const message = error instanceof Error ? error.message : "Failed to respond to approval";
      throw new BadRequestError(message);
    }
  }
);

// ============================================================
// Response Formatters
// ============================================================

interface ApprovalResponseFormat {
  id: string;
  workflowId: string;
  workflowRunId: string;
  nodeId: string;
  message: string;
  status: ApprovalStatus;
  timeoutSeconds: number | null;
  timeoutAction: string | null;
  expiresAt: string | null;
  allowedRoles: string[] | null;
  respondedBy: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatApprovalResponse(approval: ApprovalRecord): ApprovalResponseFormat {
  return {
    id: approval.id,
    workflowId: approval.workflowId,
    workflowRunId: approval.workflowRunId,
    nodeId: approval.nodeId,
    message: approval.message,
    status: approval.status,
    timeoutSeconds: approval.timeoutSeconds,
    timeoutAction: approval.timeoutAction,
    expiresAt: approval.expiresAt?.toISOString() ?? null,
    allowedRoles: approval.allowedRoles,
    respondedBy: approval.respondedBy,
    respondedAt: approval.respondedAt?.toISOString() ?? null,
    responseNote: approval.responseNote,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
  };
}

export { workflowApprovals as workflowApprovalsRouter };
