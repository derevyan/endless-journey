/**
 * teleport Node Backend Descriptor
 */

import { teleportNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { teleportHandler } from "./handler";

export const teleportBackendDescriptor: BackendNodeDescriptor = {
  ...teleportNodeDescriptor,
  execution: teleportHandler,
};

backendNodeRegistry.register(teleportBackendDescriptor);
