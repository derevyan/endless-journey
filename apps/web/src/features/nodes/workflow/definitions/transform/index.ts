/**
 * Transform Node Definition
 * @module features/nodes/workflow/definitions/transform/index
 */

import { Wand2 } from "lucide-react";
import { workflowTransformNodeDescriptor } from "@journey/schemas";
import type { TransformNodeConfig } from "@journey/schemas";

import { getWorkflowNodeColor } from "../../config/workflow-theme";
import { workflowNodeRegistry, type FrontendWorkflowNodeDescriptor } from "../../registry/workflow-node-registry";
import { TransformNode } from "./transform-node";
import { TransformNodeConfig as TransformNodeEditor } from "./transform-node-config";
import { transformFormHandlers } from "./form";

const transformFrontendDescriptor: FrontendWorkflowNodeDescriptor<TransformNodeConfig> = {
  ...workflowTransformNodeDescriptor,
  icon: Wand2,
  color: getWorkflowNodeColor("transform"),
  component: TransformNode,
  editor: TransformNodeEditor,
  formHandlers: transformFormHandlers,
};

workflowNodeRegistry.register(transformFrontendDescriptor);
