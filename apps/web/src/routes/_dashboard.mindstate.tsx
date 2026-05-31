/**
 * MindState Builder Layout Route
 *
 * Layout wrapper for all mindstate builder pages.
 *
 * @module routes/_dashboard.mindstate
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/mindstate")({
  component: MindstateLayout,
});

function MindstateLayout() {
  return <Outlet />;
}
