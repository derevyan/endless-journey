/**
 * condition Node Backend Descriptor
 */

import { conditionNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { conditionHandler } from "./handler";

export const conditionBackendDescriptor: BackendNodeDescriptor = {
  ...conditionNodeDescriptor,
  execution: conditionHandler,
};

backendNodeRegistry.register(conditionBackendDescriptor);
