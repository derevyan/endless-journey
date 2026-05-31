/**
 * Messaging Integrations Settings Page
 *
 * Manage connected messaging platforms (Telegram, WhatsApp, etc.).
 *
 * @module routes/_dashboard.settings.channels
 */

import { createFileRoute } from "@tanstack/react-router";

import { ContentSection } from "@/features/settings/components/content-section";
import { ConnectedSection } from "@/features/settings/components/sections/connected-section";

export const Route = createFileRoute("/_dashboard/settings/channels")({
  component: ChannelsSettingsPage,
});

function ChannelsSettingsPage() {
  return (
    <ContentSection
      title="Messaging Integrations"
      desc="Manage your connected messaging platforms and integrations."
      className="w-full lg:max-w-full"
    >
      <ConnectedSection />
    </ContentSection>
  );
}

