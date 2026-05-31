/**
 * Error Page Component
 *
 * Reusable error page layout for all error states.
 * Provides consistent styling with configurable content.
 *
 * @module components/errors/error-page
 */

import { Link } from "@tanstack/react-router";

import { BackButton } from "@/shared/components/common/back-button";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface ErrorPageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Error code to display (e.g., "404", "500") */
  code: string;
  /** Main error title */
  title: string;
  /** Error description - can include JSX for line breaks */
  description: React.ReactNode;
  /** Show back button (default: true) */
  showBackButton?: boolean;
  /** Show home button (default: true) */
  showHomeButton?: boolean;
  /** Custom actions to render instead of default buttons */
  actions?: React.ReactNode;
  /** Minimal mode - hides code and action buttons */
  minimal?: boolean;
}

export function ErrorPage({
  code,
  title,
  description,
  showBackButton = true,
  showHomeButton = true,
  actions,
  minimal = false,
  className,
  ...props
}: ErrorPageProps) {
  const showDefaultActions = !actions && (showBackButton || showHomeButton);

  return (
    <div className={cn("h-svh w-full bg-background text-foreground", className)} {...props}>
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        {!minimal && <h1 className="text-[7rem] leading-tight font-bold">{code}</h1>}
        <span className="font-medium">{title}</span>
        <p className="text-muted-foreground text-center">{description}</p>
        {!minimal && (
          <div className="mt-6 flex gap-4">
            {actions}
            {showDefaultActions && (
              <>
                {showBackButton && <BackButton />}
                {showHomeButton && (
                  <Button asChild>
                    <Link to="/">Back to Home</Link>
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

