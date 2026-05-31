/**
 * Node Registry (Frontend)
 *
 * Facade export for the unified frontend node registry.
 */

import type { NodeColorScheme } from "../config/node-theme";
import {
  frontendNodeRegistry,
  type FrontendNodeDescriptor,
  type NodeComponentProps,
  type NodeFormConfig,
} from "./frontend-descriptor";
// Ensure node descriptors self-register when the registry is imported.
import "../types/index";

export { frontendNodeRegistry as nodeRegistry };

export type NodeDefinition = FrontendNodeDescriptor;
export type { FrontendNodeDescriptor, NodeComponentProps, NodeColorScheme, NodeFormConfig };
