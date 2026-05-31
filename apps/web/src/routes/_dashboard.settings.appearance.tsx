/**
 * Appearance Settings Page
 *
 * Theme and visual customization settings.
 *
 * @module routes/_dashboard.settings.appearance
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { AppearanceSection } from "@/features/settings/components/sections/appearance-section";

export const Route = createFileRoute("/_dashboard/settings/appearance")({
  component: AppearanceSettingsPage,
});

function AppearanceSettingsPage() {
  return (
    <ContentSection title="Appearance" desc="Customize how the app looks and feels.">
      <AppearanceSection />
    </ContentSection>
  );
}
