/**
 * Bull Board Service
 *
 * Provides a web UI for monitoring BullMQ queues in development.
 * Available at /admin/queues (dev-only).
 *
 * @module services/bull-board
 */

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createLogger } from "@journey/logger";
import type { Hono } from "hono";

import { getAutomationQueue as getAutomationConsumerQueue } from "../event-bus/consumers/automation-consumer";
import { getDataRetentionQueue } from "./data-retention";
import { getTimerQueue } from "./timers";

const log = createLogger("bull-board");

// =============================================================================
// BULL BOARD SETUP
// =============================================================================

/**
 * Setup Bull Board UI on the Hono app
 *
 * Mounts the Bull Board UI at /admin/queues and registers all active queues.
 * Only call this in development environments.
 *
 * @param app - Hono application instance
 */
export function setupBullBoard(app: Hono<any>): void {
  const serverAdapter = new HonoAdapter(serveStatic);
  serverAdapter.setBasePath("/admin/queues");

  // Collect all available queues
  const queues = [];
  const queueNames = [];

  // Journey Events Queue (automation consumer)
  const automationConsumerQueue = getAutomationConsumerQueue();
  if (automationConsumerQueue) {
    queues.push(new BullMQAdapter(automationConsumerQueue));
    queueNames.push("journey-events");
  }

  // Journey Timers Queue (wait nodes)
  const timerQueue = getTimerQueue();
  if (timerQueue) {
    queues.push(new BullMQAdapter(timerQueue));
    queueNames.push("journey-timers");
  }

  // Data Retention Queue (cleanup for events, interactions, etc.)
  const retentionQueue = getDataRetentionQueue();
  if (retentionQueue) {
    queues.push(new BullMQAdapter(retentionQueue));
    queueNames.push("data-retention");
  }

  if (queues.length === 0) {
    log.warn({}, "bullBoard:noQueues - No queues available to monitor");
    return;
  }

  // Create Bull Board
  createBullBoard({
    queues: queues as any, // Type cast needed for BullMQ v5 compatibility with Bull Board
    serverAdapter,
  });

  // Mount Bull Board routes on the app
  app.route("/admin/queues", serverAdapter.registerPlugin());

  log.info({ queues: queueNames, path: "/admin/queues" }, "bullBoard:initialized");
}
