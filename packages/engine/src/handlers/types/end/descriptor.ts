/**
 * end Node Backend Descriptor
 */

import { endNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { endHandler } from "./handler";

export const endBackendDescriptor: BackendNodeDescriptor = {
  ...endNodeDescriptor,
  execution: endHandler,
};

backendNodeRegistry.register(endBackendDescriptor);
