import { cn } from "@/shared/lib/utils";
import type { ReactNode } from "react";
import { BADGE_STYLES } from "../../config/node-theme";

interface NodeBadgeProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function NodeBadge({ children, className, icon }: NodeBadgeProps) {
  return (
    <span className={cn(`${BADGE_STYLES.base} ${BADGE_STYLES.sizes.default} backdrop-blur-md shadow-xs`, className)}>
      {icon && <span className="mr-1.5 flex items-center shrink-0">{icon}</span>}
      <span className="uppercase tracking-wide font-bold">{children}</span>
    </span>
  );
}
