/**
 * Profile Settings Page
 *
 * User profile information and settings.
 *
 * @module routes/_dashboard.settings.profile
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { ProfileSection } from "@/features/settings/components/sections/profile-section";

export const Route = createFileRoute("/_dashboard/settings/profile")({
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  return (
    <ContentSection title="Profile" desc="Your account information and profile details.">
      <ProfileSection />
    </ContentSection>
  );
}

