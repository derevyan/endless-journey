import { memo } from "react";

import { cn } from "@/shared/lib/utils";

import { Badge, type BadgeProps } from "./badge";

interface LabelBadgeProps {
  label: string;
  size?: BadgeProps["size"];
  className?: string;
}

const LABEL_STYLES: Record<string, string> = {
  production: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 ring-1 ring-emerald-500/10",
  latest: "bg-blue-500/10 text-blue-600 border-blue-500/20 ring-1 ring-blue-500/10",
};

export const LabelBadge = memo(function LabelBadge({ label, size = "default", className }: LabelBadgeProps) {
  const style = LABEL_STYLES[label] ?? "bg-muted/50 text-muted-foreground border-border/50";

  return (
    <Badge variant="outline" size={size} className={cn("font-mono font-medium tracking-tight rounded-sm", style, className)}>
      {label}
    </Badge>
  );
});
