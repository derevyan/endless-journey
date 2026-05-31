/**
 * Engine Benchmark Harness
 *
 * Lightweight benchmark script for baseline measurements:
 * - Engine start time on auto-transition journeys
 * - Per-event handling time on text-response journeys
 *
 * Run with: pnpm tsx packages/engine/src/testing/benchmark-harness.ts
 */

import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createLogger } from "@journey/logger";
import type { EnhancedUserJourney, JourneyConfig } from "@journey/schemas";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "../validation/mock-adapter";
import { generateLinearJourney } from "../__tests__/generators/journey-generator";

const log = createLogger("engine-benchmark");

interface BenchmarkResult {
  nodeCount: number;
  startupMs: number;
  eventAvgMs: number;
  eventP95Ms: number;
  eventSamples: number;
}

function createSession(journeyId: string, sessionId = "bench-session", userId = "bench-user"): EnhancedUserJourney {
  const now = new Date().toISOString();
  return {
    sessionId,
    userId,
    platformUserId: userId,
    journeyId,
    currentNodeId: "",
    status: "active",
    context: {},
    tags: [],
    pendingTimers: [],
    pendingPluginFollowUps: [],
    nodeOutputs: {},
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    hasStarted: false,
    history: [],
  };
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function measureStartup(journey: JourneyConfig): Promise<number> {
  const adapter = new MockMessagingAdapter();
  const session = createSession("bench-start");
  const engine = new SessionEngine(session, journey, adapter);

  const start = performance.now();
  await engine.start();
  const end = performance.now();

  return end - start;
}

async function measureEventHandling(journey: JourneyConfig, iterations: number): Promise<{ avgMs: number; p95Ms: number; samples: number }> {
  const adapter = new MockMessagingAdapter();
  const session = createSession("bench-event");
  const engine = new SessionEngine(session, journey, adapter);

  await engine.start();

  const timings: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await adapter.simulateMessage(`benchmark-${i}`, session.userId, session.sessionId);
    const end = performance.now();
    timings.push(end - start);
  }

  const avgMs = timings.reduce((sum, value) => sum + value, 0) / (timings.length || 1);
  return { avgMs, p95Ms: percentile(timings, 95), samples: timings.length };
}

async function runBenchmarks(): Promise<BenchmarkResult[]> {
  const sizes = [200, 1000];
  const results: BenchmarkResult[] = [];

  for (const nodeCount of sizes) {
    const textJourney = generateLinearJourney(nodeCount, { responseType: "text", seed: 1337 });
    const iterations = Math.min(20, Math.max(5, Math.floor(nodeCount / 10)), Math.max(1, nodeCount - 1));

    const startupMs = await measureStartup(textJourney);
    const eventStats = await measureEventHandling(textJourney, iterations);

    results.push({
      nodeCount,
      startupMs,
      eventAvgMs: eventStats.avgMs,
      eventP95Ms: eventStats.p95Ms,
      eventSamples: eventStats.samples,
    });
  }

  return results;
}

export async function runBenchmarkHarness(): Promise<void> {
  log.info({ nodeVersion: process.version, platform: process.platform, arch: process.arch }, "benchmark:env");

  const results = await runBenchmarks();
  for (const result of results) {
    log.info(
      {
        nodeCount: result.nodeCount,
        startupMs: Number(result.startupMs.toFixed(2)),
        eventAvgMs: Number(result.eventAvgMs.toFixed(2)),
        eventP95Ms: Number(result.eventP95Ms.toFixed(2)),
        eventSamples: result.eventSamples,
      },
      "benchmark:result"
    );
  }
}

const isMain = resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
if (isMain) {
  runBenchmarkHarness().catch((error) => {
    log.error({ err: error }, "benchmark:failed");
    process.exitCode = 1;
  });
}
