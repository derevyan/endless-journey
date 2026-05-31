/**
 * Simulator Timer Service
 *
 * Data access for simulator timer queries.
 *
 * @module modules/simulator/services/timer-service
 */

import { durableTimers } from "@journey/db";
import { and, eq, inArray } from "drizzle-orm";

import type { SimulatorServiceContext } from "./service-context";

type TimerStatus = NonNullable<typeof durableTimers.$inferSelect["status"]>;

export async function listTimersByStatus(ctx: SimulatorServiceContext, sessionId: string, statuses: TimerStatus[]) {
  return ctx.db.query.durableTimers.findMany({
    where: and(
      eq(durableTimers.sessionId, sessionId),
      inArray(durableTimers.status, statuses)
    ),
  });
}

export async function getTimerByStatus(ctx: SimulatorServiceContext, sessionId: string, edgeId: string, statuses: TimerStatus[]) {
  return ctx.db.query.durableTimers.findFirst({
    where: and(
      eq(durableTimers.sessionId, sessionId),
      eq(durableTimers.edgeId, edgeId),
      inArray(durableTimers.status, statuses)
    ),
  });
}

export async function listActiveTimers(ctx: SimulatorServiceContext, sessionId: string) {
  return listTimersByStatus(ctx, sessionId, ["active"]);
}

export async function getActiveTimer(ctx: SimulatorServiceContext, sessionId: string, edgeId: string) {
  return getTimerByStatus(ctx, sessionId, edgeId, ["active"]);
}
