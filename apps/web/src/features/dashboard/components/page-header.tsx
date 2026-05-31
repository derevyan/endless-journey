/**
 * Page Header Component
 *
 * Reusable header component for dashboard pages.
 * Provides consistent styling and layout for page titles and descriptions.
 *
 * @module components/dashboard/page-header
 */

import { cn } from "@/shared/lib/utils";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}














