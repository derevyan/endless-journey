/**
 * Teleport Node Descriptor (Base)
 */

import { TeleportNodeDataSchema, type TeleportNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const teleportNodeDescriptor: JourneyNodeDescriptor<TeleportNodeData> = {
  system: "journey",
  type: "teleport",
  version: 1,
  displayName: "Teleport",
  description: "Transfer user to another journey",
  category: "logic",

  schema: TeleportNodeDataSchema,
  capabilities: NODE_CAPABILITIES.teleport,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [],
  },

  createDefaultData: () => ({
    type: "teleport",
    schemaVersion: 1,
    label: "Teleport",
    // targetJourneyId intentionally omitted - user must select via cascading UI
    preserveContext: true,
  }),

  isType: (data): data is TeleportNodeData => TeleportNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(teleportNodeDescriptor);
