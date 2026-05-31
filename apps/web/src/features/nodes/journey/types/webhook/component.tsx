/**
 * WebhookNode Component
 *
 * Make API calls to external services.
 */

import { memo } from "react";

import type { WebhookNodeData } from "@/features/nodes/journey/react-flow-types";
import { NodeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { getHttpMethodStyle, NODE_TYPOGRAPHY } from "../../config/node-theme";
import { BaseNode } from "../../components/base-node";

interface WebhookNodeProps {
  data: WebhookNodeData;
}

export const WebhookNode = memo(function WebhookNode({ data }: WebhookNodeProps) {
  const methodStyle = getHttpMethodStyle(data.method);

  // Try to extract hostname from URL
  let hostname = "";
  try {
    const urlWithoutTemplates = data.url.replace(/\{\{[^}]+\}\}/g, "x");
    const url = new URL(urlWithoutTemplates);
    hostname = url.hostname;
  } catch {
    hostname = data.url;
  }

  return (
    <BaseNode
      nodeType={NodeTypeEnum.WEBHOOK}
      label={data.label}
      outputHandles={[{ id: "success", label: "Success" }]}
      hasErrorHandle
    >
      {/* Method and URL */}
      <div className="flex items-center gap-2">
        <span className={`${NODE_TYPOGRAPHY.contentTiny} font-bold px-1.5 py-0.5 rounded ${methodStyle.color} bg-current/10`}>{data.method}</span>
        <span className={`${NODE_TYPOGRAPHY.contentSmall} text-muted-foreground truncate flex-1`}>{hostname}</span>
      </div>

      {/* Full URL preview */}
      <div className={`${NODE_TYPOGRAPHY.contentTiny} ${NODE_TYPOGRAPHY.mono} bg-muted/50 rounded px-2 py-1 text-muted-foreground truncate`}>{data.url}</div>

      {/* Response handling */}
      {data.storeAs && (
        <div className={`${NODE_TYPOGRAPHY.contentTiny} text-muted-foreground`}>
          Store as: <span className={NODE_TYPOGRAPHY.mono}>{data.storeAs}</span>
        </div>
      )}

      {/* Error handling badge */}
      {data.errorHandling && data.errorHandling !== "continue" && (
        <span className={`${NODE_TYPOGRAPHY.badgeSmall} px-1.5 py-0.5 rounded bg-accent text-accent-foreground`}>On error: {data.errorHandling}</span>
      )}
    </BaseNode>
  );
});
