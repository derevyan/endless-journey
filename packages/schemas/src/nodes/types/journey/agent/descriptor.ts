/**
 * Agent Node Descriptor (Base)
 */

import { AgentNodeDataSchema, AgentStateSchema, type AgentNodeData, type AgentState } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const agentNodeDescriptor: JourneyNodeDescriptor<AgentNodeData, AgentState> = {
  system: "journey",
  type: "agent",
  version: 1,
  displayName: "Agent",
  description: "Conversational agent with workflow capabilities",
  category: "action",

  schema: AgentNodeDataSchema,
  stateSchema: AgentStateSchema,
  capabilities: NODE_CAPABILITIES.agent,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [
      { id: "output", label: "Next" },
      { id: "timer", label: "Timeout", condition: "hasTimeout" },
    ],
  },

  createDefaultData: () => ({
    type: "agent",
    schemaVersion: 1,
    label: "Agent",
    workflowKey: "default-workflow",
    executionMode: "welcome_first",
    typingIndicatorEnabled: true,
  }),

  isType: (data): data is AgentNodeData => AgentNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(agentNodeDescriptor);
