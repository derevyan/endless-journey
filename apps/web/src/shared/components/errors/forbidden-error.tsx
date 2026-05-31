/**
 * 403 Forbidden Error Component
 *
 * @module components/errors/forbidden-error
 */

import { ErrorPage } from "./error-page";

interface ForbiddenErrorProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ForbiddenError({ className }: ForbiddenErrorProps) {
  return (
    <ErrorPage
      code="403"
      title="Access Forbidden"
      description={
        <>
          You don&apos;t have necessary permission <br />
          to view this resource.
        </>
      }
      className={className}
    />
  );
}
