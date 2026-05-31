/**
 * CrmNode Component
 *
 * Manage client stages in CRM pipelines.
 * Simplified: just shows pipeline/stage info.
 */

import { memo } from "react";

import { NODE_TYPOGRAPHY } from "../../config/node-theme";
import type { CrmNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "../../react-flow-types";
import { BaseNode } from "../../components/base-node";

interface CrmNodeProps {
  data: CrmNodeData;
}

export const CrmNode = memo(function CrmNode({ data }: CrmNodeProps) {
  return (
    <BaseNode nodeType={NodeTypeEnum.CRM} label={data.label}>
      {/* Pipeline info */}
      {data.pipelineId ? (
        <div className={`${NODE_TYPOGRAPHY.contentTiny} text-muted-foreground truncate`}>
          Pipeline: <span className={NODE_TYPOGRAPHY.mono}>{data.pipelineId.slice(0, 8)}...</span>
        </div>
      ) : (
        <div className={`${NODE_TYPOGRAPHY.contentTiny} text-muted-foreground`}>Using default pipeline</div>
      )}

      {/* Stage info */}
      {data.stageId && (
        <div className={`${NODE_TYPOGRAPHY.contentTiny} text-muted-foreground truncate`}>
          Stage: <span className={NODE_TYPOGRAPHY.mono}>{data.stageId.slice(0, 8)}...</span>
        </div>
      )}

      {/* Notes */}
      {data.notes && <div className={`${NODE_TYPOGRAPHY.badgeSmall} text-muted-foreground/70 truncate italic`}>"{data.notes}"</div>}
    </BaseNode>
  );
});
