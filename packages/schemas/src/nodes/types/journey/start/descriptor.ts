/**
 * Start Node Descriptor (Base)
 */

import { StartNodeDataSchema, type StartNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const startNodeDescriptor: JourneyNodeDescriptor<StartNodeData> = {
  system: "journey",
  type: "start",
  version: 1,
  displayName: "Start",
  description: "Entry point of the journey",
  category: "flow",

  schema: StartNodeDataSchema,
  capabilities: NODE_CAPABILITIES.start,
  handles: {
    inputs: [],
    outputs: [{ id: "output", label: "Next" }],
  },

  createDefaultData: () => ({
    type: "start",
    schemaVersion: 1,
    label: "Start",
    content: "Welcome",
  }),

  isType: (data): data is StartNodeData => StartNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(startNodeDescriptor);
