/**
 * Wait Node Descriptor (Base)
 */

import { WaitNodeDataSchema, type WaitNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const waitNodeDescriptor: JourneyNodeDescriptor<WaitNodeData> = {
  system: "journey",
  type: "wait",
  version: 1,
  displayName: "Wait",
  description: "Pause the journey for a specified duration",
  category: "logic",

  schema: WaitNodeDataSchema,
  capabilities: NODE_CAPABILITIES.wait,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [{ id: "output", label: "Next" }],
  },

  createDefaultData: () => ({
    type: "wait",
    schemaVersion: 1,
    label: "Wait",
    duration: { seconds: 1 },
  }),

  isType: (data): data is WaitNodeData => WaitNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(waitNodeDescriptor);
