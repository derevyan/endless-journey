import { cn } from "@/shared/lib/utils";

import { Badge, type BadgeProps } from "./badge";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface HttpMethodBadgeProps {
  method: HttpMethod;
  size?: BadgeProps["size"];
  className?: string;
}

const methodStyles: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  PATCH: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

export function HttpMethodBadge({ method, size = "default", className }: HttpMethodBadgeProps) {
  return (
    <Badge variant="outline" size={size} className={cn(methodStyles[method], className)}>
      {method}
    </Badge>
  );
}
