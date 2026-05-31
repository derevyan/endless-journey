/**
 * Dashboard Feature
 *
 * Main dashboard layout and navigation with sidebar, header,
 * organization switching, and journey-specific controls.
 */

// Main components
export {
  AppSidebar,
  DashboardHeader,
  DashboardHome,
  JourneyHeaderControls,
  NavGroup,
  NavUser,
  OrganisationSwitcher,
  PageHeader,
  StatsCard,
} from "./components";

// Configuration
export type { NavItem, NavGroup as NavGroupType, SidebarUser } from "./components";
export { sidebarData } from "./components";
