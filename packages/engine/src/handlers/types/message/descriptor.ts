/**
 * message Node Backend Descriptor
 */

import { messageNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { messageHandler } from "./handler";

export const messageBackendDescriptor: BackendNodeDescriptor = {
  ...messageNodeDescriptor,
  execution: messageHandler,
};

backendNodeRegistry.register(messageBackendDescriptor);
