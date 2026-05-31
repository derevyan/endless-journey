/**
 * 404 Not Found Error Component
 *
 * @module components/errors/not-found-error
 */

import { ErrorPage } from "./error-page";

interface NotFoundErrorProps extends React.HTMLAttributes<HTMLDivElement> {}

export function NotFoundError({ className }: NotFoundErrorProps) {
  return (
    <ErrorPage
      code="404"
      title="Oops! Page Not Found!"
      description={
        <>
          It seems like the page you&apos;re looking for <br />
          does not exist or might have been removed.
        </>
      }
      className={className}
    />
  );
}
