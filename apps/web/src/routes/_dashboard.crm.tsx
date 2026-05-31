/**
 * CRM Layout Route
 *
 * Layout wrapper for all CRM pages.
 * Provides sidebar navigation and consistent header.
 *
 * @module routes/_dashboard.crm
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PageHeader } from "@/features/dashboard/components/page-header";

export const Route = createFileRoute("/_dashboard/crm")({
  component: CrmLayout,
});

function CrmLayout() {
  return (
    <div
      data-layout="crm"
      className="flex h-full flex-1 flex-col overflow-hidden p-4"
    >
      <PageHeader
        title="CRM"
        description="Manage your client pipeline, track stages, and send direct messages."
      />

      {/* Main Content - Full Width */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
