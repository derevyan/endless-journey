/**
 * End Node Descriptor (Base)
 */

import { EndNodeDataSchema, type EndNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const endNodeDescriptor: JourneyNodeDescriptor<EndNodeData> = {
  system: "journey",
  type: "end",
  version: 1,
  displayName: "End",
  description: "Exit point of the journey",
  category: "flow",

  schema: EndNodeDataSchema,
  capabilities: NODE_CAPABILITIES.end,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [],
  },

  createDefaultData: () => ({
    type: "end",
    schemaVersion: 1,
    label: "End",
    content: "",
  }),

  isType: (data): data is EndNodeData => EndNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(endNodeDescriptor);
