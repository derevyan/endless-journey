/**
 * Import / Export Settings Route
 *
 * Settings page for importing and exporting journey configurations.
 *
 * @module routes/_dashboard.settings.import-export
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { ImportExportSection } from "@/features/settings/components/sections/import-export-section";

export const Route = createFileRoute("/_dashboard/settings/import-export")({
  component: ImportExportSettingsPage,
});

function ImportExportSettingsPage() {
  return (
    <ContentSection title="Import / Export" desc="Import and export journey configurations.">
      <ImportExportSection />
    </ContentSection>
  );
}
