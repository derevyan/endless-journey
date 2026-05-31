/**
 * Journey Builder Page
 *
 * Main journey builder page component with canvas, simulator, and error handling.
 * Used by both /journeys and /journeys/$journeySlug routes.
 *
 * @module features/journey/builder/pages/journey-builder-page
 */

import { LayoutTemplate } from "lucide-react";

import { AppLayout } from "@/features/journey/builder/components/app-layout";
import { useJourneyData } from "@/features/journey/builder/hooks/queries/use-journey-data";
import { useJourneyListManifest } from "@/hooks/queries";
import { JourneyDataProvider } from "@/providers/journey-data-provider";
import { ErrorBoundary } from "@/shared/components/common/error-boundary";
import { LoadingSpinner } from "@/shared/components/common/loading-spinner";
import { useSignOut } from "@/shared/hooks";

/**
 * Empty state shown when user has no assigned journeys
 */
function NoJourneysState() {
  const handleSignOut = useSignOut();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-card border rounded-xl p-8 max-w-md shadow-lg text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-muted">
            <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">No Journeys Available</h2>
        <p className="text-muted-foreground mb-6">
          You don't have access to any journeys yet. Contact your administrator to get access, or sign in with a different account.
        </p>
        <button onClick={handleSignOut} className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors">
          Sign out
        </button>
      </div>
    </div>
  );
}

function JourneyBuilderContent() {
  const { loading, error } = useJourneyData();
  const journeyListQuery = useJourneyListManifest();

  // Show loading while fetching journeys
  if (journeyListQuery.isLoading || loading) {
    return <LoadingSpinner message="Loading journeys..." />;
  }

  // Show error if journey fetch failed
  if (journeyListQuery.error || error) {
    const errorMessage = journeyListQuery.error?.message || error?.message || "Unknown error";
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-card border border-destructive/50 rounded-xl p-6 max-w-md shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-2">Error loading journeys</h2>
          <p className="text-muted-foreground">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Show empty state if user has no journeys
  if (journeyListQuery.data && journeyListQuery.data.length === 0) {
    return <NoJourneysState />;
  }

  return <AppLayout />;
}

export function JourneyBuilderPage() {
  return (
    <ErrorBoundary>
      <JourneyDataProvider>
        <div className="h-full w-full flex flex-col">
          <JourneyBuilderContent />
        </div>
      </JourneyDataProvider>
    </ErrorBoundary>
  );
}
