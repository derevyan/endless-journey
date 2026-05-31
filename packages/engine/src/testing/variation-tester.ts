/**
 * Variation Tester
 *
 * Main orchestrator for journey variation testing.
 * Combines exploration, execution, and coverage tracking.
 *
 * @module engine/testing/variation-tester
 */

import { createLogger } from "@journey/logger";
import type { JourneyConfig } from "@journey/schemas";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import pLimit from "p-limit";
import { VariationExplorer } from "./variation-explorer";
import { CoverageTracker } from "./coverage-tracker";
import { RaceConditionTester } from "./race-condition-tester";
import { ProgressReporter, formatReport } from "./coverage-report";
import { EngineBackend } from "./backends/engine-backend";
import type { TestExecutionBackend } from "./backends/types";
import type {
  TestVariation,
  VariationResult,
  VariationTesterResult,
  VariationExplorerOptions,
  VariationRunnerOptions,
  OutputFormat,
} from "./types";

// =============================================================================
// TESTER OPTIONS
// =============================================================================

/**
 * Progress update callback data
 */
export interface ProgressUpdate {
  completed: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  alternatePaths: number;
  currentVariation: string;
  variationsPerSecond: number;
  coverage: {
    nodes: { current: number; total: number };
    edges: { current: number; total: number };
    branches: { current: number; total: number };
  };
  etaMs: number;
}

export interface VariationTesterOptions extends VariationExplorerOptions, VariationRunnerOptions {
  /** Show progress during execution */
  showProgress?: boolean;
  /** Filter variations by pattern (matches ID or description) */
  filter?: string;
  /** Output format */
  format?: OutputFormat;
  /** Journey file path (for identification when name is missing) */
  journeyPath?: string;
  /** Worker threads for parallel execution (default: 1) */
  workers?: number;
  /** Progress callback for dashboard integration */
  onProgress?: (update: ProgressUpdate) => void;
  /** Execution backend (defaults to engine) */
  backend?: TestExecutionBackend;
}

// =============================================================================
// VARIATION TESTER
// =============================================================================

/**
 * Control state for pausing/stopping execution
 */
interface ControlState {
  paused: boolean;
  stopped: boolean;
  failFast: boolean;
  timeScale: number;
}

// Make all options required except onProgress (which remains optional)
type ResolvedOptions = Required<Omit<VariationTesterOptions, "onProgress" | "backend">> & {
  onProgress?: (update: ProgressUpdate) => void;
};

export class VariationTester {
  private journey: JourneyConfig;
  private options: ResolvedOptions;
  private logger: ReturnType<typeof createLogger>;
  private controlState: ControlState;
  private onProgress?: (update: ProgressUpdate) => void;
  private backend: TestExecutionBackend;

  constructor(journey: JourneyConfig, options: VariationTesterOptions = {}) {
    this.journey = journey;
    // Determine if we should show progress (text format with progress enabled)
    const showProgress = options.showProgress ?? (options.format !== "json" && options.format !== "junit");

    this.options = {
      // Explorer options
      maxPaths: options.maxPaths ?? 1000,
      maxDepth: options.maxDepth ?? 100,
      includeDeadEnds: options.includeDeadEnds ?? true,
      textSampleCount: options.textSampleCount ?? 3,
      includeRaceTests: options.includeRaceTests ?? false,
      seed: options.seed ?? Date.now(),
      fastMode: options.fastMode ?? false,
      // Runner options - sensible default based on CPU cores (prevent OOM)
      concurrency: options.concurrency ?? Math.min(500, cpus().length * 50),
      // Default timeout is 120s to accommodate journeys with many delayed nodes
      // (e.g., 40 nodes with 3s delays each could take 120s for some paths)
      timeout: options.timeout ?? 120000,
      failFast: options.failFast ?? false,
      // Suppress logs when showing progress bar to prevent log spam hiding the progress
      logLevel: showProgress ? "silent" : (options.logLevel ?? "error"),
      timeScale: options.timeScale ?? 1,
      // Tester options
      showProgress,
      filter: options.filter ?? "",
      format: options.format ?? "text",
      journeyPath: options.journeyPath ?? "",
      workers: options.workers ?? 1,
      onProgress: options.onProgress,
    };
    this.logger = createLogger("variation-tester");
    this.onProgress = options.onProgress;
    this.backend = options.backend ?? new EngineBackend();

    // Initialize control state
    this.controlState = {
      paused: false,
      stopped: false,
      failFast: this.options.failFast,
      timeScale: this.options.timeScale,
    };
  }

  // =============================================================================
  // CONTROL METHODS
  // =============================================================================

  /**
   * Pause test execution
   */
  pause(): void {
    this.controlState.paused = true;
  }

  /**
   * Resume test execution
   */
  resume(): void {
    this.controlState.paused = false;
  }

  /**
   * Stop test execution
   */
  stop(): void {
    this.controlState.stopped = true;
  }

  /**
   * Toggle fail-fast mode
   */
  setFailFast(enabled: boolean): void {
    this.controlState.failFast = enabled;
  }

  /**
   * Update time scale
   */
  setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }
    this.controlState.timeScale = scale;
    this.options.timeScale = scale;
    this.backend.setTimeScale?.(scale);
  }

  /**
   * Set progress callback for dashboard integration
   */
  setProgressCallback(callback: (update: ProgressUpdate) => void): void {
    this.onProgress = callback;
  }

  /**
   * Check if execution is paused
   */
  isPaused(): boolean {
    return this.controlState.paused;
  }

  /**
   * Check if execution is stopped
   */
  isStopped(): boolean {
    return this.controlState.stopped;
  }

  /**
   * Run the complete test suite
   */
  async run(): Promise<VariationTesterResult> {
    const startTime = Date.now();

    const journeyId = (this.journey as { id?: string }).id || "unknown";
    const journeyName = (this.journey as { name?: string }).name;

    this.logger.info(
      { journeyId, seed: this.options.seed },
      "tester:starting"
    );

    // Step 1: Explore all variations
    const explorer = new VariationExplorer(this.journey, {
      maxPaths: this.options.maxPaths,
      maxDepth: this.options.maxDepth,
      includeDeadEnds: this.options.includeDeadEnds,
      textSampleCount: this.options.textSampleCount,
      includeRaceTests: this.options.includeRaceTests,
      seed: this.options.seed,
      fastMode: this.options.fastMode,
    });

    let variations = explorer.explore();

    this.logger.info(
      { variationCount: variations.length },
      "tester:variationsDiscovered"
    );

    // Step 2: Apply filter if specified
    if (this.options.filter) {
      const pattern = this.options.filter.toLowerCase();
      variations = variations.filter(
        (v) =>
          v.id.toLowerCase().includes(pattern) ||
          (v.description?.toLowerCase().includes(pattern) ?? false)
      );

      this.logger.info(
        { filteredCount: variations.length, pattern: this.options.filter },
        "tester:variationsFiltered"
      );
    }

    // Step 3: Run variations
    const runnerOptions: VariationRunnerOptions = {
      concurrency: this.options.concurrency,
      timeout: this.options.timeout,
      failFast: this.options.failFast,
      logLevel: this.options.logLevel,
      timeScale: this.options.timeScale,
    };

    // Setup progress reporter
    const progress = new ProgressReporter(variations.length, !this.options.showProgress);

    let results: VariationResult[] = [];
    // Track counts for progress emission
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let alternateCount = 0;
    let completedCount = 0;

    try {
      await this.backend.initialize({
        journey: this.journey,
        runnerOptions,
        journeyPath: this.options.journeyPath,
      });

      const workerCount = this.backend.supportsWorkers
        ? this.resolveWorkerCount(variations.length)
        : 1;
      if (workerCount > 1) {
        results = await this.runWithWorkers(variations, runnerOptions, progress, workerCount, startTime);
      } else {
        // Use p-limit for bounded concurrency with continuous throughput
        // This maintains constant CPU pressure by starting new work immediately
        // when any task finishes (unlike chunked execution which waits for all)
        const limit = pLimit(this.options.concurrency);
        let failFastTriggered = false;

        const resultPromises = variations.map((variation) =>
          limit(async () => {
            // Check control state before processing each variation
            await this.waitWhilePaused();

            // Skip if stopped by user
            if (this.controlState.stopped) {
              const skipped = this.createSkippedResult(variation, "Stopped by user");
              skippedCount++;
              completedCount++;
              this.emitProgress(completedCount, variations.length, passedCount, failedCount, skippedCount, alternateCount, variation.id, startTime);
              return skipped;
            }

            // Skip if fail-fast already triggered (respects dynamic controlState.failFast)
            if (this.controlState.failFast && failFastTriggered) {
              const skipped = this.createSkippedResult(variation, "Fail-fast: skipped remaining variations");
              skippedCount++;
              completedCount++;
              this.emitProgress(completedCount, variations.length, passedCount, failedCount, skippedCount, alternateCount, variation.id, startTime);
              return skipped;
            }

            const result = await this.backend.runSingle(variation);
            progress.report(result);

            // Update counts
            completedCount++;
            if (result.status === "passed") passedCount++;
            else if (result.status === "failed") failedCount++;
            else if (result.status === "skipped") skippedCount++;
            else if (result.status === "alternate_path") alternateCount++;

            // Emit progress update
            this.emitProgress(completedCount, variations.length, passedCount, failedCount, skippedCount, alternateCount, variation.id, startTime);

            // Fail fast: signal to skip remaining variations (use dynamic controlState)
            // Note: We don't call limit.clearQueue() because it orphans promise references
            // in resultPromises, causing Promise.all to hang forever. The failFastTriggered
            // flag causes queued tasks to return immediately with "skipped" status instead.
            if (this.controlState.failFast && result.status === "failed") {
              failFastTriggered = true;
            }

            return result;
          })
        );

        // Execute all variations with error recovery
        // We use Promise.all for fail-fast behavior, but wrap in try-catch
        // to collect partial results if something goes catastrophically wrong
        try {
          results = await Promise.all(resultPromises);
        } catch (error) {
          // Collect whatever results completed before the error
          this.logger.error(
            { err: error instanceof Error ? error.message : String(error) },
            "tester:executionError"
          );

          // Use Promise.allSettled to gather partial results
          const settled = await Promise.allSettled(resultPromises);
          results = settled
            .filter((r): r is PromiseFulfilledResult<VariationResult> => r.status === "fulfilled")
            .map((r) => r.value);
        }
      }
    } finally {
      progress.finish();
      await this.backend.teardown();
    }

    // Step 4: Track coverage
    const coverageTracker = new CoverageTracker(this.journey);
    coverageTracker.processResults(variations, results);
    const coverage = coverageTracker.getMetrics();

    // Step 5: Build result
    const passed = results.filter(
      (r) => r.status === "passed" || r.status === "alternate_path"
    ).length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const alternatePaths = results.filter((r) => r.status === "alternate_path").length;

    // Sort results: failures first, then alternate paths, then passed
    const statusOrder: Record<NonNullable<VariationResult["status"]>, number> = {
      failed: 0,
      alternate_path: 1,
      passed: 2,
      skipped: 3,
    };

    results.sort((a, b) => {
      const aOrder = statusOrder[a.status || "passed"] ?? 2;
      const bOrder = statusOrder[b.status || "passed"] ?? 2;
      return aOrder - bOrder;
    });

    const result: VariationTesterResult = {
      journeyId,
      journeyName,
      journeyPath: this.options.journeyPath || undefined,
      backend: { name: this.backend.name },
      summary: {
        total: variations.length,
        passed,
        failed,
        skipped,
        alternatePaths,
        durationMs: Date.now() - startTime,
      },
      coverage,
      results,
      seed: this.options.seed,
      timestamp: new Date().toISOString(),
    };

    this.logger.info(
      {
        passed,
        failed,
        skipped,
        alternatePaths,
        durationMs: result.summary.durationMs,
        coverage: {
          nodes: coverage.nodes.coverage,
          edges: coverage.edges.coverage,
          branches: coverage.branches.coverage,
        },
      },
      "tester:completed"
    );

    return result;
  }

  /**
   * Run and format the output
   */
  async runFormatted(): Promise<string> {
    const result = await this.run();
    return formatReport(result, this.options.format);
  }

  /**
   * Get exploration statistics without running tests
   */
  getStats(): {
    pathCount: number;
    estimatedVariations: number;
    interactiveNodes: number;
    timerNodes: number;
  } {
    const explorer = new VariationExplorer(this.journey, {
      maxPaths: this.options.maxPaths,
      maxDepth: this.options.maxDepth,
      includeDeadEnds: this.options.includeDeadEnds,
      seed: this.options.seed,
      fastMode: this.options.fastMode,
    });

    return explorer.getStats();
  }

  private resolveWorkerCount(totalVariations: number): number {
    if (totalVariations <= 1) return 1;
    const requested = Number.isFinite(this.options.workers) ? this.options.workers : 1;
    const maxWorkers = cpus().length;
    const resolved = requested <= 0 ? maxWorkers : requested;
    return Math.max(1, Math.min(resolved, totalVariations));
  }

  private getWorkerExecArgv(workerUrl: URL): string[] {
    const needsTsx = workerUrl.pathname.endsWith(".ts");
    if (!needsTsx) return process.execArgv;

    const execArgv = [...process.execArgv];
    const hasTsx = execArgv.some((arg) => arg.includes("tsx"));
    if (!hasTsx) {
      execArgv.push("--loader", "tsx");
    }
    return execArgv;
  }

  private async runWithWorkers(
    variations: TestVariation[],
    runnerOptions: VariationRunnerOptions,
    progress: ProgressReporter,
    workerCount: number,
    startTime: number
  ): Promise<VariationResult[]> {
    if (variations.length === 0) return [];

    const workerUrl = new URL("./variation-worker.ts", import.meta.url);
    const execArgv = this.getWorkerExecArgv(workerUrl);
    const results = new Array<VariationResult>(variations.length);

    let nextIndex = 0;
    let completed = 0;
    let failFastTriggered = false;
    let skippedRemaining = false;
    let jobIdCounter = 0;

    // Track counts for progress emission
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let alternateCount = 0;

    const inflight = new Map<number, { index: number; variation: TestVariation }>();
    const workers = Array.from({ length: workerCount }, () =>
      new Worker(workerUrl, {
        workerData: {
          journey: this.journey,
          options: runnerOptions,
        },
        execArgv,
        // @ts-expect-error - type: "module" is valid but not in older type definitions
        type: "module",
      })
    );

    // Store workers for pause/resume control
    const idleWorkers = new Set<Worker>();

    return new Promise<VariationResult[]>((resolve, reject) => {
      let finished = false;

      const finish = async (error?: Error) => {
        if (finished) return;
        finished = true;
        // Add timeout to worker cleanup to prevent hanging
        const WORKER_CLEANUP_TIMEOUT = 5000;
        await Promise.race([
          Promise.all(workers.map((worker) => worker.terminate())),
          new Promise((resolve) => setTimeout(resolve, WORKER_CLEANUP_TIMEOUT)),
        ]);
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      };

      const maybeFinish = () => {
        if (completed >= variations.length) {
          void finish();
        }
      };

      const skipRemaining = (reason: string) => {
        if (skippedRemaining) return;
        skippedRemaining = true;
        for (let i = nextIndex; i < variations.length; i++) {
          const skipped = this.createSkippedResult(variations[i], reason);
          results[i] = skipped;
          progress.report(skipped);
          skippedCount++;
          completed++;
          this.emitProgress(completed, variations.length, passedCount, failedCount, skippedCount, alternateCount, variations[i].id, startTime);
        }
        nextIndex = variations.length;
      };

      const scheduleNext = (worker: Worker) => {
        // Check control state - don't schedule if paused
        if (this.controlState.paused) {
          idleWorkers.add(worker);
          return;
        }

        // Check if stopped by user
        if (this.controlState.stopped) {
          skipRemaining("Stopped by user");
          maybeFinish();
          return;
        }

        // Only skip scheduling if fail-fast is enabled AND triggered, or no more variations
        if ((this.controlState.failFast && failFastTriggered) || nextIndex >= variations.length) {
          return;
        }
        const variation = variations[nextIndex];
        const id = ++jobIdCounter;
        inflight.set(id, { index: nextIndex, variation });
        worker.postMessage({ type: "run", id, variation });
        nextIndex++;
      };

      // Resume scheduling when unpaused
      const resumeScheduling = () => {
        for (const worker of idleWorkers) {
          scheduleNext(worker);
        }
        idleWorkers.clear();
      };

      // Poll for pause state changes (simple approach)
      const pauseCheckInterval = setInterval(() => {
        if (!this.controlState.paused && idleWorkers.size > 0) {
          resumeScheduling();
        }
        if (this.controlState.stopped && !skippedRemaining) {
          skipRemaining("Stopped by user");
          maybeFinish();
        }
        if (finished) {
          clearInterval(pauseCheckInterval);
        }
      }, 50); // Reduced from 100ms for better responsiveness

      for (const worker of workers) {
        worker.on("message", (message: { type: string; id: number; result?: VariationResult; error?: string; stack?: string }) => {
          if (message.type !== "result" && message.type !== "error") return;
          const job = inflight.get(message.id);
          if (!job) return;
          inflight.delete(message.id);

          const result = message.type === "result" && message.result
            ? message.result
            : this.createWorkerErrorResult(job.variation, message.error, message.stack);

          results[job.index] = result;
          progress.report(result);
          completed++;

          // Update counts
          if (result.status === "passed") passedCount++;
          else if (result.status === "failed") failedCount++;
          else if (result.status === "skipped") skippedCount++;
          else if (result.status === "alternate_path") alternateCount++;

          // Emit progress update
          this.emitProgress(completed, variations.length, passedCount, failedCount, skippedCount, alternateCount, job.variation.id, startTime);

          // Use dynamic controlState.failFast instead of static options
          if (this.controlState.failFast && result.status === "failed") {
            failFastTriggered = true;
            skipRemaining("Fail-fast: skipped remaining variations");
          }

          scheduleNext(worker);
          maybeFinish();
        });

        worker.on("error", (error) => {
          void finish(error);
        });

        worker.on("exit", (code) => {
          if (code !== 0 && !finished) {
            void finish(new Error(`Worker exited with code ${code}`));
          }
        });

        scheduleNext(worker);
      }
    });
  }

  private createWorkerErrorResult(
    variation: TestVariation,
    error?: string,
    stack?: string
  ): VariationResult {
    return {
      variation,
      success: false,
      status: "failed",
      error: error || "Worker failed to execute variation",
      stack,
      visitedNodes: [],
      messagesSent: [],
      steps: [],
      durationMs: 0,
      finalStatus: "failed",
    };
  }

  private createSkippedResult(variation: TestVariation, reason: string): VariationResult {
    return {
      variation,
      success: false,
      status: "skipped",
      error: reason,
      visitedNodes: [],
      messagesSent: [],
      steps: [],
      durationMs: 0,
      finalStatus: "skipped",
    };
  }

  // =============================================================================
  // CONTROL LOOP HELPERS
  // =============================================================================

  /**
   * Wait while execution is paused (checks every 50ms)
   */
  private async waitWhilePaused(): Promise<void> {
    while (this.controlState.paused && !this.controlState.stopped) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Emit progress update to callback if registered
   */
  private emitProgress(
    completed: number,
    total: number,
    passed: number,
    failed: number,
    skipped: number,
    alternatePaths: number,
    currentVariation: string,
    startTime: number,
    coverage?: { nodes: { visited: number; total: number }; edges: { traversed: number; total: number }; branches: { taken: number; total: number } }
  ): void {
    if (!this.onProgress) return;

    const elapsed = Date.now() - startTime;
    const variationsPerSecond = elapsed > 0 ? (completed / elapsed) * 1000 : 0;
    const remaining = total - completed;
    const etaMs = variationsPerSecond > 0 ? (remaining / variationsPerSecond) * 1000 : 0;

    this.onProgress({
      completed,
      total,
      passed,
      failed,
      skipped,
      alternatePaths,
      currentVariation,
      variationsPerSecond,
      coverage: coverage
        ? {
            nodes: { current: coverage.nodes.visited, total: coverage.nodes.total },
            edges: { current: coverage.edges.traversed, total: coverage.edges.total },
            branches: { current: coverage.branches.taken, total: coverage.branches.total },
          }
        : {
            nodes: { current: 0, total: 0 },
            edges: { current: 0, total: 0 },
            branches: { current: 0, total: 0 },
          },
      etaMs,
    });
  }

  /**
   * Run only race condition tests
   */
  async runRaceTests(): Promise<{
    passed: boolean;
    report: string;
    details: Awaited<ReturnType<RaceConditionTester["runAllTests"]>>;
  }> {
    const tester = new RaceConditionTester(this.journey);
    const details = await tester.runAllTests();

    const { formatRaceConditionReport } = await import("./race-condition-tester");
    const report = formatRaceConditionReport(details);

    return {
      passed: details.failed === 0,
      report,
      details,
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick test a journey with default options
 */
export async function testJourney(
  journey: JourneyConfig,
  options?: VariationTesterOptions
): Promise<VariationTesterResult> {
  const tester = new VariationTester(journey, options);
  return tester.run();
}

/**
 * Quick test and get formatted output
 */
export async function testJourneyFormatted(
  journey: JourneyConfig,
  options?: VariationTesterOptions
): Promise<string> {
  const tester = new VariationTester(journey, options);
  return tester.runFormatted();
}
