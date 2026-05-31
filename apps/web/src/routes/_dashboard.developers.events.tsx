/**
 * Events/Logs Page Route
 *
 * Developer tools page for viewing and filtering event logs.
 *
 * @module routes/_dashboard.developers.events
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EventsPage } from "@/features/developers/components/events/events-page";

const searchSchema = z.object({
  tab: z.enum(["journey", "crm", "llm"]).optional(),
});

export const Route = createFileRoute("/_dashboard/developers/events")({
  validateSearch: searchSchema,
  component: EventsPageRoute,
});

function EventsPageRoute() {
  return <EventsPage />;
}



