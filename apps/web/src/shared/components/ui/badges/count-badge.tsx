import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import { Badge, type BadgeProps } from "./badge";

interface CountBadgeProps {
  count: number;
  icon?: ReactNode;
  variant?: BadgeProps["variant"];
  size?: BadgeProps["size"];
  className?: string;
}

export function CountBadge({
  count,
  icon,
  variant = "secondary",
  size = "sm",
  className,
}: CountBadgeProps) {
  return (
    <Badge variant={variant} size={size} className={cn("gap-1", className)}>
      {icon}
      {count}
    </Badge>
  );
}
