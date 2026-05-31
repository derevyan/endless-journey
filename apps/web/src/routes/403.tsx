/**
 * 403 Forbidden Route
 *
 * Error page displayed when user lacks permission to access a resource.
 *
 * @module routes/403
 */

import { createFileRoute } from "@tanstack/react-router";

import { ForbiddenError } from "@/shared/components/errors/forbidden-error";

export const Route = createFileRoute("/403")({
  component: ForbiddenErrorPage,
});

function ForbiddenErrorPage() {
  return <ForbiddenError />;
}

