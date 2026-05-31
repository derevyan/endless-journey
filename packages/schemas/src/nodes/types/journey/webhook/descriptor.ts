/**
 * Webhook Node Descriptor (Base)
 */

import { WebhookNodeDataSchema, type WebhookNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const webhookNodeDescriptor: JourneyNodeDescriptor<WebhookNodeData> = {
  system: "journey",
  type: "webhook",
  version: 1,
  displayName: "Webhook",
  description: "Make API calls to external services",
  category: "integration",

  schema: WebhookNodeDataSchema,
  capabilities: NODE_CAPABILITIES.webhook,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [
      { id: "success", label: "Success" },
      { id: "error", label: "Error" },
    ],
  },

  createDefaultData: () => ({
    type: "webhook",
    schemaVersion: 1,
    label: "Webhook",
    url: "https://example.com",
    method: "POST",
    errorHandling: "continue",
    retryCount: 0,
    timeoutMs: 30000,
  }),

  isType: (data): data is WebhookNodeData => WebhookNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(webhookNodeDescriptor);
