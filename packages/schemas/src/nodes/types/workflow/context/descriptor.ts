/**
 * Workflow Context Node Descriptor (Base)
 */

import { ContextNodeConfigSchema, type ContextNodeConfig } from "../../../../agents/workflow/nodes/tools";
import type { WorkflowNodeDescriptor } from "../../../descriptor";
import { workflowNodeDescriptorRegistry } from "../../../workflow-descriptor-registry";
import { buildWorkflowHandles } from "../shared";

export const workflowContextNodeDescriptor: WorkflowNodeDescriptor<ContextNodeConfig> = {
  system: "workflow",
  type: "context",
  version: 1,
  displayName: "Context",
  description: "Inject knowledge base, memory, or RAG context",
  category: "tools",
  size: "compact",

  schema: ContextNodeConfigSchema,
  handles: buildWorkflowHandles("context"),

  createDefaultData: () => ({
    sources: [
      {
        type: "memory",
        maxResults: 10,
        autoInject: true,
        recencyBias: 0.3,
      },
    ],
    _experimental: true,
  }),

  isType: (data): data is ContextNodeConfig => ContextNodeConfigSchema.safeParse(data).success,
};

workflowNodeDescriptorRegistry.register(workflowContextNodeDescriptor);
