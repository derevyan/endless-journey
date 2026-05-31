/**
 * Message Node Definition
 *
 * Display content to user with optional buttons and timer.
 * Self-registers with the node registry.
 */

import { MessageSquare } from "lucide-react";
import { messageNodeDescriptor, type MessageNodeData } from "@journey/schemas";

import { MessageNode } from "./component";
import { MessageNodeEditor } from "./editor";
import { messageFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const messageFrontendDescriptor: FrontendNodeDescriptor<MessageNodeData> = {
  ...messageNodeDescriptor,
  icon: MessageSquare,
  colors: getNodeTheme("message"),
  formHandlers: messageFormHandlers,
  component: MessageNode,
  editor: MessageNodeEditor,
};

nodeRegistry.register(messageFrontendDescriptor);
