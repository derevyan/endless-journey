import { Badge, type BadgeProps } from "./badge";

type LogLevel = "error" | "warn" | "warning" | "info" | "debug";

interface LogLevelBadgeProps {
  level: LogLevel;
  size?: BadgeProps["size"];
  className?: string;
}

function getLevelVariant(level: LogLevel): BadgeProps["variant"] {
  const normalized = level.toLowerCase();
  if (normalized === "error") return "destructive";
  if (normalized === "warning" || normalized === "warn") return "warning";
  if (normalized === "debug") return "outline";
  return "secondary";
}

export function LogLevelBadge({ level, size = "default", className }: LogLevelBadgeProps) {
  return (
    <Badge variant={getLevelVariant(level)} size={size} className={className}>
      {level.toUpperCase()}
    </Badge>
  );
}
