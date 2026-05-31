/**
 * Dashboard Header
 *
 * Global header for the dashboard layout.
 * Displays page title and context-specific controls.
 *
 * @module components/dashboard/dashboard-header
 */

import { useLocation } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { PanelRight } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { SidebarTrigger } from "@/shared/components/ui/sidebar";
import { ThemeSwitch } from "@/shared/components/ui/theme-switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { agentWorkflowHeaderStore } from "@/features/dashboard/store/agent-workflow-header-store";
import { journeyHeaderStore } from "@/features/dashboard/store/journey-header-store";
import { mindstateHeaderStore } from "@/features/dashboard/store/mindstate-header-store";

import { AgentWorkflowHeaderControls } from "./agent-workflow-header-controls";
import { JourneyHeaderControls } from "./journey-header-controls";
import { MindstateHeaderControls } from "./mindstate-header-controls";

// Map routes to page titles
// Order matters: more specific routes should come first
const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/developers/events": "Events & Logs",
  "/developers": "Developers",
  "/journeys": "Journey Builder",
  "/agents": "Agent Builder",
  "/mindstate": "MindState Builder",
  "/users": "Users",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  // Check exact match first
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }
  // Check if starts with a known route (more specific routes first)
  // Sort routes by length descending to match more specific routes first
  const sortedRoutes = Object.entries(routeTitles).sort((a, b) => b[0].length - a[0].length);
  for (const [route, title] of sortedRoutes) {
    if (route !== "/" && pathname.startsWith(route)) {
      return title;
    }
  }
  return "Dashboard";
}

export function DashboardHeader() {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const isJourneysPage = location.pathname.startsWith("/journeys");
  const isAgentsPage = location.pathname.startsWith("/agents/");
  const isMindstatePage = location.pathname.startsWith("/mindstate");

  // Granular selectors for journey header (only what we need)
  const journeyIsActive = useStore(journeyHeaderStore, (s) => s.isActive);
  const journeyOnToggleSidebar = useStore(journeyHeaderStore, (s) => s.onToggleSidebar);
  const journeySidebarOpen = useStore(journeyHeaderStore, (s) => s.sidebarOpen);

  // Granular selectors for agent workflow header
  const agentWorkflowIsActive = useStore(agentWorkflowHeaderStore, (s) => s.isActive);

  // Granular selectors for mindstate header
  const mindstateIsActive = useStore(mindstateHeaderStore, (s) => s.isActive);
  const mindstateOnToggleSidebar = useStore(mindstateHeaderStore, (s) => s.onToggleSidebar);
  const mindstateSidebarOpen = useStore(mindstateHeaderStore, (s) => s.sidebarOpen);

  return (
    <TooltipProvider>
      <header className={cn("bg-background z-50 flex h-14 shrink-0 items-center gap-2 border-b px-4 relative", "sticky top-0")}>
        {/* Left section: Sidebar trigger + Page title */}
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium">{pageTitle}</span>

        {/* Center section: Journey controls (only on journeys page when active) */}
        {isJourneysPage && journeyIsActive && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <JourneyHeaderControls />
          </>
        )}

        {/* Center section: Agent workflow controls (only on agents page when active) */}
        {isAgentsPage && agentWorkflowIsActive && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <AgentWorkflowHeaderControls />
          </>
        )}

        {/* Center section: Mindstate controls (only on mindstate page when active) */}
        {isMindstatePage && mindstateIsActive && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <MindstateHeaderControls />
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right section: Theme switch + Canvas sidebar toggle (for journeys page) */}
        <ThemeSwitch />

        {/* Canvas sidebar toggle - only on journeys page */}
        {isJourneysPage && journeyIsActive && journeyOnToggleSidebar && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={journeyOnToggleSidebar}>
                  <PanelRight className="h-4 w-4" />
                  <span className="sr-only">Toggle Sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{journeySidebarOpen ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Mindstate sidebar toggle */}
        {isMindstatePage && mindstateIsActive && mindstateOnToggleSidebar && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={mindstateOnToggleSidebar}>
                  <PanelRight className="h-4 w-4" />
                  <span className="sr-only">Toggle Sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{mindstateSidebarOpen ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
            </Tooltip>
          </>
        )}
      </header>
    </TooltipProvider>
  );
}
