/**
 * 404 Not Found Route
 *
 * Error page displayed when a route is not found.
 *
 * @module routes/404
 */

import { createFileRoute } from "@tanstack/react-router";

import { NotFoundError } from "@/shared/components/errors/not-found-error";

export const Route = createFileRoute("/404")({
  component: NotFoundErrorPage,
});

function NotFoundErrorPage() {
  return <NotFoundError />;
}

