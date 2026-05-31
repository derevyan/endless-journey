/**
 * @module @journey/engine-integrations
 *
 * Production implementations of @journey/engine service interfaces,
 * backed by PostgreSQL database and LLM integrations.
 *
 * This package provides:
 * - **AgentWorkflowService** - Load and execute agent workflows from database
 * - **MemoryService** - Long-term semantic memory with pgvector
 * - **buildAgentMiddleware** - Convert config to middleware pipeline
 *
 * @example
 * ```typescript
 * import { createEngineIntegrations } from "@journey/engine-integrations";
 *
 * // Create bundle with all services
 * const integrations = createEngineIntegrations({
 *   clientId: "user-123",
 *   organizationId: "org-456",
 *   journeyId: "journey-789", // optional
 * });
 *
 * // Use with SessionEngine
 * const engine = new SessionEngine(session, journey, adapter, {
 *   agentWorkflowService: integrations.agentWorkflowService,
 *   memoryService: integrations.memoryService,
 * });
 * ```
 *
 * @packageDocumentation
 */

export {
  createAgentWorkflowService,
  type WorkflowServiceOptions,
} from "./agent-workflow-service";
export {
  createNodeOutputsStore,
  type NodeOutputsStore,
  type NodeOutputsMap,
} from "./node-outputs-store";
export {
  loadConversation,
  appendToConversation,
  deleteConversation,
  searchConversations,
  getConversationMetadata,
  conversationExists,
} from "./conversation-document-store";
export { createEngineIntegrations, type EngineIntegrationBundle } from "./engine-integrations";

export { createFollowUpAIService } from "./follow-up-ai-service";

export { buildAgentMiddleware } from "./build-agent-middleware";

export {
  // Core operations
  saveMemory,
  searchMemories,
  getRecentMemories,
  getMemory,
  deleteMemory,
  // New operations (Phase 2)
  memoryExists,
  getAllMemories,
  clearMemories,
  // Batch operations
  saveMemories,
  deleteMemories,
  // Factory
  createMemoryService,
  // Types
  type SaveMemoryParams,
  type SearchMemoriesParams,
  type RecentMemoriesParams,
  type GetAllMemoriesParams,
  type ClearMemoriesParams,
  type BatchSaveMemoryParams,
  type MemoryServiceContext,
  type MemoryService,
} from "./memory-service";

export type { MemorySearchResult, MemoryResult, IMemoryService } from "@journey/schemas";
