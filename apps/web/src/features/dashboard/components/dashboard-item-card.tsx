import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type DashboardItemCardLinkProps = Pick<LinkProps, "to" | "params">;

interface DashboardItemCardProps {
  /** Main title of the card */
  title: string;
  /** Primary identifier (slug, key, etc) shown in small italic mono */
  subtitle?: string;
  /** Main description text */
  description?: string;
  /** Link destination for the entire card */
  href: DashboardItemCardLinkProps["to"];
  /** Navigation params for the link */
  params?: DashboardItemCardLinkProps["params"];
  /** Status badge or indicator (top right) */
  status?: ReactNode;
  /** Action menu dropdown (top right) */
  actions?: ReactNode;
  /** Optional footer content (e.g. counts) */
  footer?: ReactNode;
  /** Optional icon (top left next to title) */
  icon?: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * DashboardItemCard
 *
 * A high-density card component for dashboard resource listings (Journeys, Agents, etc).
 * Implements a compact, two-section layout with a divider.
 */
export function DashboardItemCard({ title, subtitle: _subtitle, description, href, params, status, actions, footer, className }: DashboardItemCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-md border bg-card/50 transition-all hover:bg-accent/5 hover:border-primary/20 min-h-[100px]",
        className
      )}
    >
      <Link to={href} params={params} className="absolute inset-0 z-0" />

      {/* Header Section */}
      <div className="flex flex-col px-3 py-2 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 mr-2">
            <div className="truncate font-bold text-md leading-tight group-hover:text-primary transition-colors">{title}</div>
            {/* {subtitle && <p className="text-xs text-muted-foreground line-clamp-1 font-mono opacity-80 mt-1">{subtitle}</p>} */}
          </div>

          <div className="shrink-0">{actions && <div className="relative z-10">{actions}</div>}</div>
        </div>
      </div>

      {/* Content & Footer Section */}
      <div className="flex flex-1 flex-col px-3 py-2 gap-1.5 justify-between">
        {description && <p className="text-xs text-muted-foreground line-clamp-1 opacity-80 leading-snug">{description}</p>}
        <div className="flex items-center justify-between gap-3 mt-auto">
          <div className="flex items-center gap-3 text-xs text-muted-foreground/70">{footer}</div>
          {status && <div className="relative z-10">{status}</div>}
        </div>
      </div>
    </div>
  );
}
