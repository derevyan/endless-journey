import { z } from "zod";
import { LLMProviderSchema } from "../../llm/providers";
import { AGENT_MODEL } from "../../config/llm/models";

// =============================================================================
// WORKFLOW SETTINGS
// =============================================================================

/**
 * Default LLM configuration for workflow.
 * Applied to new agent nodes when created.
 */
export const WorkflowDefaultLLMSchema = z.object({
  provider: LLMProviderSchema.default(AGENT_MODEL.provider),
  model: z.string().min(1).max(100).default(AGENT_MODEL.id),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(128000).default(2048),
});

/**
 * Execution settings for workflow.
 * Controls timeouts and iteration limits.
 */
export const WorkflowExecutionSettingsSchema = z.object({
  timeoutSeconds: z.number().int().min(10).max(3600).default(300),
  maxIterations: z.number().int().min(1).max(100).default(50),
});

/**
 * Workflow-level settings - persistent configuration.
 * Analogous to JourneyMindstateConfig in journeys.
 *
 * These settings are stored in the database and applied workflow-wide.
 */
export const WorkflowSettingsSchema = z.object({
  /** Default LLM configuration applied to new agent nodes */
  defaultLlm: WorkflowDefaultLLMSchema.optional(),

  /** Execution settings for the workflow */
  execution: WorkflowExecutionSettingsSchema.optional(),
});

export type WorkflowDefaultLLM = z.infer<typeof WorkflowDefaultLLMSchema>;
export type WorkflowExecutionSettings = z.infer<typeof WorkflowExecutionSettingsSchema>;
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;
