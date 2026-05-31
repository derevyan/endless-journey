/**
 * StartNode Component
 *
 * Entry point node for the journey.
 */

import { memo } from "react";

import type { StartNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "../../react-flow-types";
import { BaseNode } from "../../components/base-node";
import { NodeMediaPreview } from "../../components/previews/node-media-preview";

interface StartNodeProps {
  data: StartNodeData;
}

export const StartNode = memo(function StartNode({ data }: StartNodeProps) {
  return (
    <BaseNode nodeType={NodeTypeEnum.START} label={data.label} hasInputHandle={false}>
      {/* Media preview */}
      <NodeMediaPreview media={data.media} />

      {/* Content preview - preserves newlines */}
      {data.content && (
        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap">{data.content.replace(/<[^>]*>/g, "")}</p>
      )}
    </BaseNode>
  );
});
