/**
 * Built-in Tools Type Definitions
 *
 * Defines context types required by built-in agent tools.
 * Built-in tools need execution context (services, session, etc.)
 * to function, unlike embedded tools which are context-free.
 *
 * Uses SharedServiceContext from @journey/schemas for unified
 * service access across all execution contexts.
 *
 * @module tools/builtin/types
 */

import type {
  AgentToolAny,
  SharedServiceContext,
  MemorySearchResult,
  MemoryResult,
  ToolRetryConfig,
  VoiceMode,
} from "@journey/schemas";

type AgentTool = AgentToolAny;

// Re-export service types from schemas
export type { MemorySearchResult, MemoryResult, ToolRetryConfig } from "@journey/schemas";

/**
 * Session data interface
 */
export interface SessionData {
  sessionId: string;
  journeyId: string;
  userId: string;
  currentNodeId: string;
  tags?: string[];
  context?: Record<string, unknown>;
  nodeOutputs?: Record<string, unknown>;
}

/**
 * Client data interface
 */
export interface ClientData {
  id?: string;
  platform?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

/**
 * Logger interface (subset of @journey/logger)
 */
export interface Logger {
  debug: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

/**
 * Security configuration for variable access
 */
export interface SecurityConfig {
  /** Exact variable names to protect */
  protectedVariables?: string[];
  /** Regex patterns to match protected variables */
  protectedPatterns?: string[];
  /** Whether to log tool calls */
  logToolCalls?: boolean;
}

/**
 * Context required by built-in tools
 *
 * Uses SharedServiceContext for unified service access that is
 * consistent with ExecutionContext and WorkflowContext.
 *
 * This is a minimal interface that can be built from ExecutionContext
 * in the engine package, keeping the llm package independent.
 */
export interface BuiltinToolContext {
  /** Current node ID for logging */
  nodeId: string;
  /** Unified service context for all service access */
  services: SharedServiceContext;
  /** Session data */
  session: SessionData;
  /** Client data (optional) */
  clientData?: ClientData;
  /** Logger instance */
  log: Logger;
  /** Security configuration */
  security?: SecurityConfig;
  /** Voice output mode from journey agent node (for TTS) */
  voiceMode?: VoiceMode;
  /** Voice profile (TTS voice) to use for voice responses */
  voiceProfile?: string;
  /** Voice provider (openai or elevenlabs) */
  voiceProvider?: "openai" | "elevenlabs";
  /** ElevenLabs model to use for TTS (when voiceProvider is elevenlabs) */
  elevenLabsModel?: string;
}

/**
 * Factory function type for creating built-in tools
 */
export type ToolFactory = (context: BuiltinToolContext) => AgentTool;

/**
 * Default retry config for tools that interact with services
 * Retries on transient errors (network, connection, timeout)
 * (ToolRetryConfig type is imported from @journey/schemas to avoid duplication)
 */
export const defaultServiceRetryConfig: ToolRetryConfig = {
  maxRetries: 2,
  initialDelayMs: 500,
  backoffFactor: 2.0,
  retryOn: (error: Error) => {
    const message = error.message.toLowerCase();
    return (
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("socket")
    );
  },
};
