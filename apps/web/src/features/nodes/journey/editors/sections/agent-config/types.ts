/**
 * Agent Config Shared Types
 *
 * Type definitions for shared agent configuration components.
 * Used by both journey agent node editor and workflow agent node config.
 *
 * @module features/nodes/journey/editors/sections/agent-config/types
 */

/**
 * Built-in tools configuration
 * Controls which tools are available to the agent
 */
export interface BuiltInToolsConfig {
  // Data Access
  getUserProfile?: boolean;
  getJourneyContext?: boolean;
  readJourneyVariables?: boolean;
  readUserVariables?: boolean;
  readMindstateParameters?: boolean;

  // Communication
  sendMessage?: boolean;

  // Journey Routing
  exitToNextNode?: boolean;

  // Legacy naming (workflow uses singular form)
  readJourneyVariable?: boolean;
  readUserVariable?: boolean;
  writeUserVariable?: boolean;

  // Memory tools (shared with MemoryConfig)
  saveMemory?: boolean;
  recallMemories?: boolean;
}

/**
 * Conversation history configuration
 */
export interface ConversationHistoryConfig {
  enabled?: boolean;
  strategy?: "none" | "simple" | "summarize" | "sliding_window";
  maxMessages?: number;
  /** When to trigger summarization (journey editor field) */
  triggerMessages?: number;
  /** How many recent messages to keep verbatim (journey editor field) */
  keepMessages?: number;
  /** Summarize after N messages (workflow config field) */
  summarizeAfter?: number;
  summarization?: {
    model?: string;
    maxTokens?: number;
    triggerThreshold?: number;
  };
}

/**
 * Memory configuration
 * Supports both journey editor naming and schema naming conventions
 */
export interface MemoryConfig {
  enabled?: boolean;
  /** Journey editor field name */
  autoInjectMemories?: boolean;
  /** Schema field name */
  autoInject?: boolean;
  /** Journey editor field name */
  maxMemoriesInContext?: number;
  /** Schema field name */
  maxMemories?: number;
  /** Schema field (not used in UI) */
  recencyBias?: number;
  /** Memory tool states (stored in tools config) */
  saveMemory?: boolean;
  recallMemories?: boolean;
}

/**
 * LLM configuration
 */
export interface LLMConfig {
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
}
