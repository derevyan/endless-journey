/**
 * 401 Unauthorized Route
 *
 * Error page displayed when user is not authenticated.
 *
 * @module routes/401
 */

import { createFileRoute } from "@tanstack/react-router";

import { UnauthorizedError } from "@/shared/components/errors/unauthorized-error";

export const Route = createFileRoute("/401")({
  component: UnauthorizedErrorPage,
});

function UnauthorizedErrorPage() {
  return <UnauthorizedError />;
}

