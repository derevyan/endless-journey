/**
 * Webhook Node Definition
 *
 * Make API calls to external services.
 * Self-registers with the node registry.
 */

import { Globe } from "lucide-react";
import { webhookNodeDescriptor, type WebhookNodeData } from "@journey/schemas";

import { WebhookNode } from "./component";
import { WebhookNodeEditor } from "./editor";
import { webhookFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const webhookFrontendDescriptor: FrontendNodeDescriptor<WebhookNodeData> = {
  ...webhookNodeDescriptor,
  icon: Globe,
  colors: getNodeTheme("webhook"),
  formHandlers: webhookFormHandlers,
  component: WebhookNode,
  editor: WebhookNodeEditor,
};

nodeRegistry.register(webhookFrontendDescriptor);
