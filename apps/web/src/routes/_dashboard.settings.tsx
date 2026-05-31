/**
 * Settings Layout Route
 *
 * Layout wrapper for all settings pages.
 * Provides sidebar navigation and consistent header.
 *
 * @module routes/_dashboard.settings
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Bot, Boxes, Building2, Database, FolderInput, GitBranch, Paintbrush, Settings2, Tag, User } from "lucide-react";

import { PageHeader } from "@/features/dashboard/components/page-header";
import { SettingsSidebarNav, type SettingsNavItem } from "@/features/settings/components/settings-sidebar-nav";

export const Route = createFileRoute("/_dashboard/settings")({
  component: SettingsLayout,
});

const settingsNavItems: SettingsNavItem[] = [
  {
    title: "General",
    icon: Settings2,
    href: "/settings",
  },
  {
    title: "Organisation",
    icon: Building2,
    href: "/settings/organisation",
  },
  {
    title: "Profile",
    icon: User,
    href: "/settings/profile",
  },
  {
    title: "Appearance",
    icon: Paintbrush,
    href: "/settings/appearance",
  },
  {
    title: "Tags",
    icon: Tag,
    href: "/settings/tags",
  },
  {
    title: "Variables",
    icon: Database,
    href: "/settings/variables",
  },
  {
    title: "Journey ↔ Pipelines",
    icon: GitBranch,
    href: "/settings/journey-pipelines",
  },
  {
    title: "Journey ↔ MindState",
    icon: Boxes,
    href: "/settings/journey-mindstate",
  },
  {
    title: "Messaging Integrations",
    icon: Bot,
    href: "/settings/channels",
  },
  {
    title: "Import / Export",
    icon: FolderInput,
    href: "/settings/import-export",
  },
];

function SettingsLayout() {
  return (
    <div data-layout="settings" className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
      <PageHeader title="Settings" description="Update account preferences and manage integrations." />

      {/* Content Area with Sidebar */}
      <div className="flex flex-1 flex-col space-y-8 overflow-auto md:space-y-2 md:overflow-hidden lg:flex-row lg:space-y-0 lg:space-x-12">
        {/* Sidebar Navigation */}
        <aside className="lg:sticky lg:w-1/5">
          <SettingsSidebarNav items={settingsNavItems} />
        </aside>

        {/* Main Content */}
        <div className="flex w-full overflow-y-auto p-1 pr-4 md:overflow-y-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
