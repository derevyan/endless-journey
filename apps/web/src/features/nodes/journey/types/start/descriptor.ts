/**
 * Start Node Definition
 *
 * Entry point of the journey. Self-registers with the node registry.
 */

import { PlayCircle } from "lucide-react";
import { startNodeDescriptor, type StartNodeData } from "@journey/schemas";

import { StartNode } from "./component";
import { StartNodeEditor } from "./editor";
import { startFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const startFrontendDescriptor: FrontendNodeDescriptor<StartNodeData> = {
  ...startNodeDescriptor,
  icon: PlayCircle,
  colors: getNodeTheme("start"),
  formHandlers: startFormHandlers,
  component: StartNode,
  editor: StartNodeEditor,
};

nodeRegistry.register(startFrontendDescriptor);
