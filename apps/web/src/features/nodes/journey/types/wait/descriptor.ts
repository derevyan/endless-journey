/**
 * Wait Node Definition
 *
 * Pause the journey for a specified duration.
 * Self-registers with the node registry.
 */

import { Clock } from "lucide-react";
import { waitNodeDescriptor, type WaitNodeData } from "@journey/schemas";

import { WaitNode } from "./component";
import { WaitNodeEditor } from "./editor";
import { waitFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const waitFrontendDescriptor: FrontendNodeDescriptor<WaitNodeData> = {
  ...waitNodeDescriptor,
  icon: Clock,
  colors: getNodeTheme("wait"),
  formHandlers: waitFormHandlers,
  component: WaitNode,
  editor: WaitNodeEditor,
};

nodeRegistry.register(waitFrontendDescriptor);
