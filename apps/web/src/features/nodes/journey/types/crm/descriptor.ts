/**
 * CRM Node Definition
 *
 * Manage client stages in CRM pipelines.
 * Self-registers with the node registry.
 */

import { Users } from "lucide-react";
import { crmNodeDescriptor, type CrmNodeData } from "@journey/schemas";

import { CrmNode } from "./component";
import { CrmNodeEditor } from "./editor";
import { crmFormHandlers } from "./form";
import { getNodeTheme } from "../../config/node-theme";
import { frontendNodeRegistry as nodeRegistry, type FrontendNodeDescriptor } from "../../registry/frontend-descriptor";

const crmFrontendDescriptor: FrontendNodeDescriptor<CrmNodeData> = {
  ...crmNodeDescriptor,
  icon: Users,
  colors: getNodeTheme("crm"),
  formHandlers: crmFormHandlers,
  component: CrmNode,
  editor: CrmNodeEditor,
};

nodeRegistry.register(crmFrontendDescriptor);
