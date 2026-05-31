/**
 * Sidebar Navigation Data
 *
 * Configuration for the dashboard sidebar navigation.
 * Uses Lucide icons as specified in workspace rules.
 *
 * @module components/dashboard/sidebar-data
 */

import type { LucideIcon } from "lucide-react";
import { Boxes, Bot, FileText, Kanban, LayoutDashboard, ScrollText, Settings, Users, Workflow } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: string;
  items?: Omit<NavItem, "items">[];
  disabled?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SidebarUser {
  name: string;
  email: string;
  avatar?: string;
}

export interface SidebarData {
  navGroups: NavGroup[];
  user: SidebarUser;
}

// =============================================================================
// NAVIGATION DATA
// =============================================================================

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "Builders",
      items: [
        {
          title: "Journey Builder",
          url: "/journeys",
          icon: Workflow,
        },
        {
          title: "Agent Builder",
          url: "/agents",
          icon: Bot,
        },
        {
          title: "MindState",
          url: "/mindstate",
          icon: Boxes,
        },
        {
          title: "Prompts",
          url: "/prompts",
          icon: FileText,
        },
      ],
    },
    {
      title: "Voyagers",
      items: [
        {
          title: "Users",
          url: "/users",
          icon: Users,
        },
        {
          title: "CRM",
          url: "/crm",
          icon: Kanban,
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
        },
        {
          title: "Events/Logs",
          url: "/developers/events",
          icon: ScrollText,
        },
      ],
    },
  ],
  user: {
    name: "User",
    email: "",
  },
};
