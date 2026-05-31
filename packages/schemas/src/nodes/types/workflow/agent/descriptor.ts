/**
 * Workflow Agent Node Descriptor (Base)
 */

import { llmConfig } from "../../../../config";
import { AgentNodeConfigSchema, type AgentNodeConfig } from "../../../../agents/workflow/nodes/core";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowAgentNodeDescriptor: WorkflowNodeDescriptor<AgentNodeConfig> = {
  system: "workflow",
  type: "agent",
  version: 1,
  displayName: "Agent",
  description: "LLM agent execution with tools and memory",
  category: "core",
  size: "standard",

  schema: AgentNodeConfigSchema,
  handles: buildWorkflowHandles("agent"),

  createDefaultData: () => ({
    promptSource: "inline",
    systemPrompt: "You are a helpful assistant.",
    llm: {
      provider: llmConfig.agent.model.provider,
      model: llmConfig.agent.model.id,
      temperature: 0.7,
      reasoningEffort: llmConfig.agent.reasoningEffort,
    },
    unifiedTools: { enabled: [] },
    history: { strategy: "simple", maxMessages: 12 },
    messageSource: "auto",
    enableQuickReplies: false,
  }),

  isType: (data): data is AgentNodeConfig => AgentNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowAgentNodeDescriptor);
