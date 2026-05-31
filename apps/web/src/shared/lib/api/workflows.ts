/**
 * Workflows API
 *
 * Operations for agent workflow CRUD and execution.
 *
 * @module lib/api/workflows
 */

import { apiUrl, authFetch, authFetchRaw, log } from "./base";
import { serializeError } from "@journey/logger";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowStatus,
  WorkflowConfiguration,
  WorkflowSettings,
} from "@journey/schemas";

// =============================================================================
// TYPES
// =============================================================================

/** Workflow summary returned by list endpoint */
export interface WorkflowSummary {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  nodeCount: number;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Full workflow data (matches API response) */
export interface Workflow {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  configuration: WorkflowConfiguration;
  settings: WorkflowSettings | null;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating a workflow */
export interface CreateWorkflowInput {
  key: string;
  name: string;
  description?: string;
  configuration?: WorkflowConfiguration;
  settings?: WorkflowSettings | null;
  status?: WorkflowStatus;
}

/** Input for updating a workflow */
export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  configuration?: WorkflowConfiguration;
  settings?: WorkflowSettings | null;
  status?: WorkflowStatus;
}

/** Workflow list response */
export interface WorkflowListResponse {
  workflows: WorkflowSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** Workflow execution trace entry */
export interface WorkflowTraceEntry {
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  error?: string;
  outputHandle?: string;
}

/** Workflow execution result */
export interface WorkflowExecutionResult {
  message: string;
  conversationId: string;
  executionTrace: {
    status: "completed" | "blocked" | "error";
    durationMs: number;
    nodesExecuted: WorkflowTraceEntry[];
    path: string[];
  };
  variables: Record<string, unknown>;
}

/** Workflow validation result */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
  graphAnalysis: {
    hasStart: boolean;
    hasEnd: boolean;
    isConnected: boolean;
    hasCycles: boolean;
  };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

export const workflowsApi = {
  /**
   * List all workflows for the organization
   */
  async list(params?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<WorkflowListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));

    const queryString = searchParams.toString();
    const url = `${apiUrl}/api/workflows${queryString ? `?${queryString}` : ""}`;

    return authFetch<WorkflowListResponse>(url, undefined, { action: "listWorkflows" });
  },

  /**
   * Get a workflow by key
   */
  async get(key: string): Promise<Workflow | null> {
    const res = await authFetchRaw(
      `${apiUrl}/api/workflows/${key}`,
      undefined,
      { action: "getWorkflow", logContext: { key } }
    );

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const error = new Error(`Failed to get workflow: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:getWorkflow:error");
      throw error;
    }

    const data = await res.json();
    return data.workflow;
  },

  /**
   * Create a new workflow
   */
  async create(input: CreateWorkflowInput): Promise<Workflow> {
    const data = await authFetch<{ workflow: Workflow }>(
      `${apiUrl}/api/workflows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "createWorkflow", logContext: { key: input.key } }
    );
    log.info({ key: input.key }, "apiClient:createWorkflow:success");
    return data.workflow;
  },

  /**
   * Update a workflow
   */
  async update(key: string, input: UpdateWorkflowInput): Promise<Workflow> {
    const res = await authFetchRaw(
      `${apiUrl}/api/workflows/${key}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "updateWorkflow", logContext: { key } }
    );

    if (res.status === 404) {
      throw new Error("Workflow not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to update workflow: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:updateWorkflow:error");
      throw error;
    }

    const data = await res.json();
    log.info({ key }, "apiClient:updateWorkflow:success");
    return data.workflow;
  },

  /**
   * Delete a workflow (archives it)
   */
  async delete(key: string, force = false): Promise<void> {
    const url = force ? `${apiUrl}/api/workflows/${key}?force=true` : `${apiUrl}/api/workflows/${key}`;
    const res = await authFetchRaw(
      url,
      { method: "DELETE" },
      { action: "deleteWorkflow", logContext: { key } }
    );

    if (res.status === 404) {
      throw new Error("Workflow not found");
    }

    if (!res.ok) {
      const error = new Error(`Failed to delete workflow: ${res.status}`);
      log.error({ key, status: res.status, err: serializeError(error) }, "apiClient:deleteWorkflow:error");
      throw error;
    }

    log.info({ key }, "apiClient:deleteWorkflow:success");
  },

  /**
   * Execute a workflow for testing
   */
  async execute(
    key: string,
    input: {
      message: string;
      conversationId?: string;
      conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
      /** Force mock LLM responses for testing. */
      mockLlm?: boolean;
      /** Optional node ID to start execution from (for testing specific parts) */
      startNodeId?: string;
      mockContext?: Record<string, unknown>;
    }
  ): Promise<WorkflowExecutionResult> {
    const data = await authFetch<WorkflowExecutionResult>(
      `${apiUrl}/api/workflows/${key}/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "executeWorkflow", logContext: { key } }
    );
    log.info({ key, status: data.executionTrace.status }, "apiClient:executeWorkflow:success");
    return data;
  },

  /**
   * Validate a workflow configuration
   */
  async validate(key: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): Promise<WorkflowValidationResult> {
    return authFetch<WorkflowValidationResult>(
      `${apiUrl}/api/workflows/${key}/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      },
      { action: "validateWorkflow", logContext: { key } }
    );
  },
};
