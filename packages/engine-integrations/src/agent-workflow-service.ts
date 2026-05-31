/**
 * Agent Workflow Service (DB + LLM Integration)
 *
 * Loads workflows from the database and executes them using @journey/llm.
 */

import { db, agentWorkflows, loadPromptWithType } from "@journey/db";
import { runWorkflow, registerBuiltinExecutors } from "@journey/llm/workflow";
import { createLogger } from "@journey/logger";
import { and, eq, inArray } from "drizzle-orm";
import type { AgentWorkflowService, LoadWorkflowOptions } from "@journey/engine";
import type { AgentWorkflow, WorkflowNode, PromptChatMessage } from "@journey/schemas";
import type { WorkflowContext } from "@journey/llm/workflow";

const log = createLogger("engine:workflow");

// =============================================================================
// Executor Registration
// =============================================================================

let executorsRegistered = false;

function ensureExecutorsRegistered(): void {
  if (!executorsRegistered) {
    registerBuiltinExecutors();
    executorsRegistered = true;
    log.debug({}, "workflow:executorsRegistered");
  }
}

// =============================================================================
// Prompt Resolution
// =============================================================================

/**
 * Resolve promptRef references in workflow agent nodes.
 * Loads prompt content from database and sets either systemPrompt (text) or chatMessages (chat).
 *
 * @param workflow - The workflow to process
 * @param orgId - Organization ID for prompt lookup
 * @returns Modified workflow with resolved prompts
 */
async function resolvePromptRefs(workflow: AgentWorkflow, orgId: string): Promise<AgentWorkflow> {
  const nodes = workflow.configuration.nodes;
  let resolvedCount = 0;

  for (const node of nodes) {
    // Skip non-agent nodes
    if (node.type !== "agent") continue;

    const agentData = node.data as WorkflowNode["data"] & {
      promptRef?: { name: string; versionId?: string; label?: string };
      systemPrompt?: string;
      chatMessages?: PromptChatMessage[];
    };

    // Skip if no promptRef or already has systemPrompt/chatMessages
    if (!agentData.promptRef || agentData.systemPrompt || agentData.chatMessages) continue;

    const { name, versionId, label } = agentData.promptRef;

    // Load prompt with type info from shared service
    // versionId takes precedence over label (defaults to "production" if neither set)
    const loadedPrompt = await loadPromptWithType(orgId, name, { versionId, label });
    if (loadedPrompt) {
      if (loadedPrompt.type === "chat" && loadedPrompt.chatContent) {
        // Chat prompt - set chatMessages array
        agentData.chatMessages = loadedPrompt.chatContent;
        log.debug({ nodeId: node.id, promptName: name, promptType: "chat", messageCount: loadedPrompt.chatContent.length }, "workflow:promptRef:resolved");
      } else if (loadedPrompt.type === "text" && loadedPrompt.textContent) {
        // Text prompt - set systemPrompt string
        agentData.systemPrompt = loadedPrompt.textContent;
        log.debug({ nodeId: node.id, promptName: name, promptType: "text" }, "workflow:promptRef:resolved");
      }
      resolvedCount++;
    }
  }

  if (resolvedCount > 0) {
    log.info({ workflowKey: workflow.key, resolvedCount }, "workflow:promptRefs:resolved");
  }

  return workflow;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating the workflow service
 */
export interface WorkflowServiceOptions {
  /** Skip executor registration (useful for testing) */
  skipExecutorRegistration?: boolean;
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Build the list of allowed workflow statuses based on options.
 * Defaults to only "active" workflows for security.
 */
function getAllowedStatuses(options?: LoadWorkflowOptions): Array<"draft" | "active" | "archived"> {
  const statuses: Array<"draft" | "active" | "archived"> = ["active"];
  if (options?.allowDrafts) statuses.push("draft");
  if (options?.allowArchived) statuses.push("archived");
  return statuses;
}

/**
 * Map database row to AgentWorkflow type
 */
function mapDbRowToWorkflow(row: typeof agentWorkflows.$inferSelect): AgentWorkflow {
  return {
    id: row.id,
    orgId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as "draft" | "active" | "archived",
    configuration: row.configuration as AgentWorkflow["configuration"],
    settings: (row.settings as AgentWorkflow["settings"]) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadWorkflowFromDb(
  orgId: string,
  workflowKey: string,
  options?: LoadWorkflowOptions
): Promise<AgentWorkflow | null> {
  log.debug({ orgId, workflowKey, options }, "workflow:load:start");
  const allowedStatuses = getAllowedStatuses(options);

  const rows = await db
    .select()
    .from(agentWorkflows)
    .where(
      and(
        eq(agentWorkflows.organizationId, orgId),
        eq(agentWorkflows.key, workflowKey),
        inArray(agentWorkflows.status, allowedStatuses)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    log.debug({ orgId, workflowKey }, "workflow:load:notFound");
    return null;
  }

  let workflow = mapDbRowToWorkflow(rows[0]);

  // Resolve promptRef references in agent nodes
  workflow = await resolvePromptRefs(workflow, orgId);

  log.info({ orgId, workflowKey, workflowId: workflow.id }, "workflow:loaded");
  return workflow;
}

// =============================================================================
// Service Factory
// =============================================================================

/**
 * Create an agent workflow service instance.
 *
 * @param options.skipExecutorRegistration - Skip registering built-in executors (for testing)
 *
 * @example
 * ```typescript
 * // Production usage
 * const service = createAgentWorkflowService();
 *
 * // Test usage (skip registration to avoid global state)
 * const service = createAgentWorkflowService({ skipExecutorRegistration: true });
 * ```
 */
export function createAgentWorkflowService(
  options: WorkflowServiceOptions = {}
): AgentWorkflowService {
  const shouldRegister = !options.skipExecutorRegistration;

  const service: AgentWorkflowService = {
    initialize: () => {
      if (shouldRegister) {
        ensureExecutorsRegistered();
      }
    },
    loadWorkflow: async ({ organizationId, workflowKey, options: loadOptions }) => {
      return loadWorkflowFromDb(organizationId, workflowKey, loadOptions);
    },
    runWorkflow: async ({ workflow, input, context }) => {
      if (shouldRegister) {
        ensureExecutorsRegistered();
      }
      log.debug({ workflowKey: workflow.key }, "workflow:run:start");
      // ConversationMessage[] from schemas is compatible with Message[] from workflow types
      // WorkflowResult is now directly compatible with AgentWorkflowRunResult
      // since both use AggregatedUsage from @journey/schemas
      const result = await runWorkflow(workflow, input as any, context as WorkflowContext);
      log.info({ workflowKey: workflow.key, success: result.success }, "workflow:run:complete");
      return result;
    },
  };

  return service;
}
