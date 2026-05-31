/**
 * wait Node Backend Descriptor
 */

import { waitNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { waitHandler } from "./handler";

export const waitBackendDescriptor: BackendNodeDescriptor = {
  ...waitNodeDescriptor,
  execution: waitHandler,
};

backendNodeRegistry.register(waitBackendDescriptor);
