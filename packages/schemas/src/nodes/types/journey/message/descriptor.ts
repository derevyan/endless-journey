/**
 * Message Node Descriptor (Base)
 */

import { MessageNodeDataSchema, type MessageNodeData } from "./schema";
import { NODE_CAPABILITIES } from "../../../capabilities";
import type { JourneyNodeDescriptor } from "../../../descriptor";
import { nodeDescriptorRegistry } from "../../../descriptor-registry";

export const messageNodeDescriptor: JourneyNodeDescriptor<MessageNodeData> = {
  system: "journey",
  type: "message",
  version: 2,
  displayName: "Message",
  description: "Display content to user with optional buttons and timer",
  category: "action",

  schema: MessageNodeDataSchema,
  capabilities: NODE_CAPABILITIES.message,
  handles: {
    inputs: [{ id: "default", label: "In" }],
    outputs: [
      { id: "output", label: "Next" },
      { id: "timer", label: "Timeout", condition: "hasTimer" },
    ],
  },

  createDefaultData: () => ({
    type: "message",
    schemaVersion: 2,
    label: "Message",
    content: "Message",
    contentFormat: "text",
  }),

  isType: (data): data is MessageNodeData => MessageNodeDataSchema.safeParse(data).success,
};

nodeDescriptorRegistry.register(messageNodeDescriptor);
