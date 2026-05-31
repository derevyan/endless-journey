/**
 * Organisation Settings Page
 *
 * Organisation management and member settings.
 *
 * @module routes/_dashboard.settings.organisation
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { OrganisationSection } from "@/features/settings/components/sections/organisation-section";

export const Route = createFileRoute("/_dashboard/settings/organisation")({
  component: OrganisationSettingsPage,
});

function OrganisationSettingsPage() {
  return (
    <ContentSection title="Organisation" desc="Manage your organisation settings and team members.">
      <OrganisationSection />
    </ContentSection>
  );
}

