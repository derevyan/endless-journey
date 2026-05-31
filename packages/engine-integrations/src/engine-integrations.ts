/**
 * Default integration bundle for SessionEngine.
 *
 * Provides production implementations of engine service interfaces
 * backed by database and LLM integrations.
 */

import type { AgentWorkflowService, FollowUpAIService } from "@journey/engine";
import type { IMemoryService } from "@journey/schemas";
import { createAgentWorkflowService } from "./agent-workflow-service";
import { createFollowUpAIService } from "./follow-up-ai-service";
import { createMemoryService } from "./memory-service";

export interface EngineIntegrationBundle {
  agentWorkflowService: AgentWorkflowService;
  memoryService: IMemoryService;
  followUpAIService: FollowUpAIService;
}

/**
 * Create engine integration bundle with all production service implementations.
 *
 * @param params.clientId - Client ID for memory scoping
 * @param params.organizationId - Organization ID for multi-tenancy
 * @param params.journeyId - Optional journey ID for memory isolation
 *
 * @note Memory service uses params for scoping all operations.
 * Workflow and conversation services receive context at method call time
 * (organizationId for workflow queries, sessionId for conversations).
 *
 * @example
 * ```typescript
 * const integrations = createEngineIntegrations({
 *   clientId: "user-123",
 *   organizationId: "org-456",
 *   journeyId: "journey-789", // optional
 * });
 *
 * const engine = new SessionEngine(session, journey, adapter, {
 *   agentWorkflowService: integrations.agentWorkflowService,
 *   memoryService: integrations.memoryService,
 * });
 * ```
 */
export function createEngineIntegrations(params: {
  clientId: string;
  organizationId: string;
  /** Optional journey ID to scope memory operations */
  journeyId?: string;
}): EngineIntegrationBundle {
  return {
    agentWorkflowService: createAgentWorkflowService(),
    memoryService: createMemoryService({
      clientId: params.clientId,
      organizationId: params.organizationId,
      journeyId: params.journeyId,
    }),
    followUpAIService: createFollowUpAIService(),
  };
}
