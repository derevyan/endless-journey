/**
 * Interactive Runner
 *
 * Orchestrates interactive testing mode - runs variations one by one,
 * pausing on failures to let the user decide how to proceed.
 *
 * @module engine/testing/interactive-runner
 */

import type { JourneyConfig } from "@journey/schemas";
import pLimit from "p-limit";
import { VariationExplorer } from "./variation-explorer";
import { VariationRunner } from "./variation-runner";
import { CoverageTracker } from "./coverage-tracker";
import {
  renderStartup,
  renderProgress,
  renderProblem,
  renderInspection,
  renderSummary,
  waitForAction,
  waitForAnyKey,
  clearProgress,
} from "./interactive-ui";
import type {
  TestVariation,
  VariationResult,
  VariationTesterResult,
  InteractiveRunnerOptions,
  InteractiveAction,
  ProblemType,
  ProblemContext,
  JourneyStats,
} from "./types";

// =============================================================================
// INTERACTIVE RUNNER
// =============================================================================

export class InteractiveRunner {
  private journey: JourneyConfig;
  private options: Required<InteractiveRunnerOptions>;
  private variations: TestVariation[];
  private runner: VariationRunner;
  private skippedFamilies: Set<string>;
  private results: VariationResult[];

  constructor(journey: JourneyConfig, options: InteractiveRunnerOptions = {}) {
    this.journey = journey;
    this.options = {
      timeout: options.timeout ?? 30000,
      maxPaths: options.maxPaths ?? 1000,
      fastMode: options.fastMode ?? true, // Default to fast mode for interactive
      concurrency: options.concurrency ?? 500, // Default concurrency for parallel execution
    };
    this.variations = [];
    this.runner = new VariationRunner(journey, {
      timeout: this.options.timeout,
      logLevel: "silent", // Keep UI clean
    });
    this.skippedFamilies = new Set();
    this.results = [];
  }

  /**
   * Run all variations interactively
   * Uses parallel execution with p-limit, then handles failures interactively
   */
  async run(): Promise<VariationTesterResult> {
    const startTime = Date.now();

    // Step 1: Explore variations
    const explorer = new VariationExplorer(this.journey, {
      maxPaths: this.options.maxPaths,
      fastMode: this.options.fastMode,
    });

    this.variations = explorer.explore();

    // Show startup stats
    const stats = this.getStats();
    renderStartup(stats);

    // Step 2: Run variations in parallel with p-limit
    const limit = pLimit(this.options.concurrency);
    let completedCount = 0;
    let failedCount = 0;

    const resultPromises = this.variations.map((variation) =>
      limit(async () => {
        const result = await this.runner.runSingle(variation);

        // Update progress atomically
        completedCount++;
        if (!result.success) failedCount++;
        renderProgress(completedCount, this.variations.length, failedCount, 0);

        return result;
      })
    );

    // Wait for all variations to complete
    this.results = await Promise.all(resultPromises);

    // Clear progress line
    clearProgress();

    // Step 3: Handle failures interactively
    const failures = this.results.filter((r) => !r.success);
    let skippedCount = 0;

    if (failures.length > 0) {
      console.log(`\n⚠️  ${failures.length} variation(s) failed. Reviewing...\n`);

      for (let i = 0; i < failures.length; i++) {
        const result = failures[i];
        const variation = result.variation;
        const variationIndex = this.variations.indexOf(variation) + 1;

        // Check if this variation belongs to a skipped family
        if (this.isSkipped(variation)) {
          skippedCount++;
          continue;
        }

        // Find where it failed in the path
        const failedAtIndex = this.findFailureIndex(variation, result);

        // Build problem context
        const similarVariations = this.getVariationFamily(variation, failedAtIndex);
        const context: ProblemContext = {
          type: this.classifyProblem(result.error || ""),
          variation,
          result,
          variationIndex,
          totalVariations: this.variations.length,
          similarVariations,
          failedAtIndex,
        };

        // Show problem and wait for user action
        const action = await this.handleProblem(context);

        switch (action) {
          case "continue":
            // Just continue to next failure
            break;

          case "inspect":
            // Show detailed inspection
            renderInspection(result, this.journey);
            await waitForAnyKey();
            // After inspection, show problem again
            i--; // Will re-process this failure
            break;

          case "skip_family":
            // Mark all similar variations as reviewed
            this.skipFamily(similarVariations);
            break;

          case "quit":
            // Stop reviewing
            return this.buildResult(startTime, skippedCount);
        }
      }
    }

    // Step 4: Show summary
    const finalResult = this.buildResult(startTime, skippedCount);
    renderSummary(finalResult);

    return finalResult;
  }

  /**
   * Get journey stats for startup display
   */
  private getStats(): JourneyStats {
    const journeyName =
      (this.journey as { name?: string }).name ||
      (this.journey as { id?: string }).id ||
      "Journey";

    return {
      journeyName,
      nodeCount: this.journey.nodes.length,
      edgeCount: this.journey.edges.length,
      variationCount: this.variations.length,
    };
  }

  /**
   * Handle a problem - show it and wait for user action
   */
  private async handleProblem(context: ProblemContext): Promise<InteractiveAction> {
    renderProblem(context);
    return waitForAction();
  }

  /**
   * Check if a variation should be skipped (its family was marked)
   */
  private isSkipped(variation: TestVariation): boolean {
    // Check if any prefix of this variation's path matches a skipped family
    for (let i = 1; i <= variation.path.length; i++) {
      const prefix = variation.path.slice(0, i).join("->");
      if (this.skippedFamilies.has(prefix)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Mark a family of variations to be skipped
   */
  private skipFamily(variations: TestVariation[]): void {
    for (const v of variations) {
      // Add the full path as a skip marker
      const pathKey = v.path.join("->");
      this.skippedFamilies.add(pathKey);
    }
  }

  /**
   * Get all variations that share the same path prefix up to failure point
   */
  private getVariationFamily(
    variation: TestVariation,
    failedAtIndex: number
  ): TestVariation[] {
    // Build the prefix up to and including the failed node
    const prefix = variation.path.slice(0, failedAtIndex + 1).join("->");

    // Find all OTHER variations that share this prefix
    return this.variations.filter((v) => {
      if (v.id === variation.id) return false;
      const vPrefix = v.path.slice(0, failedAtIndex + 1).join("->");
      return vPrefix === prefix;
    });
  }

  /**
   * Find where in the path the failure occurred
   */
  private findFailureIndex(
    variation: TestVariation,
    result: VariationResult
  ): number {
    // The last visited node is likely where it failed
    const lastVisited = result.visitedNodes[result.visitedNodes.length - 1];
    const idx = variation.path.indexOf(lastVisited);
    return idx >= 0 ? idx : variation.path.length - 1;
  }

  /**
   * Classify an error into problem type
   */
  private classifyProblem(error: string): ProblemType {
    const lowerError = error.toLowerCase();

    // Validation/design issues
    if (
      lowerError.includes("validation") ||
      lowerError.includes("unreachable") ||
      lowerError.includes("dead end") ||
      lowerError.includes("no edge found") ||
      lowerError.includes("not in path") ||
      lowerError.includes("orphan") ||
      lowerError.includes("missing")
    ) {
      return "validation";
    }

    // Timeouts
    if (lowerError.includes("timed out") || lowerError.includes("timeout")) {
      return "timeout";
    }

    // Everything else is execution bug
    return "execution";
  }

  /**
   * Create a skipped result for a variation
   */
  private createSkippedResult(variation: TestVariation): VariationResult {
    return {
      variation,
      success: false,
      error: "Skipped (part of failed family)",
      visitedNodes: [],
      messagesSent: [],
      steps: [],
      durationMs: 0,
      finalStatus: "skipped",
    };
  }

  /**
   * Build the final result
   */
  private buildResult(startTime: number, skippedCount: number): VariationTesterResult {
    const journeyId = (this.journey as { id?: string }).id || "unknown";
    const journeyName = (this.journey as { name?: string }).name;

    // Calculate coverage
    const coverageTracker = new CoverageTracker(this.journey);
    coverageTracker.processResults(this.variations, this.results);
    const coverage = coverageTracker.getMetrics();

    // Count results
    const passed = this.results.filter(
      (r) => r.success && r.finalStatus !== "skipped"
    ).length;
    const failed = this.results.filter(
      (r) => !r.success && r.finalStatus !== "skipped"
    ).length;
    const skipped = this.results.filter((r) => r.finalStatus === "skipped").length;

    // Sort: failures first
    const sortedResults = [...this.results].sort((a, b) => {
      if (a.success === b.success) return 0;
      return a.success ? 1 : -1;
    });

    const alternatePaths = this.results.filter((r) => r.status === "alternate_path").length;

    return {
      journeyId,
      journeyName,
      summary: {
        total: this.variations.length,
        passed,
        failed,
        skipped,
        alternatePaths,
        durationMs: Date.now() - startTime,
      },
      coverage,
      results: sortedResults,
      seed: Date.now(),
      timestamp: new Date().toISOString(),
    };
  }
}
