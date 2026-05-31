/**
 * Journeys Layout Route
 *
 * Layout wrapper for all journey pages.
 * Child routes:
 * - /journeys/ (index) → JourneysListPage
 * - /journeys/$journeySlug → JourneyBuilderPage
 *
 * @module routes/_dashboard.journeys
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/journeys")({
  component: JourneysLayout,
});

function JourneysLayout() {
  return <Outlet />;
}
