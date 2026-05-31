/**
 * 503 Service Unavailable Route
 *
 * Error page displayed when the service is under maintenance.
 *
 * @module routes/503
 */

import { createFileRoute } from "@tanstack/react-router";

import { MaintenanceError } from "@/shared/components/errors/maintenance-error";

export const Route = createFileRoute("/503")({
  component: MaintenanceErrorPage,
});

function MaintenanceErrorPage() {
  return <MaintenanceError />;
}

