/**
 * Variables Settings Page
 *
 * Manage global and journey-scoped variables.
 *
 * @module routes/_dashboard.settings.variables
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { VariablesSection } from "@/features/settings/components/sections/variables-section";

export const Route = createFileRoute("/_dashboard/settings/variables")({
  component: VariablesSettingsPage,
});

function VariablesSettingsPage() {
  return (
    <ContentSection
      title="Variables"
      desc="Manage global and journey-specific variables for storing data like points, badges, and counters."
      className="w-full lg:max-w-full"
    >
      <VariablesSection />
    </ContentSection>
  );
}

