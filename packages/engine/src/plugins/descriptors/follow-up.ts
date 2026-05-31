/**
 * Follow-Up Plugin Backend Descriptor
 */

import { followUpPluginDescriptor, type FollowUpPluginData } from "@journey/schemas";

import { createFollowUpPluginHandler } from "../follow-up-plugin-handler";
import { backendPluginRegistry, type BackendPluginDescriptor } from "../backend-plugin-descriptor";

const followUpHandler = createFollowUpPluginHandler();

export const followUpBackendDescriptor: BackendPluginDescriptor<FollowUpPluginData> = {
  ...followUpPluginDescriptor,
  execution: followUpHandler,
  lifecycle: {
    async onActivate(context) {
      context.log.debug(
        { pluginId: context.pluginId, nodeId: context.node.id, pluginType: context.plugin.pluginType },
        "plugin:followup:activated"
      );
    },
    async onDeactivate(context) {
      context.log.debug(
        { pluginId: context.pluginId, nodeId: context.node.id, pluginType: context.plugin.pluginType },
        "plugin:followup:deactivated"
      );
    },
  },
};

backendPluginRegistry.register(followUpBackendDescriptor);
