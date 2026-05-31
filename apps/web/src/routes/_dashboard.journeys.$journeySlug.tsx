/**
 * Journey Builder Route (with journey slug)
 *
 * Handles /journeys/:journeySlug routes for viewing/editing specific journeys.
 * Session can still be passed as query param: /journeys/slug?session=file.json
 *
 * @module routes/_dashboard.journeys.$journeySlug
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { JourneyBuilderPage } from "@/features/journey/builder/pages/journey-builder-page";

// Session remains as optional query param
const searchSchema = z.object({
  session: z.string().optional(),
});

export const Route = createFileRoute("/_dashboard/journeys/$journeySlug")({
  validateSearch: searchSchema,
  component: JourneyBuilderPage,
});
