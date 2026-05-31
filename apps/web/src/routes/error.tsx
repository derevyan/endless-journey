/**
 * General Error Route
 *
 * Error page displayed for general server errors.
 *
 * @module routes/error
 */

import { createFileRoute } from "@tanstack/react-router";

import { GeneralError } from "@/shared/components/errors/general-error";

export const Route = createFileRoute("/error")({
  component: GeneralErrorPage,
});

function GeneralErrorPage() {
  return <GeneralError />;
}

