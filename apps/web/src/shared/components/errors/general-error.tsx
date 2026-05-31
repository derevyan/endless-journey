/**
 * 500 General Error Component
 *
 * @module components/errors/general-error
 */

import { ErrorPage } from "./error-page";

interface GeneralErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  minimal?: boolean;
}

export function GeneralError({ className, minimal = false }: GeneralErrorProps) {
  return (
    <ErrorPage
      code="500"
      title="Oops! Something went wrong :')'"
      description={
        <>
          We apologize for the inconvenience. <br />
          Please try again later.
        </>
      }
      minimal={minimal}
      className={className}
    />
  );
}
