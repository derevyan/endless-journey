/**
 * TeleportNode Component
 *
 * Teleport node that transfers user to another journey.
 * Displays target journey and node info.
 * Uses BaseNode with hasOutputHandle={false}
 */

import { memo } from "react";

import { NODE_TYPOGRAPHY } from "../../config/node-theme";
import type { TeleportNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "../../react-flow-types";

import { BaseNode } from "../../components/base-node";

interface TeleportNodeProps {
  data: TeleportNodeData;
}

export const TeleportNode = memo(function TeleportNode({ data }: TeleportNodeProps) {
  return (
    <BaseNode nodeType={NodeTypeEnum.TELEPORT} label={data.label} hasOutputHandle={false}>
      {/* Target info */}
      {data.targetJourneyId ? (
        <div className="space-y-1">
          <p className={`${NODE_TYPOGRAPHY.contentSmall} text-muted-foreground uppercase tracking-wide`}>Target Journey</p>
          <p className={`${NODE_TYPOGRAPHY.content} text-foreground truncate font-medium`}>{data.targetJourneyId.slice(0, 8)}...</p>
          {data.targetNodeId && (
            <>
              <p className={`${NODE_TYPOGRAPHY.contentSmall} text-muted-foreground uppercase tracking-wide mt-2`}>Target Node</p>
              <p className={`${NODE_TYPOGRAPHY.content} text-foreground truncate`}>{data.targetNodeId.slice(0, 8)}...</p>
            </>
          )}
        </div>
      ) : (
        <p className={`${NODE_TYPOGRAPHY.content} text-muted-foreground italic`}>No target selected</p>
      )}

      {/* Context preservation badge */}
      {data.preserveContext !== false && (
        <div className={`flex items-center gap-1 ${NODE_TYPOGRAPHY.contentSmall} text-muted-foreground mt-2`}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Preserves context</span>
        </div>
      )}
    </BaseNode>
  );
});
