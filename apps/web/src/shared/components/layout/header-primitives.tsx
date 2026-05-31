import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/shared/lib/utils";

/**
 * Header Primitives
 *
 * Composable building blocks for creating header components.
 * Used by UnifiedHeader and can be reused for other header variants.
 */

/**
 * AppHeader - Header wrapper following composable pattern
 */
export function AppHeader({ children, className }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear bg-background relative z-50",
        className
      )}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">{children}</div>
    </header>
  );
}

export function AppHeaderIcon({ children, className }: React.ComponentProps<"span">) {
  return <span className={cn("flex justify-center items-center [&_svg]:size-5", className)}>{children}</span>;
}

export function AppHeaderTitle({ children, className }: React.ComponentProps<"span">) {
  return <span className={cn("text-base font-medium", className)}>{children}</span>;
}

export function AppHeaderSeparator({ className }: React.ComponentProps<"div">) {
  return <Separator orientation="vertical" className={cn("mx-2 data-[orientation=vertical]:h-4", className)} />;
}

/**
 * AppHeaderGroup - Visual grouping container for related header items
 * Use to group related buttons/controls together
 */
export function AppHeaderGroup({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1", className)}>{children}</div>;
}

