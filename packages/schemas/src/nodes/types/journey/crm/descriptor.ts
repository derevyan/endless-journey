/**
 * CRM Node Descriptor (Base)
 */

import { CrmNodeDataSchema, type CrmNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const crmNodeDescriptor: JourneyNodeDescriptor<CrmNodeData> = {
  system: "journey",
  type: "crm",
  version: 1,
  displayName: "CRM",
  description: "Update client position in CRM pipelines",
  category: "integration",

  schema: CrmNodeDataSchema,
  capabilities: NODE_CAPABILITIES.crm,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [{ id: "output", label: "Next" }],
  },

  createDefaultData: () => ({
    type: "crm",
    schemaVersion: 1,
    label: "CRM",
  }),

  isType: (data): data is CrmNodeData => CrmNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(crmNodeDescriptor);
