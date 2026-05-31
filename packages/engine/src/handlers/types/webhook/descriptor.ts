/**
 * webhook Node Backend Descriptor
 */

import { webhookNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { webhookHandler } from "./handler";

export const webhookBackendDescriptor: BackendNodeDescriptor = {
  ...webhookNodeDescriptor,
  execution: webhookHandler,
};

backendNodeRegistry.register(webhookBackendDescriptor);
