import { cn } from "@/shared/lib/utils";

export function PanelSurface({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-surface"
      className={cn("bg-card text-card-foreground rounded-lg border shadow-md", className)}
      {...props}
    />
  );
}
