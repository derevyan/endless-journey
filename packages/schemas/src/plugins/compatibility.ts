import type { NodeCapabilities, NodeType } from "../nodes";

export interface PluginCompatibility {
  /** Node types that can use this plugin */
  compatibleNodeTypes: NodeType[];

  /** Maximum plugin instances per node (0 = unlimited) */
  maxInstancesPerNode: number;

  /** Whether multiple plugins can chain together */
  canBeChained: boolean;

  /** Required node capabilities */
  requiredCapabilities?: (keyof NodeCapabilities)[];
}
