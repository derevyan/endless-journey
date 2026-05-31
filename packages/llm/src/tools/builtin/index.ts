/**
 * Built-in Tools Index
 *
 * Exports all built-in tool implementations for AI agents.
 * These tools require execution context (services, session, etc.)
 * to function, unlike embedded tools which are context-free.
 *
 * Use `unifiedToolRegistry.resolveTools()` to load tools by ID.
 *
 * @module tools/builtin
 */

// Types from local types file
export type {
  BuiltinToolContext,
  MemorySearchResult,
  MemoryResult,
  SessionData,
  ClientData,
  Logger,
  SecurityConfig,
  ToolFactory,
  ToolRetryConfig,
} from "./types";

// Re-export service interfaces from @journey/schemas for convenience
export type {
  IVariableService,
  IMessengerService,
  IMemoryService,
  IMindstateService,
  SharedServiceContext,
} from "@journey/schemas";

export { defaultServiceRetryConfig } from "./types";

// Variable tools
export {
  createJourneyVariableTool,
  createUserVariableTool,
  createMindstateParameterTool,
  createWriteJourneyVariableTool,
  createWriteUserVariableTool,
  buildVariableTools,
} from "./variable-tools";

// Tag tools
export {
  createAddUserTagsTool,
  createRemoveUserTagsTool,
  createGetUserTagsTool,
  buildTagTools,
} from "./tag-tools";

// Pipeline tools
export {
  createMoveToPipelineStageTool,
  createGetPipelinePositionTool,
  buildPipelineTools,
} from "./pipeline-tools";

// Context tools
export { createUserProfileTool, createJourneyContextTool, buildContextTools } from "./context-tools";

// Messaging and Journey Routing tools
export { createSendMessageTool, createExitToNextNodeTool, buildMessagingTools } from "./messaging-tools";

// Memory tools
export { createSaveMemoryTool, createRecallMemoriesTool, buildMemoryTools } from "./memory-tools";

// Journey tools
export { createStartJourneyTool, createListJourneysTool, createGetActiveJourneysTool, buildJourneyTools } from "./journey-tools";
