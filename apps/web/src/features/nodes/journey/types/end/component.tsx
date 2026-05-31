/**
 * EndNode Component
 *
 * Exit point of the journey.
 * Uses BaseNode with hasOutputHandle={false}
 */

import { memo } from "react";

import { NODE_TYPOGRAPHY } from "../../config/node-theme";
import type { EndNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "../../react-flow-types";

import { BaseNode } from "../../components/base-node";
import { NodeButtonsPreview } from "../../components/previews/node-buttons-preview";
import { NodeTagsPreview } from "../../components/previews/node-tags-preview";

interface EndNodeProps {
  data: EndNodeData;
}

export const EndNode = memo(function EndNode({ data }: EndNodeProps) {
  return (
    <BaseNode nodeType={NodeTypeEnum.END} label={data.label} hasOutputHandle={false}>
      {/* Content preview - preserves newlines */}
      {data.content && (
        <p className={`${NODE_TYPOGRAPHY.content} text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap`}>
          {data.content.replace(/<[^>]*>/g, "")}
        </p>
      )}

      {/* Buttons */}
      {data.buttons && <NodeButtonsPreview buttons={data.buttons} />}

      {/* Tags - show add tags from tagAction */}
      {data.tagAction?.tags?.add && data.tagAction.tags.add.length > 0 && (
        <NodeTagsPreview tags={data.tagAction.tags.add} />
      )}
    </BaseNode>
  );
});
