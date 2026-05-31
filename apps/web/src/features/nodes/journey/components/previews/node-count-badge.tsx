/**
 * NodeCountBadge Component
 *
 * A reusable badge for displaying an icon with a numeric count.
 * Uses the standard NodeBadge component for consistent styling.
 *
 * @example
 * <NodeCountBadge
 *   count={3}
 *   icon={<Bell className="size-3" />}
 *   className="bg-amber-500/10 text-amber-600"
 * />
 */

import type { ReactNode } from "react";

import { NodeBadge } from "./node-badge";

interface NodeCountBadgeProps {
  count: number;
  icon: ReactNode;
  className?: string;
}

export function NodeCountBadge({ count, icon, className }: NodeCountBadgeProps) {
  return (
    <NodeBadge className={className} icon={icon}>
      {count}
    </NodeBadge>
  );
}
