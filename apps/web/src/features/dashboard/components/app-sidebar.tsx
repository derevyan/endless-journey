/**
 * Application Sidebar
 *
 * Main sidebar component for the dashboard layout.
 * Composes sidebar primitives with navigation data.
 *
 * @module components/dashboard/app-sidebar
 */

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/shared/components/ui/sidebar";

import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
import { OrganisationSwitcher } from "./organisation-switcher";
import { sidebarData } from "./sidebar-data";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header with Organisation Switcher */}
      <SidebarHeader>
        <OrganisationSwitcher />
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent>
        {sidebarData.navGroups.map((group) => (
          <NavGroup key={group.title} {...group} />
        ))}
      </SidebarContent>

      {/* Footer with User Profile */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      {/* Collapse Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
