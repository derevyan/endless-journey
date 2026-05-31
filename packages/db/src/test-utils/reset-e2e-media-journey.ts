/**
 * E2E Media Test Journey Reset
 *
 * Standalone reset script for the e2e-media-test journey.
 * Kept separate from cleanup-helpers.ts to avoid JSON import issues with Playwright.
 *
 * @module test-utils/reset-e2e-media-journey
 */

import { createLogger, serializeError } from "@journey/logger";
import type { JourneyConfig } from "@journey/schemas";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { journeys } from "../schema";

const log = createLogger("db:test:reset-e2e-media");

// E2E Media Test Journey slug - matches JOURNEY_CONFIGS entry
const E2E_MEDIA_TEST_SLUG = "e2e-media-test";

// Original journey configuration (matches journey.json + content.json merged)
// This is the clean state without any media uploads
// Uses type assertion since the minimal config satisfies runtime requirements
const E2E_MEDIA_TEST_CONFIG = {
  nodes: [
    {
      id: "start",
      type: "custom",
      data: {
        label: "START",
        type: "start",
        content: "E2E Media Test Journey",
      },
      position: { x: 450, y: 0 },
      metadata: {},
    },
    {
      id: "message",
      type: "custom",
      data: {
        label: "Test Media",
        type: "message",
        content: "Test node for media upload e2e tests",
        responseType: "buttons",
        buttons: [
          {
            id: "btn-done",
            text: "Done",
            targetNodeId: "end",
          },
        ],
      },
      position: { x: 450, y: 200 },
      metadata: {},
    },
    {
      id: "end",
      type: "custom",
      data: {
        label: "END",
        type: "end",
        content: "Test complete",
      },
      position: { x: 450, y: 400 },
      metadata: {},
    },
  ],
  edges: [
    {
      id: "e-start-message",
      source: "start",
      target: "message",
      label: "",
      edgeType: "default",
      animated: false,
      style: { stroke: "#64748b", strokeWidth: 1.5 },
    },
    {
      id: "managed-btn::message::btn-done",
      source: "message",
      target: "end",
      sourceHandle: "btn-done",
      edgeType: "default",
      animated: false,
      managed: true,
      managedBy: "button-btn-done",
      style: { stroke: "#22c55e", strokeWidth: 1.5 },
    },
  ],
} as JourneyConfig;

/**
 * Reset the e2e-media-test journey to its original configuration.
 * This removes any media URLs or other changes made during tests.
 *
 * Call this in beforeAll of media upload tests to ensure clean state.
 */
export async function resetE2EMediaTestJourney(): Promise<boolean> {
  try {
    // Update the journey configuration back to original
    const result = await db
      .update(journeys)
      .set({
        configuration: E2E_MEDIA_TEST_CONFIG,
        updatedAt: new Date(),
      })
      .where(eq(journeys.slug, E2E_MEDIA_TEST_SLUG))
      .returning({ id: journeys.id });

    if (result.length > 0) {
      log.info({ slug: E2E_MEDIA_TEST_SLUG }, "E2E media test journey reset to original configuration");
      return true;
    }

    log.warn({ slug: E2E_MEDIA_TEST_SLUG }, "E2E media test journey not found in database");
    return false;
  } catch (error) {
    log.error({ err: serializeError(error) }, "resetE2EMediaTestJourney:error");
    return false;
  }
}
