/**
 * End Node Definition
 *
 * Exit point of the journey.
 * Self-registers with the node registry.
 */

import { CheckCircle } from "lucide-react";
import { endNodeDescriptor, type EndNodeData } from "@journey/schemas";

import { EndNode } from "./component";
import { EndNodeEditor } from "./editor";
import { endFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const endFrontendDescriptor: FrontendNodeDescriptor<EndNodeData> = {
  ...endNodeDescriptor,
  icon: CheckCircle,
  colors: getNodeTheme("end"),
  formHandlers: endFormHandlers,
  component: EndNode,
  editor: EndNodeEditor,
};

nodeRegistry.register(endFrontendDescriptor);
