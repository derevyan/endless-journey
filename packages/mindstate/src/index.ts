/**
 * @journey/mindstate
 *
 * Core package for the MindState Engine - a "Theory of Mind" ECS system
 * that tracks and analyzes user psychological state in real-time.
 *
 * Integrates with @journey/llm for LLM abstraction and @journey/schemas for types.
 */

// ============================================================================
// PUBLIC API - Stable exports
// ============================================================================

// Main pipeline functions
export { createPipeline, executePipeline, isPipelineError } from "./pipeline/orchestrator";

// Types for pipeline users
export type {
  PipelineContext,
  PipelineInput,
  PipelineResult,
  PipelineOptions,
  PipelineHooks,
  PipelineError,
  Message,
  StateUpdateOutput,
} from "./types";

// ============================================================================
// Re-exports from schemas for convenience
// ============================================================================

export type {
  StateParameter,
  SystemAgent,
  MainAgent,
  AgentInsight,
  PipelineMetrics,
  TokenUsage,
  StateChange,
  StateParameterValue,
} from "./types";
