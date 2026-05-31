/**
 * Prompt Type Badge
 *
 * Simple text indicator for prompt type (text vs chat).
 *
 * @module features/prompts/components/prompt-type-badge
 */

import { memo } from "react";

import type { PromptType } from "@journey/schemas";

import { Badge } from "@/shared/components/ui/badges";

interface PromptTypeBadgeProps {
  type: PromptType;
  className?: string;
}

export const PromptTypeBadge = memo(function PromptTypeBadge({ type, className }: PromptTypeBadgeProps) {
  return (
    <Badge variant="outline" size="sm" className={className}>
      {type === "text" ? "Text" : "Chat"}
    </Badge>
  );
});
