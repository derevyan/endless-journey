/**
 * Coverage Report Formatter
 *
 * Formats coverage metrics and test results into human-readable
 * and machine-readable formats (text, JSON, JUnit).
 *
 * @module engine/testing/coverage-report
 */

import type {
  CoverageMetrics,
  VariationTesterResult,
  VariationResult,
  OutputFormat,
} from "./types";

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Format test results for output
 */
export function formatReport(
  result: VariationTesterResult,
  format: OutputFormat
): string {
  switch (format) {
    case "json":
      return formatJSON(result);
    case "junit":
      return formatJUnit(result);
    case "text":
    default:
      return formatText(result);
  }
}

/**
 * Format as human-readable text
 */
function formatText(result: VariationTesterResult): string {
  const lines: string[] = [];

  // Header
  lines.push("Journey Variation Tester");
  lines.push("=" .repeat(50));
  lines.push("");

  // Journey info
  lines.push(`Journey: ${result.journeyName || result.journeyId}`);
  if (result.backend?.name) {
    lines.push(`Backend: ${result.backend.name}`);
  }
  lines.push(`Seed: ${result.seed}`);
  lines.push("");

  // Summary
  const { summary } = result;
  const statusIcon = summary.failed === 0 ? "PASSED" : "FAILED";
  lines.push(`${statusIcon}: ${summary.passed}/${summary.total} variations`);
  lines.push("");

  // Coverage
  lines.push("Coverage:");
  lines.push(`  Nodes:    ${formatCoverage(result.coverage.nodes.visited, result.coverage.nodes.total)}`);
  lines.push(`  Edges:    ${formatCoverage(result.coverage.edges.traversed, result.coverage.edges.total)}`);
  if (result.coverage.branches.total > 0) {
    lines.push(`  Branches: ${formatCoverage(result.coverage.branches.taken, result.coverage.branches.total)}`);
  }
  if (result.coverage.inputs.totalNodes > 0) {
    lines.push(`  Inputs:   ${formatCoverage(result.coverage.inputs.fullyCovered, result.coverage.inputs.totalNodes)}`);
  }
  lines.push("");

  // Failures
  const failures = result.results.filter((r) => !r.success);
  if (failures.length > 0) {
    lines.push("Failures:");
    lines.push("-".repeat(50));
    lines.push("");

    for (let i = 0; i < failures.length; i++) {
      const failure = failures[i];
      lines.push(`${i + 1}. ${failure.variation.id}`);
      lines.push(`   Path: ${failure.variation.path.join(" -> ")}`);
      if (failure.variation.description) {
        lines.push(`   Description: ${failure.variation.description}`);
      }
      lines.push("");
      lines.push(`   Error: ${failure.error}`);
      lines.push("");
      lines.push(`   Visited: ${failure.visitedNodes.join(" -> ")}`);
      lines.push("");
      lines.push(`   Reproduction:`);
      const backendArg = result.backend?.name && result.backend.name !== "engine"
        ? ` --backend ${result.backend.name}`
        : "";
      lines.push(`     journey-test <journey>${backendArg} --filter "${failure.variation.id}"`);
      lines.push("");
    }
  }

  // Timing
  lines.push(`Time: ${formatDuration(summary.durationMs)}`);
  lines.push(`Timestamp: ${result.timestamp}`);

  return lines.join("\n");
}

/**
 * Format as JSON
 */
function formatJSON(result: VariationTesterResult): string {
  // Convert Sets to arrays for JSON serialization
  const serializable = {
    ...result,
    coverage: {
      ...result.coverage,
      inputs: {
        ...result.coverage.inputs,
        details: result.coverage.inputs.details.map((d) => ({
          ...d,
          clickedButtons: Array.from(d.clickedButtons),
        })),
      },
    },
    results: result.results.map((r) => ({
      ...r,
      variation: {
        ...r.variation,
        // Simplify for JSON output
      },
    })),
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Format as JUnit XML (for CI integration)
 */
function formatJUnit(result: VariationTesterResult): string {
  const { summary } = result;
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  const suiteName = result.backend?.name
    ? `JourneyVariationTester (${result.backend.name})`
    : "JourneyVariationTester";
  lines.push(
    `<testsuite name="${escapeXml(suiteName)}" tests="${summary.total}" failures="${summary.failed}" skipped="${summary.skipped}" time="${summary.durationMs / 1000}">`
  );

  for (const variation of result.results) {
    const testName = escapeXml(variation.variation.id);
    const className = escapeXml(result.journeyId);
    const time = variation.durationMs / 1000;

    if (variation.success) {
      lines.push(`  <testcase name="${testName}" classname="${className}" time="${time}" />`);
    } else {
      lines.push(`  <testcase name="${testName}" classname="${className}" time="${time}">`);
      lines.push(`    <failure message="${escapeXml(variation.error || "Unknown error")}">`);
      lines.push(`Path: ${variation.variation.path.join(" -> ")}`);
      lines.push(`Visited: ${variation.visitedNodes.join(" -> ")}`);
      if (variation.stack) {
        lines.push(`\nStack trace:\n${escapeXml(variation.stack)}`);
      }
      lines.push(`    </failure>`);
      lines.push(`  </testcase>`);
    }
  }

  lines.push("</testsuite>");

  return lines.join("\n");
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format coverage as "X/Y (Z%)"
 */
function formatCoverage(covered: number, total: number): string {
  const percentage = total > 0 ? Math.round((covered / total) * 100) : 100;
  return `${covered}/${total} (${percentage}%)`;
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// =============================================================================
// PROGRESS REPORTER
// =============================================================================

/**
 * Progress reporter for CLI output
 */
export class ProgressReporter {
  private total: number;
  private completed: number = 0;
  private failed: number = 0;
  private startTime: number;
  private silent: boolean;

  constructor(total: number, silent = false) {
    this.total = total;
    this.startTime = Date.now();
    this.silent = silent;
  }

  /**
   * Report progress on a completed variation
   */
  report(result: VariationResult): void {
    this.completed++;
    const status = result.status ?? (result.success ? "passed" : "failed");
    if (status === "failed") this.failed++;

    if (this.silent) return;

    const percentage = Math.round((this.completed / this.total) * 100);
    const elapsed = Date.now() - this.startTime;
    const eta = this.total > this.completed
      ? Math.round((elapsed / this.completed) * (this.total - this.completed))
      : 0;

    // Simple progress bar
    const barWidth = 30;
    const filled = Math.round((this.completed / this.total) * barWidth);
    const bar = "=".repeat(filled) + " ".repeat(barWidth - filled);

    process.stdout.write(
      `\rRunning... [${bar}] ${percentage}% (${this.completed}/${this.total}) ` +
      `${this.failed > 0 ? `[${this.failed} failed] ` : ""}` +
      `ETA: ${formatDuration(eta)}  `
    );
  }

  /**
   * Finish progress reporting
   */
  finish(): void {
    if (!this.silent) {
      process.stdout.write("\n");
    }
  }
}
