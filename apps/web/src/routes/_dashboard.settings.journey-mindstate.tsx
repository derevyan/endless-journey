/**
 * Journey MindState Settings Route
 *
 * Configure mindstate tracking for each journey.
 *
 * @module routes/_dashboard.settings.journey-mindstate
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { JourneyMindstateSection } from "@/features/settings/components/sections/journey-mindstate-section";

export const Route = createFileRoute("/_dashboard/settings/journey-mindstate")({
  component: JourneyMindstateSettingsPage,
});

function JourneyMindstateSettingsPage() {
  return (
    <ContentSection
      title="Journey MindState"
      desc="Configure which mindstate definitions each journey tracks."
      className="w-full lg:max-w-full"
    >
      <JourneyMindstateSection />
    </ContentSection>
  );
}
