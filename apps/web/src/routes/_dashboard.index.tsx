/**
 * Dashboard Index Route
 *
 * Homepage at "/" showing dashboard stats and quick links.
 *
 * @module routes/_dashboard.index
 */

import { createFileRoute } from "@tanstack/react-router";

import { DashboardHome } from "@/features/dashboard/components/dashboard-home";

export const Route = createFileRoute("/_dashboard/")({
  component: DashboardHome,
});

