/**
 * crm Node Backend Descriptor
 */

import { crmNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry, type BackendNodeDescriptor } from "../../../descriptors/backend-descriptor";
import { crmHandler } from "./handler";

export const crmBackendDescriptor: BackendNodeDescriptor = {
  ...crmNodeDescriptor,
  execution: crmHandler,
};

backendNodeRegistry.register(crmBackendDescriptor);
