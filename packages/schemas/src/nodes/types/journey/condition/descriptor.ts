/**
 * Condition Node Descriptor (Base)
 */

import { ConditionNodeDataSchema, type ConditionNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const conditionNodeDescriptor: JourneyNodeDescriptor<ConditionNodeData> = {
  system: "journey",
  type: "condition",
  version: 1,
  displayName: "Condition",
  description: "Branch based on user data or expressions",
  category: "logic",

  schema: ConditionNodeDataSchema,
  capabilities: NODE_CAPABILITIES.condition,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [{ id: "branch", label: "Branch", condition: "branch.id (dynamic)" }],
  },

  createDefaultData: () => ({
    type: "condition",
    schemaVersion: 1,
    label: "Condition",
    rulesOperator: "and",
    rules: [{ field: "userResponse.value", operator: "equals", value: "" }],
    branches: [
      { id: "branch-1", label: "Yes" },
      { id: "branch-2", label: "No", isDefault: true },
    ],
  }),

  isType: (data): data is ConditionNodeData => ConditionNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(conditionNodeDescriptor);
