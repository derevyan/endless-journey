import { Sidebar, SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { cn } from "@/shared/lib/utils";
import type { ComponentProps, CSSProperties } from "react";

/**
 * AppLayout - Root wrapper that provides sidebar context
 * Uses SidebarProvider from shadcn/ui
 */
export function AppLayout({ className, ...props }: ComponentProps<typeof SidebarProvider>) {
  return (
    <SidebarProvider
      defaultOpen={true}
      className={cn("h-full min-h-0", className)}
      style={
        {
          "--sidebar-width": "24rem",
          "--sidebar-width-mobile": "26rem",
        } as CSSProperties
      }
      {...props}
    />
  );
}

/**
 * AppLayoutInset - Main content area wrapper
 * Uses SidebarInset from shadcn/ui
 */
export function AppLayoutInset({ className, ...props }: ComponentProps<typeof SidebarInset>) {
  return <SidebarInset className={cn("flex flex-col h-full min-h-0 overflow-hidden", className)} {...props} />;
}

/**
 * AppLayoutSidebar - Sidebar wrapper (typically for right side)
 * Uses Sidebar from shadcn/ui
 * Note: Uses inline styles to offset from the dashboard header (h-14 = 3.5rem)
 * The style prop is spread onto the fixed div, allowing us to override inset-y-0
 */
export function AppLayoutSidebar({ className, side = "right", style, ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className={cn("bg-background", className)}
      side={side}
      style={
        {
          // Override inset-y-0 by setting top and height explicitly
          // Header is h-14 = 3.5rem = 56px
          top: "3.5rem",
          height: "calc(100svh - 3.5rem)",
          bottom: "auto",
          ...style,
        } as CSSProperties
      }
      {...props}
    />
  );
}
