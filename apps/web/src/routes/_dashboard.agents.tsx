/**
 * Agent Workflows Layout Route
 *
 * Layout wrapper for all agent workflow pages.
 *
 * @module routes/_dashboard.agents
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/agents")({
  component: AgentsLayout,
});

function AgentsLayout() {
  return <Outlet />;
}
