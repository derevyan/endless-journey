/**
 * Node Config Handler Hook
 *
 * Shared hook for handling node configuration updates in workflow config panels.
 *
 * @module features/nodes/workflow/hooks/use-node-config-handler
 */

import { useCallback } from "react";
import { agentWorkflowActions } from "@/features/agent-workflows/stores/agent-workflow-store";

/**
 * Hook to create a memoized update handler for node config components.
 *
 * Eliminates the duplicate handleUpdate pattern across all config components.
 *
 * @param nodeId - The ID of the node being configured
 * @returns A memoized callback that updates the node data
 *
 * @example
 * ```tsx
 * function MyNodeConfig({ nodeId, data }: { nodeId: string; data: MyNodeConfigType }) {
 *   const handleUpdate = useNodeConfigHandler<MyNodeConfigType>(nodeId);
 *
 *   return (
 *     <Input
 *       value={data.name}
 *       onChange={(e) => handleUpdate({ name: e.target.value })}
 *     />
 *   );
 * }
 * ```
 */
export function useNodeConfigHandler<T>(nodeId: string) {
  return useCallback(
    (updates: Partial<T>) => {
      agentWorkflowActions.updateNodeData(nodeId, updates);
    },
    [nodeId]
  );
}
