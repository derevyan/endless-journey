/**
 * Set State Node Definition
 * @module features/nodes/workflow/definitions/set-state/index
 */

import { Database } from "lucide-react";
import { workflowSetStateNodeDescriptor } from "@journey/schemas";
import type { SetStateNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { SetStateNode } from "./set-state-node";
import { SetStateNodeConfig as SetStateNodeEditor } from "./set-state-node-config";
import { setStateFormHandlers } from "./form";

const setStateFrontendDescriptor: FrontendWorkflowNodeDescriptor<SetStateNodeConfig> = {
  ...workflowSetStateNodeDescriptor,
  icon: Database,
  color: getWorkflowNodeColor("set_state"),
  component: SetStateNode,
  editor: SetStateNodeEditor,
  formHandlers: setStateFormHandlers,
};

workflowNodeRegistry.register(setStateFrontendDescriptor);
