/**
 * Dashboard Layout Route
 *
 * Layout wrapper for all dashboard routes.
 * Provides sidebar navigation and authentication check.
 *
 * @module routes/_dashboard
 */

import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { createLogger } from "@journey/logger";

import { LoadingSpinner } from "@/shared/components/common/loading-spinner";
import { AppSidebar } from "@/features/dashboard/components/app-sidebar";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { Login } from "@/features/auth";
import { EventProvider } from "@/providers/event-provider";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { Toaster } from "@/shared/components/ui/sonner";
import { authClient } from "@/shared/lib/auth-client";
import { cn } from "@/shared/lib/utils";
import { resetAllStores } from "@/stores/store-actions";
import { queryClient } from "./__root";

const log = createLogger("dashboard-layout");

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data: session, isPending } = authClient.useSession();
  const previousUserIdRef = useRef<string | null>(null);
  const location = useLocation();

  // Auto-collapse sidebar on journeys page to give more canvas space
  const isJourneysPage = location.pathname.startsWith("/journeys");
  // MindState builder also needs full height for three-panel layout
  const isMindstateBuilderPage = location.pathname.match(/^\/mindstate\/[^/]+$/) !== null;
  // Agent builder needs full height for canvas
  const isAgentsBuilderPage = location.pathname.match(/^\/agents\/[^/]+$/) !== null;

  // Track user changes and reset stores when user switches
  useEffect(() => {
    const currentUserId = session?.user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    // If user changed (including logout -> login as different user)
    if (previousUserId !== null && currentUserId !== null && previousUserId !== currentUserId) {
      log.info({ previousUserId, currentUserId }, "dashboard:userChanged - resetting stores");
      resetAllStores();
      queryClient.clear();
    }

    // If user logged out, reset stores
    if (previousUserId !== null && currentUserId === null) {
      log.info({ previousUserId }, "dashboard:userLoggedOut - resetting stores");
      resetAllStores();
      queryClient.clear();
    }

    previousUserIdRef.current = currentUserId;
  }, [session?.user?.id]);

  // Show loading while checking session
  if (isPending) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  // Not authenticated - show login
  if (!session) {
    return (
      <>
        <Login />
        <Toaster />
      </>
    );
  }

  // Authenticated - show dashboard with sidebar
  // Collapse sidebar by default on journeys page for more canvas space
  return (
    <EventProvider>
      <SidebarProvider defaultOpen={!isJourneysPage}>
        <AppSidebar />
        <SidebarInset>
          <DashboardHeader />
          <div
            className={cn(
              "flex flex-col",
              // For journeys page, we need full height for the canvas
              // Header is h-14 = 3.5rem, so content should be calc(100svh - 3.5rem)
              // MindState builder and Agent builder also need fixed height for canvas
              (isJourneysPage || isMindstateBuilderPage || isAgentsBuilderPage)
                ? "h-[calc(100svh-3.5rem)] max-h-[calc(100svh-3.5rem)] overflow-hidden"
                : "flex-1"
            )}
          >
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </EventProvider>
  );
}

