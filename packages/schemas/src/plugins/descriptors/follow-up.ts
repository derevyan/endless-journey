/**
 * Follow-Up Plugin Descriptor (Base)
 */

import { FollowUpPluginDataSchema, type FollowUpPluginData } from "../follow-up";
import { isFollowUpPluginData } from "../type-guards";
import type { PluginDescriptorBase } from "../descriptor";
import { pluginCompatibilityRegistry } from "../compatibility-registry";

export const followUpPluginDescriptor: PluginDescriptorBase<FollowUpPluginData> = {
  pluginType: "followup",
  version: 1,
  displayName: "Follow-Up",
  description: "Timed reminder sequences sent when user doesn't respond",

  schema: FollowUpPluginDataSchema,

  compatibility: {
    compatibleNodeTypes: ["message", "agent", "questionnaire"],
    maxInstancesPerNode: 1,
    canBeChained: false,
    requiredCapabilities: ["hasFollowUp"],
  },

  createDefaultData: () => ({
    pluginType: "followup",
    label: "Follow-Up",
    enabled: true,
    steps: [],
    cancelOnAnyResponse: true,
  }),

  isType: (data): data is FollowUpPluginData => isFollowUpPluginData(data),
};

pluginCompatibilityRegistry.register({
  pluginType: followUpPluginDescriptor.pluginType,
  ...followUpPluginDescriptor.compatibility,
});
