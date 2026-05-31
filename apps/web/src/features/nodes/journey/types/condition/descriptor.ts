/**
 * Condition Node Definition
 *
 * Branch based on user data or expressions.
 * Self-registers with the node registry.
 */

import { GitBranch } from "lucide-react";
import { conditionNodeDescriptor, type ConditionNodeData } from "@journey/schemas";

import { ConditionNode } from "./component";
import { ConditionNodeEditor } from "./editor";
import { conditionFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const conditionFrontendDescriptor: FrontendNodeDescriptor<ConditionNodeData> = {
  ...conditionNodeDescriptor,
  icon: GitBranch,
  colors: getNodeTheme("condition"),
  formHandlers: conditionFormHandlers,
  component: ConditionNode,
  editor: ConditionNodeEditor,
};

nodeRegistry.register(conditionFrontendDescriptor);
