/**
 * Prompts Layout Route
 *
 * Layout wrapper for all prompt repository pages.
 *
 * @module routes/_dashboard.prompts
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/prompts")({
  component: PromptsLayout,
});

function PromptsLayout() {
  return <Outlet />;
}
