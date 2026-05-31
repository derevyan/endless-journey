/**
 * NodeTagsPreview Component
 *
 * Displays a truncated list of tags for node previews.
 * Shows first N tags with a "+X" indicator for overflow.
 */

import { memo } from "react";
import { NODE_LAYOUT, NODE_TYPOGRAPHY, TAG_PREVIEW } from "../../config/node-theme";

interface NodeTagsPreviewProps {
  tags: string[];
  maxVisible?: number;
}

export const NodeTagsPreview = memo(function NodeTagsPreview({ tags, maxVisible = TAG_PREVIEW.maxVisible }: NodeTagsPreviewProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap ${NODE_LAYOUT.badge.gap} mt-1`}>
      {tags.slice(0, maxVisible).map((tag, i) => (
        <span key={i} className={`${TAG_PREVIEW.badge.base} ${TAG_PREVIEW.badge.colors}`}>
          #{tag}
        </span>
      ))}
      {tags.length > maxVisible && <span className={NODE_TYPOGRAPHY.badgeSmall}>+{tags.length - maxVisible}</span>}
    </div>
  );
});
