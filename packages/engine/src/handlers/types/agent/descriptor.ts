/**
 * agent Node Backend Descriptor
 */

import { agentNodeDescriptor, type AgentNodeData, type AgentState } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { agentHandler } from "./handler";

export const agentBackendDescriptor: BackendNodeDescriptor<AgentNodeData, AgentState> = {
  ...agentNodeDescriptor,
  execution: agentHandler,
};

backendNodeRegistry.register(agentBackendDescriptor);
