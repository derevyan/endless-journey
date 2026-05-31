/**
 * Tags Settings Page
 *
 * Manage organization-wide user tags.
 *
 * @module routes/_dashboard.settings.tags
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { TagsSection } from "@/features/settings/components/sections/tags-section";

export const Route = createFileRoute("/_dashboard/settings/tags")({
  component: TagsSettingsPage,
});

function TagsSettingsPage() {
  return (
    <ContentSection
      title="Tags"
      desc="Manage organization-wide tags for segmentation, filtering, and CRM."
      className="w-full lg:max-w-full"
    >
      <TagsSection />
    </ContentSection>
  );
}
