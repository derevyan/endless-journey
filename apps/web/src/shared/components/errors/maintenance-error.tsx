/**
 * 503 Maintenance Error Component
 *
 * @module components/errors/maintenance-error
 */

import { Button } from "@/shared/components/ui/button";

import { ErrorPage } from "./error-page";

interface MaintenanceErrorProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MaintenanceError({ className }: MaintenanceErrorProps) {
  return (
    <ErrorPage
      code="503"
      title="Website is under maintenance!"
      description={
        <>
          The site is not available at the moment. <br />
          We&apos;ll be back online shortly.
        </>
      }
      showBackButton={false}
      showHomeButton={false}
      actions={<Button variant="outline">Learn more</Button>}
      className={className}
    />
  );
}
