/**
 * Hook to safely extract and validate workflow node data.
 * Returns typed data or undefined if validation fails.
 */

import { useMemo } from "react";

import { createLogger } from "@journey/logger";
import { workflowNodeDescriptorRegistry, type WorkflowNodeType } from "@journey/schemas";

const log = createLogger("workflow-node-validation");

function formatDataPreview(data: unknown): string {
  if (typeof data === "string") {
    return data.slice(0, 200);
  }

  try {
    return JSON.stringify(data).slice(0, 200);
  } catch {
    return "[unserializable]";
  }
}

export function useValidatedNodeData<T>(nodeType: WorkflowNodeType, data: unknown): T | undefined {
  return useMemo(() => {
    const descriptor = workflowNodeDescriptorRegistry.get(nodeType);
    if (!descriptor) {
      log.error({ nodeType }, "workflow:node:descriptorNotFound");
      return undefined;
    }

    if (!descriptor.isType(data)) {
      log.error(
        { nodeType, data: formatDataPreview(data) },
        "workflow:node:dataValidationFailed"
      );
      return undefined;
    }

    return data as T;
  }, [nodeType, data]);
}
