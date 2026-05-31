/**
 * Teleport Node Definition
 *
 * Transfers user to another journey.
 * Self-registers with the node registry.
 */

import { Zap } from "lucide-react";
import { teleportNodeDescriptor, type TeleportNodeData } from "@journey/schemas";

import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";
import { TeleportNode } from "./component";
import { TeleportNodeEditor } from "./editor";
import { teleportFormHandlers } from "./form";

const teleportFrontendDescriptor: FrontendNodeDescriptor<TeleportNodeData> = {
  ...teleportNodeDescriptor,
  icon: Zap,
  colors: getNodeTheme("teleport"),
  formHandlers: teleportFormHandlers,
  component: TeleportNode,
  editor: TeleportNodeEditor,
};

nodeRegistry.register(teleportFrontendDescriptor);
