/**
 * Journey Pipelines Settings Page
 *
 * Manage default CRM pipeline assignments for journeys.
 *
 * @module routes/_dashboard.settings.journey-pipelines
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { JourneyPipelinesSection } from "@/features/settings/components/sections/journey-pipelines-section";

export const Route = createFileRoute("/_dashboard/settings/journey-pipelines")({
  component: JourneyPipelinesSettingsPage,
});

function JourneyPipelinesSettingsPage() {
  return (
    <ContentSection
      title="Journey Pipelines"
      desc="Configure default CRM pipelines for each journey. CRM nodes will use these defaults when no explicit pipeline is specified."
      className="w-full lg:max-w-full"
    >
      <JourneyPipelinesSection />
    </ContentSection>
  );
}

