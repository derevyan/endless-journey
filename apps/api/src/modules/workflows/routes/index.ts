/**
 * Workflow Routes
 *
 * CRUD API for Agent Workflows, scoped to organizations.
 *
 * @module modules/workflows/routes
 */

import { z } from "zod";
import { createLogger } from "@journey/logger";
import {
  WorkflowNodeSchema,
  WorkflowEdgeSchema,
  WorkflowVariableSchema,
  WorkflowConfigurationSchema,
  WorkflowSettingsSchema,
  BadRequestError,
  NotFoundError,
} from "@journey/schemas";
import { runWorkflow } from "@journey/llm/workflow";
import { createAgentWorkflowService } from "@journey/engine-integrations";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson, validateQuery } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:workflows");

// ============================================================
// Validation Schemas
// ============================================================

const ListWorkflowsQuerySchema = z.object({
  status: z.enum(["draft", "active", "archived"]).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const CreateWorkflowBodySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9-]*$/, "Key must be lowercase, start with a letter, and contain only letters, numbers, and hyphens"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  configuration: WorkflowConfigurationSchema.optional(),
  settings: WorkflowSettingsSchema.nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
});

const UpdateWorkflowBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  configuration: WorkflowConfigurationSchema.optional(),
  settings: WorkflowSettingsSchema.nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

const ExecuteWorkflowBodySchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
  /** Force mock LLM responses for testing. */
  mockLlm: z.boolean().optional(),
  /** Optional node ID to start execution from (for testing specific parts) */
  startNodeId: z.string().optional(),
  mockContext: z
    .object({
      user: z
        .object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
        })
        .optional(),
      variables: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

const ValidateWorkflowBodySchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
});

// ============================================================
// Workflow Service (for execute endpoint)
// ============================================================

// Create workflow service instance for loading workflows with prompt resolution
// This reuses the same logic as the journey engine - single source of truth
const workflowService = createAgentWorkflowService();

// ============================================================
// Routes
// ============================================================

const workflows = createProtectedRouter({
  defaultPermission: { resource: "workflow", action: "read" },
});

/**
 * GET /workflows - List all workflows for current organization
 */
workflows.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, ListWorkflowsQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }
  const params = queryResult.data;

  const result = await services.workflow.listWorkflows(params);
  log.debug({ userId: user.id, organizationId: organization.id, total: result.total }, "workflows:list");
  return c.json(result);
});

/**
 * GET /workflows/:key - Get a specific workflow by key
 */
workflows.get("/:key", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);
  const key = c.req.param("key");

  const workflow = await services.workflow.getWorkflowByKey(key);
  if (!workflow) {
    throw new NotFoundError("Workflow", key);
  }

  log.debug({ userId: user.id, organizationId: organization.id, workflowKey: key }, "workflows:get");
  return c.json({ workflow });
});

/**
 * POST /workflows - Create a new workflow
 */
workflows.post(
  "/",
  protect({ permission: { resource: "workflow", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateWorkflowBodySchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const workflow = await services.workflow.createWorkflow(user.id, {
      ...data,
      configuration: data.configuration ?? { nodes: [], edges: [] },
      settings: data.settings ?? undefined,
    });

    log.info({ userId: user.id, organizationId: organization.id, workflowId: workflow.id, key: workflow.key }, "workflows:create");
    return c.json({ workflow }, 201);
  }
);

/**
 * PUT /workflows/:key - Update a workflow
 */
workflows.put(
  "/:key",
  protect({ permission: { resource: "workflow", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);
    const key = c.req.param("key");

    const parseResult = await validateJson(c, UpdateWorkflowBodySchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const workflow = await services.workflow.updateWorkflow(user.id, key, data);

    log.info({ userId: user.id, organizationId: organization.id, workflowId: workflow.id, key }, "workflows:update");
    return c.json({ workflow });
  }
);

/**
 * DELETE /workflows/:key - Delete (archive) a workflow
 */
workflows.delete(
  "/:key",
  protect({ permission: { resource: "workflow", action: "delete" } }),
  async (c) => {
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);
    const key = c.req.param("key");
    const force = c.req.query("force") === "true";

    await services.workflow.deleteWorkflow(key, force);

    log.info({ organizationId: organization.id, key, force }, "workflows:delete");
    return c.body(null, 204);
  }
);

/**
 * POST /workflows/:key/execute - Execute workflow for testing
 */
workflows.post(
  "/:key/execute",
  protect({ permission: { resource: "workflow", action: "execute" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const key = c.req.param("key");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, ExecuteWorkflowBodySchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    // Load workflow with prompt resolution (uses same logic as journey engine)
    // allowDrafts: true - allow testing draft workflows
    // allowArchived: true - so we can return a specific error for archived workflows
    const workflow = await workflowService.loadWorkflow({
      organizationId: organization.id,
      workflowKey: key,
      options: { allowDrafts: true, allowArchived: true },
    });
    if (!workflow) {
      throw new NotFoundError("Workflow", key);
    }

    if (workflow.status === "archived") {
      throw new BadRequestError("Workflow is archived", { code: "WORKFLOW_ARCHIVED" });
    }

    // Create mock context for testing
    const mockUser = data.mockContext?.user || {};
    const sessionId = data.conversationId || crypto.randomUUID();

    // Create workflow event emitter for real-time SSE updates
    const emit = services.workflow.createWorkflowEmitter({
      organizationId: organization.id,
      sessionId: null, // No real session for workflow test
      journeyId: "",
      clientId: null, // No real client for workflow test
      performedBy: user.id,
      triggeredBy: "manual",
      workflowKey: key,
    });

    const workflowContext = {
      orgId: organization.id,
      sessionId,
      user: {
        id: user.id,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        email: mockUser.email || user.email,
        metadata: {},
      },
      // Add journey context so mockContext.variables reach the workflow runner
      // Runner reads from context.journey?.variables (runner.ts:352)
      // Using empty strings for test context - usage tracking service will skip invalid UUIDs
      journey: {
        journeyId: "",
        currentNodeId: "",
        variables: data.mockContext?.variables || {},
        tags: [],
      },
      log: log.child({ workflowKey: key }),
      settings: {
        maxExecutionTimeMs: 60000, // 1 minute for testing
        nodeTimeoutMs: 30000,
        mockLlm: data.mockLlm ?? process.env.FORCE_MOCK_LLM === "true",
      },
      emit, // Wire in the event emitter for real-time updates
    };

    // Execute workflow
    const result = await runWorkflow(
      {
        ...workflow,
        key: workflow.key,
      },
      {
        message: data.message,
        conversationHistory: (data.conversationHistory || []).map((m) => ({
          ...m,
          timestamp: new Date(),
        })),
        startNodeId: data.startNodeId,
      },
      workflowContext
    );

    log.info(
      {
        userId: user.id,
        organizationId: organization.id,
        workflowKey: key,
        success: result.success,
        blocked: result.blocked,
        nodesExecuted: result.trace.length,
        durationMs: result.totalDurationMs,
      },
      "workflows:execute"
    );

    return c.json({
      message: result.response || (result.blocked ? result.blockedMessage : "No response"),
      conversationId: sessionId,
      executionTrace: {
        status: result.success ? "completed" : result.blocked ? "blocked" : "error",
        durationMs: result.totalDurationMs,
        nodesExecuted: result.trace,
        path: result.trace.map((t) => t.nodeId),
      },
      variables: result.variables,
    });
  }
);

/**
 * POST /workflows/:key/validate - Validate workflow configuration
 */
workflows.post("/:key/validate", async (c) => {
  const services = createServicesFromContext(c);

  const parseResult = await validateJson(c, ValidateWorkflowBodySchema);
  if (!parseResult.success) {
    return parseResult.response;
  }
  const { nodes, edges } = parseResult.data;

  const validation = await services.workflow.validateWorkflowConfig(nodes, edges);
  const hasStart = nodes.some((n) => n.type === "start");
  const hasEnd = nodes.some((n) => n.type === "end");
  const hasCycles = validation.errors.some((error) => error.code === "CYCLE_DETECTED");
  const hasUnreachableNodes = validation.warnings.some((warning) => warning.code === "UNREACHABLE_NODE");
  const isConnected = hasStart && !hasUnreachableNodes;

  return c.json({
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    graphAnalysis: {
      hasStart,
      hasEnd,
      isConnected,
      hasCycles,
    },
  });
});

export { workflows };
