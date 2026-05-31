/**
 * 401 Unauthorized Error Component
 *
 * @module components/errors/unauthorized-error
 */

import { ErrorPage } from "./error-page";

interface UnauthorizedErrorProps extends React.HTMLAttributes<HTMLDivElement> {}

export function UnauthorizedError({ className }: UnauthorizedErrorProps) {
  return (
    <ErrorPage
      code="401"
      title="Unauthorized Access"
      description={
        <>
          Please log in with the appropriate credentials <br />
          to access this resource.
        </>
      }
      className={className}
    />
  );
}
