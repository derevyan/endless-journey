/**
 * General Settings Page
 *
 * Default settings page showing general application settings.
 *
 * @module routes/_dashboard.settings.index
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { GeneralSettingsForm } from "@/features/settings/components/sections/general-section";

export const Route = createFileRoute("/_dashboard/settings/")({
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  return (
    <ContentSection title="General" desc="Settings and options for your application." className="w-full lg:max-w-full">
      <GeneralSettingsForm />
    </ContentSection>
  );
}

