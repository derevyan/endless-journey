/**
 * start Node Backend Descriptor
 */

import { startNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { startHandler } from "./handler";

export const startBackendDescriptor: BackendNodeDescriptor = {
  ...startNodeDescriptor,
  execution: startHandler,
};

backendNodeRegistry.register(startBackendDescriptor);
