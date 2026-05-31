/**
 * Blade Runner - Enhanced Reporter
 *
 * Beautiful, informative test result display with:
 * - Dashboard-style summary
 * - Issue diagnosis with actionable fixes
 * - Coverage visualization
 * - Export capabilities
 *
 * @module engine/testing/blade-runner/reporter
 */

import type { JourneyConfig } from "@journey/schemas";
import type { VariationTesterResult, CoverageMetrics, VariationResult } from "../types";
import type { BladeRunnerResult, IssueGroup, ExportFormat } from "./types";
import { diagnoseAllFailures, getIssueSummary, getCategoryIcon } from "./diagnosis";
import {
  style,
  icons,
  box,
  heavyLine,
  horizontalLine,
  progressBar,
  percentage,
  formatDuration,
  formatNumber,
  padRight,
  padLeft,
  center,
  twoColumns,
  keyValue,
  waitForKey,
  showCursor,
  hideCursor,
  visualLength,
} from "./ui";

// =============================================================================
// CONSTANTS
// =============================================================================

const REPORT_WIDTH = 65;

// =============================================================================
// RESULT ENHANCEMENT
// =============================================================================

/**
 * Enhance a basic test result with diagnosis
 */
export function enhanceResult(
  result: VariationTesterResult,
  testLevel: string,
  journey?: JourneyConfig
): BladeRunnerResult {
  const issues = diagnoseAllFailures(result.results, journey);
  const issueSummary = getIssueSummary(issues);

  const durationSeconds = result.summary.durationMs / 1000;
  const variationsPerSecond =
    durationSeconds > 0 ? Math.round(result.summary.total / durationSeconds) : 0;
  const avgVariationMs =
    result.summary.total > 0
      ? Math.round(result.summary.durationMs / result.summary.total)
      : 0;

  return {
    ...result,
    issues,
    issueSummary,
    testLevel: testLevel as BladeRunnerResult["testLevel"],
    performance: {
      variationsPerSecond,
      avgVariationMs,
    },
  };
}

// =============================================================================
// SUMMARY DASHBOARD
// =============================================================================

/**
 * Render the main results header
 */
function renderResultsHeader(result: BladeRunnerResult): void {
  const { summary } = result;
  const status = summary.failed === 0 ? style.success("PASSED") : style.error("FAILED");

  console.log("");
  console.log(style.cyan(`${icons.sword}  BLADE RUNNER`));
  console.log(style.dim(horizontalLine(REPORT_WIDTH)));
  console.log("");
  console.log(`   Test Complete: ${status}`);
  console.log(`   ${style.dim(`${summary.passed}/${summary.total} variations passed`)}`);
  if (result.backend?.name) {
    console.log(`   ${style.dim(`Backend: ${result.backend.name}`)}`);
  }
  console.log("");
}

/**
 * Render the results summary section
 */
function renderResultsSummary(result: BladeRunnerResult): void {
  const { summary, coverage } = result;
  const passRate = percentage(summary.passed, summary.total);
  const alternatePaths = summary.alternatePaths || 0;

  // Results section
  console.log(style.bold("  RESULTS"));
  console.log(style.dim(`  ${horizontalLine(30)}`));

  // Show passed with alternate paths breakdown if any
  let passedStr: string;
  if (alternatePaths > 0) {
    const directPassed = summary.passed - alternatePaths;
    passedStr = `${padLeft(String(summary.passed), 6)} ${style.dim(`(${passRate})`)}`;
    console.log(`  ${style.success("✓")} Passed:  ${passedStr}`);
    console.log(`    ${style.cyan("↳")} ${style.dim(`${alternatePaths} via alternate paths`)}`);
  } else {
    passedStr = `${padLeft(String(summary.passed), 6)} ${style.dim(`(${passRate})`)}`;
    console.log(`  ${style.success("✓")} Passed:  ${passedStr}`);
  }

  const failedStr = summary.failed > 0
    ? style.error(padLeft(String(summary.failed), 6))
    : padLeft(String(summary.failed), 6);
  const skippedStr = padLeft(String(summary.skipped), 6);

  console.log(`  ${summary.failed > 0 ? style.error("✗") : style.dim("✗")} Failed:  ${failedStr}`);
  console.log(`  ${style.dim("○")} Skipped: ${skippedStr}`);
  console.log("");

  // Coverage section
  console.log(style.bold("  COVERAGE"));
  console.log(style.dim(`  ${horizontalLine(30)}`));
  console.log(`  ${formatCoverageLine("Nodes", coverage.nodes.visited, coverage.nodes.total)}`);
  console.log(`  ${formatCoverageLine("Edges", coverage.edges.traversed, coverage.edges.total)}`);
  console.log(`  ${formatCoverageLine("Branches", coverage.branches.taken, coverage.branches.total)}`);
  console.log("");

  // Performance section
  console.log(style.bold("  PERFORMANCE"));
  console.log(style.dim(`  ${horizontalLine(30)}`));
  console.log(`  Duration:  ${style.cyan(formatDuration(summary.durationMs))}`);
  console.log(`  Rate:      ${style.cyan(formatNumber(result.performance.variationsPerSecond))} ${style.dim("variations/sec")}`);
  console.log("");
}

/**
 * Format a coverage line with bar
 */
function formatCoverageLine(label: string, current: number, total: number): string {
  const pct = percentage(current, total);
  const bar = progressBar(current, total, 12);
  const pctNum = total > 0 ? Math.round((current / total) * 100) : 0;

  // Color the bar based on coverage percentage
  let coloredBar = bar;
  if (pctNum >= 80) {
    coloredBar = style.success(bar);
  } else if (pctNum >= 50) {
    coloredBar = style.warning(bar);
  } else {
    coloredBar = style.error(bar);
  }

  return `${padRight(label, 10)} ${style.dim(padLeft(current + "/" + total, 7))} ${padLeft(pct, 4)} ${coloredBar}`;
}

// =============================================================================
// ISSUE DISPLAY
// =============================================================================

/**
 * Render alternate paths breakdown (if any)
 */
function renderAlternatePathsSection(result: BladeRunnerResult): void {
  const alternatePaths = result.summary.alternatePaths || 0;
  if (alternatePaths === 0) return;

  // Count alternate paths by reason
  const byReason: Record<string, number> = {};
  for (const r of result.results) {
    if (r.status === "alternate_path" && r.alternatePath) {
      byReason[r.alternatePath.reason] = (byReason[r.alternatePath.reason] || 0) + 1;
    }
  }

  console.log(style.bold("  ALTERNATE PATHS"));
  console.log(style.dim(`  ${horizontalLine(30)}`));
  console.log(`  ${style.cyan(`${alternatePaths} variations took valid alternate routes`)}`);

  for (const [reason, count] of Object.entries(byReason)) {
    const icon =
      reason === "text_response"
        ? "💬"
        : reason === "timeout"
          ? "⏰"
          : reason === "plugin_button"
            ? "🔌"
            : reason === "condition_branch"
              ? "🔀"
              : reason === "guard_fallback"
                ? "🛡️"
                : "❓";
    const label = reason.replace("_", " ");
    console.log(`    ${icon} ${label}: ${count}`);
  }

  console.log("");
}

/**
 * Render the issues summary section
 */
function renderIssuesSummary(result: BladeRunnerResult): void {
  // First show alternate paths if any
  renderAlternatePathsSection(result);

  if (result.issues.length === 0) {
    console.log(style.dim(horizontalLine(REPORT_WIDTH)));
    console.log("");
    console.log(`  ${style.success("✓")} All variations passed! No issues found.`);
    console.log("");
    return;
  }

  console.log(style.bold("  ISSUES"));
  console.log(style.dim(`  ${horizontalLine(30)}`));

  const { issueSummary } = result;

  if (issueSummary.journeyDesign > 0) {
    console.log("");
    console.log(`  ${style.error("🎨 Journey Design")} ${style.dim(`(${issueSummary.journeyDesign})`)}`);
    renderIssuesByCategory(result.issues, "journey_design");
  }

  if (issueSummary.engineBugs > 0) {
    console.log("");
    console.log(`  ${style.error("🐛 Engine Bugs")} ${style.dim(`(${issueSummary.engineBugs})`)}`);
    renderIssuesByCategory(result.issues, "engine_bug");
  }

  if (issueSummary.testLimitations > 0) {
    console.log("");
    console.log(`  ${style.warning("🧪 Test Limitations")} ${style.dim(`(${issueSummary.testLimitations})`)}`);
    renderIssuesByCategory(result.issues, "test_limitation");
  }

  if (issueSummary.timeouts > 0) {
    console.log("");
    console.log(`  ${style.warning("⏰ Timeouts")} ${style.dim(`(${issueSummary.timeouts})`)}`);
    renderIssuesByCategory(result.issues, "timeout");
  }

  if (issueSummary.pathDivergence > 0) {
    console.log("");
    console.log(`  ${style.dim("🔀 Path Divergence")} ${style.dim(`(${issueSummary.pathDivergence})`)}`);
    renderIssuesByCategory(result.issues, "path_divergence");
  }

  if (issueSummary.unknown > 0) {
    console.log("");
    console.log(`  ${style.dim("❓ Unknown")} ${style.dim(`(${issueSummary.unknown})`)}`);
    renderIssuesByCategory(result.issues, "unknown");
  }

  console.log("");
}

/**
 * Render issues for a specific category
 */
function renderIssuesByCategory(
  issues: IssueGroup[],
  category: string
): void {
  const filtered = issues.filter((g) => g.issue.category === category);

  for (const group of filtered) {
    const countStr = group.issue.affectedCount > 1
      ? style.dim(` × ${group.issue.affectedCount}`)
      : "";
    console.log(`     ${style.dim("→")} ${group.issue.title}${countStr}`);
  }
}

/**
 * Helper to create a boxed line with proper alignment
 */
function boxLine(content: string, width: number): string {
  const contentWidth = width - 4; // Account for "│ " and " │"
  return `${box.vertical} ${padRight(content, contentWidth)} ${box.vertical}`;
}

/**
 * Helper to create an empty box line
 */
function emptyBoxLine(width: number): string {
  return `${box.vertical}${" ".repeat(width - 2)}${box.vertical}`;
}

/**
 * Render detailed issue report for a single issue group
 * Uses simple indentation instead of boxes to handle variable line lengths
 */
export function renderIssueDetail(
  group: IssueGroup,
  seed?: number,
  journeyPath?: string,
  backendName?: string
): void {
  const { issue } = group;
  const categoryIcon = getCategoryIcon(issue.category);
  const categoryLabel = issue.category.replace("_", " ").toUpperCase();

  console.log("");
  console.log(heavyLine(REPORT_WIDTH));
  console.log("");

  // Category header with node ID
  const headerContent = issue.affectedNode
    ? `${categoryIcon} ${style.bold(categoryLabel)} at ${style.cyan(issue.affectedNode)}`
    : `${categoryIcon} ${style.bold(categoryLabel)}`;
  console.log(`  ${headerContent}`);
  console.log("");

  // Error
  console.log(`  ${style.bold("ERROR:")}`);
  console.log(`    ${issue.description}`);
  console.log("");

  // Node details section (if available)
  if (issue.nodeContext) {
    const nc = issue.nodeContext;
    console.log(`  ${style.bold("NODE DETAILS:")}`);
    console.log(`    Type:     ${style.cyan(nc.nodeType)}`);

    if (nc.label) {
      console.log(`    Label:    ${nc.label}`);
    }

    if (nc.delay !== undefined && nc.delay > 0) {
      console.log(`    Delay:    ${style.yellow(nc.delay + "s")} (wait before send)`);
    }

    if (nc.responseType) {
      const hasButtons = nc.responseType === "buttons" ? " (has buttons)" : nc.responseType === "auto" ? " (no buttons)" : "";
      console.log(`    Response: ${nc.responseType}${style.dim(hasButtons)}`);
    }

    if (nc.outgoingEdges.length > 0) {
      const edgeStr = nc.outgoingEdges.length === 1
        ? `→ ${nc.outgoingEdges[0].target} (${nc.outgoingEdges[0].type})`
        : `${nc.outgoingEdges.length} outgoing`;
      console.log(`    Edge:     ${edgeStr}`);
    }
    console.log("");
  }

  // Execution path
  if (issue.failurePath.length > 0) {
    console.log(`  ${style.bold("EXECUTION PATH:")}`);
    const pathStr = issue.failurePath.join(` ${icons.arrow} `) + ` ${icons.arrow} ${icons.failure}`;
    // Wrap path to console width
    const maxWidth = 80;
    let currentLine = "    ";
    const pathParts = pathStr.split(" ");

    for (const part of pathParts) {
      if (currentLine.length + part.length + 1 > maxWidth) {
        console.log(style.dim(currentLine));
        currentLine = "    " + part + " ";
      } else {
        currentLine += part + " ";
      }
    }
    if (currentLine.trim()) {
      console.log(style.dim(currentLine));
    }
    console.log("");
  }

  // Timing breakdown (if available)
  if (issue.timingBreakdown) {
    const tb = issue.timingBreakdown;
    console.log(`  ${style.bold("TIMING:")}`);
    console.log(`    Duration: ${style.cyan(formatDuration(tb.totalDurationMs))}`);

    if (tb.timeoutSource) {
      const timeoutInfo = tb.configuredTimeoutMs
        ? `${tb.timeoutSource} (${tb.configuredTimeoutMs}ms limit)`
        : tb.timeoutSource;
      console.log(`    Trigger:  ${style.yellow(timeoutInfo)}`);
    }
    console.log("");
  }

  // Root cause analysis (if available)
  if (issue.rootCauseAnalysis && issue.rootCauseAnalysis.length > 0) {
    console.log(`  ${style.bold("ROOT CAUSE ANALYSIS:")}`);
    for (const line of issue.rootCauseAnalysis) {
      // Color warnings and conclusions differently
      if (line.startsWith("→")) {
        console.log(`    ${style.error(line)}`);
      } else {
        console.log(`    ${style.warning(line)}`);
      }
    }
    console.log("");
  }

  // Affected variations count
  console.log(`  ${style.bold("AFFECTED:")} ${issue.affectedCount} variations`);

  // Reproduction command (if seed available)
  if (seed !== undefined && journeyPath) {
    const sampleVariation = group.variations[0]?.variation.id;
    const filterArg = sampleVariation ? ` --filter "${sampleVariation}"` : "";
    const backendArg = backendName && backendName !== "engine" ? ` --backend ${backendName}` : "";
    console.log("");
    console.log(`  ${style.bold("REPRODUCE:")}`);
    console.log(`    ${style.dim(`pnpm blade-runner ${journeyPath} --seed ${seed}${backendArg}${filterArg}`)}`);
  }

  console.log("");
  console.log(heavyLine(REPORT_WIDTH));
}

// =============================================================================
// INTERACTIVE REVIEW
// =============================================================================

/**
 * Show the actions menu and return user choice
 */
function showActionsMenu(): void {
  console.log("");
  console.log(heavyLine(REPORT_WIDTH));
  console.log("");
  console.log(style.bold("Actions:"));
  console.log("  [r] Review issues    [e] Export report    [q] Quit");
  console.log("");
}

/**
 * Interactive result review with loop to allow returning to menu
 */
export async function interactiveReview(
  result: BladeRunnerResult,
  options?: { outputPath?: string }
): Promise<void> {
  if (result.issues.length === 0) {
    return;
  }

  let running = true;

  while (running) {
    showActionsMenu();

    hideCursor();
    const key = await waitForKey(["r", "e", "q"]);
    showCursor();

    switch (key) {
      case "r":
        await reviewIssues(result);
        // After review, loop back to show menu again
        break;
      case "e":
        await exportReport(result, options?.outputPath);
        // After export, loop back to show menu again
        break;
      case "q":
        running = false;
        break;
    }
  }
}

/**
 * Review issues one by one with option to go back
 */
async function reviewIssues(result: BladeRunnerResult): Promise<void> {
  let i = 0;

  while (i < result.issues.length) {
    console.clear();
    console.log(
      style.dim(`Issue ${i + 1} of ${result.issues.length}`)
    );
    renderIssueDetail(result.issues[i], result.seed, result.journeyPath, result.backend?.name);

    console.log("");
    if (i > 0) {
      console.log(style.dim("[p] Previous  [n] Next  [b] Back to menu"));
    } else if (result.issues.length > 1) {
      console.log(style.dim("[n] Next  [b] Back to menu"));
    } else {
      console.log(style.dim("[b] Back to menu"));
    }

    hideCursor();
    const validKeys = i > 0 ? ["p", "n", "b"] : ["n", "b"];
    const key = await waitForKey(validKeys);
    showCursor();

    switch (key) {
      case "p":
        if (i > 0) i--;
        break;
      case "n":
        i++;
        break;
      case "b":
        return; // Go back to actions menu
    }
  }

  // Reached end of issues
  console.log("");
  console.log(style.dim("End of issues. Returning to menu..."));
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Export report to file
 */
async function exportReport(
  result: BladeRunnerResult,
  outputPath?: string
): Promise<void> {
  console.log("");
  console.log(style.dim("Export format: [j]son  [m]arkdown  [t]ext  [c]ancel"));

  hideCursor();
  const key = await waitForKey(["j", "m", "t", "c"]);
  showCursor();

  if (key === "c") {
    console.log(style.dim("Export cancelled."));
    return;
  }

  const format: ExportFormat = key === "j" ? "json" : key === "m" ? "markdown" : "text";
  const content = formatExport(result, format);
  const filename = `blade-runner-report.${format === "json" ? "json" : format === "markdown" ? "md" : "txt"}`;

  // Write to file with error handling
  const fs = await import("node:fs");
  const path = await import("node:path");
  try {
    let resolvedPath = filename;
    if (outputPath) {
      const ext = format === "json" ? "json" : format === "markdown" ? "md" : "txt";
      const resolved = path.resolve(process.cwd(), outputPath);
      const endsWithSeparator = outputPath.endsWith("/") || outputPath.endsWith(path.sep);

      if (fs.existsSync(resolved)) {
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          resolvedPath = path.join(resolved, `blade-runner-report.${ext}`);
        } else {
          resolvedPath = resolved;
        }
      } else if (endsWithSeparator) {
        fs.mkdirSync(resolved, { recursive: true });
        resolvedPath = path.join(resolved, `blade-runner-report.${ext}`);
      } else {
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        resolvedPath = resolved;
      }
    }

    fs.writeFileSync(resolvedPath, content);
    console.log(style.success(`${icons.success} Report saved to ${resolvedPath}`));
  } catch (error) {
    console.log(style.error(`${icons.failure} Failed to save report: ${(error as Error).message}`));
  }

  // Brief pause to show result
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

// =============================================================================
// EXPORT FORMATTING
// =============================================================================

/**
 * Format result for export
 */
export function formatExport(result: BladeRunnerResult, format: ExportFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(result, null, 2);
    case "markdown":
      return formatMarkdown(result);
    case "text":
      return formatText(result);
  }
}

/**
 * Format as markdown
 */
function formatMarkdown(result: BladeRunnerResult): string {
  const lines: string[] = [];

  // Use journeyPath as fallback when name/id are missing or "unknown"
  const journeyDisplay = result.journeyName && result.journeyName !== "unknown"
    ? result.journeyName
    : result.journeyPath || result.journeyId || "unknown";

  lines.push(`# Blade Runner Test Report`);
  lines.push("");
  lines.push(`**Journey:** ${journeyDisplay}`);
  lines.push(`**Test Level:** ${result.testLevel}`);
  if (result.backend?.name) {
    lines.push(`**Backend:** ${result.backend.name}`);
  }
  lines.push(`**Date:** ${result.timestamp}`);
  lines.push(`**Seed:** ${result.seed} (for reproducibility)`);
  lines.push("");

  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Variations | ${result.summary.total} |`);
  lines.push(`| Passed | ${result.summary.passed} |`);
  if (result.summary.alternatePaths && result.summary.alternatePaths > 0) {
    lines.push(`| ↳ Via Alternate Paths | ${result.summary.alternatePaths} |`);
  }
  lines.push(`| Failed | ${result.summary.failed} |`);
  lines.push(`| Duration | ${formatDuration(result.summary.durationMs)} |`);
  lines.push(`| Rate | ${result.performance.variationsPerSecond} var/sec |`);
  lines.push("");

  // Add alternate paths section if any
  const alternatePaths = result.summary.alternatePaths || 0;
  if (alternatePaths > 0) {
    lines.push(`## Alternate Paths`);
    lines.push("");
    lines.push(`${alternatePaths} variations took valid alternate routes instead of the expected path.`);
    lines.push("");

    // Count by reason
    const byReason: Record<string, number> = {};
    for (const r of result.results) {
      if (r.status === "alternate_path" && r.alternatePath) {
        byReason[r.alternatePath.reason] = (byReason[r.alternatePath.reason] || 0) + 1;
      }
    }

    lines.push(`| Reason | Count |`);
    lines.push(`|--------|-------|`);
    for (const [reason, count] of Object.entries(byReason)) {
      const icon =
        reason === "text_response"
          ? "💬"
          : reason === "timeout"
            ? "⏰"
            : reason === "plugin_button"
              ? "🔌"
              : reason === "condition_branch"
                ? "🔀"
                : reason === "guard_fallback"
                  ? "🛡️"
                  : "❓";
      const label = reason.replace("_", " ");
      lines.push(`| ${icon} ${label} | ${count} |`);
    }
    lines.push("");
  }

  lines.push(`## Coverage`);
  lines.push("");
  lines.push(`- Nodes: ${result.coverage.nodes.visited}/${result.coverage.nodes.total} (${percentage(result.coverage.nodes.visited, result.coverage.nodes.total)})`);
  lines.push(`- Edges: ${result.coverage.edges.traversed}/${result.coverage.edges.total} (${percentage(result.coverage.edges.traversed, result.coverage.edges.total)})`);
  lines.push(`- Branches: ${result.coverage.branches.taken}/${result.coverage.branches.total} (${percentage(result.coverage.branches.taken, result.coverage.branches.total)})`);
  lines.push("");

  if (result.issues.length > 0) {
    lines.push(`## Issues Found`);
    lines.push("");

    for (let groupIdx = 0; groupIdx < result.issues.length; groupIdx++) {
      const group = result.issues[groupIdx];
      const { issue, variations } = group;

      lines.push(`### Issue ${groupIdx + 1}: ${getCategoryIcon(issue.category)} ${issue.title}`);
      lines.push("");
      lines.push(`| Property | Value |`);
      lines.push(`|----------|-------|`);
      lines.push(`| Category | ${issue.category.replace("_", " ")} |`);
      lines.push(`| Severity | ${issue.severity} |`);
      lines.push(`| Affected Variations | ${issue.affectedCount} |`);
      lines.push(`| Affected Node | ${issue.affectedNode || "N/A"} |`);
      lines.push(`| Affected Edge | ${issue.affectedEdge || "N/A"} |`);
      lines.push("");

      lines.push(`#### Analysis`);
      lines.push("");
      lines.push(`**Description:** ${issue.description}`);
      lines.push("");

      // Node context (engineering details)
      if (issue.nodeContext) {
        const nc = issue.nodeContext;
        lines.push(`**Node Details:**`);
        lines.push("");
        lines.push(`| Property | Value |`);
        lines.push(`|----------|-------|`);
        lines.push(`| Type | ${nc.nodeType} |`);
        if (nc.label) lines.push(`| Label | ${nc.label} |`);
        if (nc.delay !== undefined && nc.delay > 0) lines.push(`| Delay | ${nc.delay}s |`);
        if (nc.responseType) lines.push(`| Response Type | ${nc.responseType} |`);
        if (nc.outgoingEdges.length > 0) {
          const edgesStr = nc.outgoingEdges.map((e) => `→ ${e.target} (${e.type})`).join(", ");
          lines.push(`| Edges | ${edgesStr} |`);
        }
        lines.push("");
      }

      // Timing breakdown
      if (issue.timingBreakdown) {
        const tb = issue.timingBreakdown;
        lines.push(`**Timing:**`);
        lines.push("");
        lines.push(`- Total Duration: ${formatDuration(tb.totalDurationMs)}`);
        if (tb.timeoutSource) {
          const timeoutInfo = tb.configuredTimeoutMs
            ? `${tb.timeoutSource} (${tb.configuredTimeoutMs}ms limit)`
            : tb.timeoutSource;
          lines.push(`- Timeout Trigger: ${timeoutInfo}`);
        }
        lines.push("");
      }

      // Root cause analysis
      if (issue.rootCauseAnalysis && issue.rootCauseAnalysis.length > 0) {
        lines.push(`**Root Cause Analysis:**`);
        lines.push("");
        for (const line of issue.rootCauseAnalysis) {
          lines.push(`- ${line}`);
        }
        lines.push("");
      }

      lines.push(`**Likely Cause:** ${issue.likelyCause}`);
      lines.push("");
      lines.push(`**Suggested Fix:** ${issue.suggestedFix}`);
      lines.push("");

      if (issue.failurePath.length > 0) {
        lines.push(`**Failure Path:** \`${issue.failurePath.join(" → ")}\``);
        lines.push("");
      }

      lines.push(`**Original Error:**`);
      lines.push("```");
      lines.push(issue.originalError || "No error message captured");
      lines.push("```");
      lines.push("");

      // Reproduction command
      if (result.seed && result.journeyPath) {
        lines.push(`**Reproduction:**`);
        lines.push("```bash");
        const backendArg =
          result.backend?.name && result.backend.name !== "engine"
            ? ` --backend ${result.backend.name}`
            : "";
        lines.push(`pnpm blade-runner ${result.journeyPath} --seed ${result.seed}${backendArg}`);
        lines.push("```");
        lines.push("");
      }

      // Include full details for first variation (representative example)
      if (variations.length > 0) {
        lines.push(`#### Representative Failure Details`);
        lines.push("");
        const firstVar = variations[0];
        formatVariationDetails(lines, firstVar, 1);

        // If more variations, list them briefly
        if (variations.length > 1) {
          lines.push(`#### Additional Affected Variations (${variations.length - 1} more)`);
          lines.push("");
          lines.push(`<details>`);
          lines.push(`<summary>Click to expand all ${variations.length - 1} additional variations</summary>`);
          lines.push("");

          for (let i = 1; i < Math.min(variations.length, 10); i++) {
            formatVariationDetails(lines, variations[i], i + 1);
          }

          if (variations.length > 10) {
            lines.push(`_...and ${variations.length - 10} more variations with similar issues_`);
            lines.push("");
          }

          lines.push(`</details>`);
          lines.push("");
        }
      }

      lines.push("---");
      lines.push("");
    }
  }

  // Append uncovered nodes/edges for debugging
  if (result.coverage.nodes.details) {
    const uncoveredNodes = result.coverage.nodes.details.filter((n) => !n.visited);
    if (uncoveredNodes.length > 0) {
      lines.push(`## Uncovered Nodes`);
      lines.push("");
      lines.push(`| Node ID | Label | Type |`);
      lines.push(`|---------|-------|------|`);
      for (const node of uncoveredNodes) {
        lines.push(`| ${node.nodeId} | ${node.label || "-"} | ${node.nodeType} |`);
      }
      lines.push("");
    }
  }

  if (result.coverage.edges.details) {
    const uncoveredEdges = result.coverage.edges.details.filter((e) => !e.traversed);
    if (uncoveredEdges.length > 0) {
      lines.push(`## Uncovered Edges`);
      lines.push("");
      lines.push(`| Edge ID | Source → Target | Type | Label |`);
      lines.push(`|---------|-----------------|------|-------|`);
      for (const edge of uncoveredEdges) {
        lines.push(`| ${edge.edgeId} | ${edge.source} → ${edge.target} | ${edge.edgeType} | ${edge.label || "-"} |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format detailed variation info for markdown
 */
function formatVariationDetails(lines: string[], varResult: VariationResult, index: number): void {
  const { variation, error, stack, visitedNodes, steps, finalStatus, durationMs } = varResult;

  lines.push(`**Variation ${index}:** \`${variation.id}\``);
  lines.push("");

  // Variation configuration
  lines.push(`- **Expected Path:** \`${variation.path.join(" → ")}\``);
  lines.push(`- **Actual Visited:** \`${visitedNodes.join(" → ")}\``);
  lines.push(`- **Timing:** ${variation.timing}`);
  lines.push(`- **Duration:** ${durationMs}ms`);
  lines.push(`- **Final Status:** ${finalStatus}`);
  lines.push("");

  // Inputs
  if (variation.inputs.length > 0) {
    lines.push(`**Inputs:**`);
    lines.push("");
    for (const input of variation.inputs) {
      const valueStr = input.value ? ` = \`${input.value}\`` : "";
      lines.push(`- \`${input.nodeId}\`: ${input.inputType}${valueStr}`);
    }
    lines.push("");
  }

  // Context setup
  if (Object.keys(variation.contextSetup || {}).length > 0) {
    lines.push(`**Context Setup:**`);
    lines.push("```json");
    lines.push(JSON.stringify(variation.contextSetup, null, 2));
    lines.push("```");
    lines.push("");
  }

  if (variation.underivableConditions && variation.underivableConditions.length > 0) {
    lines.push(`**Context Gaps:**`);
    lines.push("");
    for (const condition of variation.underivableConditions) {
      lines.push(`- ${condition}`);
    }
    lines.push("");
  }

  // Execution steps
  if (steps && steps.length > 0) {
    lines.push(`**Execution Steps:**`);
    lines.push("");
    lines.push(`| # | Node | Action | Details |`);
    lines.push(`|---|------|--------|---------|`);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      lines.push(`| ${i + 1} | ${step.nodeId} | ${step.action} | ${step.details || "-"} |`);
    }
    lines.push("");
  }

  // Error and stack trace
  if (error) {
    lines.push(`**Error Message:**`);
    lines.push("```");
    lines.push(error);
    lines.push("```");
    lines.push("");
  }

  if (stack) {
    lines.push(`**Stack Trace:**`);
    lines.push("```");
    lines.push(stack);
    lines.push("```");
    lines.push("");
  }
}

/**
 * Format as plain text
 */
function formatText(result: BladeRunnerResult): string {
  const lines: string[] = [];

  // Use journeyPath as fallback when name/id are missing or "unknown"
  const journeyDisplay = result.journeyName && result.journeyName !== "unknown"
    ? result.journeyName
    : result.journeyPath || result.journeyId || "unknown";

  lines.push(`BLADE RUNNER TEST REPORT`);
  lines.push(`========================`);
  lines.push("");
  lines.push(`Journey: ${journeyDisplay}`);
  lines.push(`Test Level: ${result.testLevel}`);
  if (result.backend?.name) {
    lines.push(`Backend: ${result.backend.name}`);
  }
  lines.push(`Date: ${result.timestamp}`);
  lines.push(`Seed: ${result.seed} (for reproducibility)`);
  lines.push("");
  lines.push(`SUMMARY`);
  lines.push(`-------`);
  lines.push(`Total: ${result.summary.total}`);
  lines.push(`Passed: ${result.summary.passed}`);
  if (result.summary.alternatePaths && result.summary.alternatePaths > 0) {
    lines.push(`  (${result.summary.alternatePaths} via alternate paths)`);
  }
  lines.push(`Failed: ${result.summary.failed}`);
  lines.push(`Duration: ${formatDuration(result.summary.durationMs)}`);
  lines.push(`Rate: ${result.performance.variationsPerSecond} variations/sec`);
  lines.push("");

  lines.push(`COVERAGE`);
  lines.push(`--------`);
  lines.push(`Nodes: ${result.coverage.nodes.visited}/${result.coverage.nodes.total}`);
  lines.push(`Edges: ${result.coverage.edges.traversed}/${result.coverage.edges.total}`);
  lines.push(`Branches: ${result.coverage.branches.taken}/${result.coverage.branches.total}`);
  lines.push("");

  if (result.issues.length > 0) {
    lines.push(`ISSUES (${result.issues.length} unique)`);
    lines.push(`${"=".repeat(50)}`);

    for (let i = 0; i < result.issues.length; i++) {
      const group = result.issues[i];
      const { issue, variations } = group;

      lines.push("");
      lines.push(`ISSUE ${i + 1}: ${issue.title}`);
      lines.push(`${"─".repeat(50)}`);
      lines.push(`Category: ${issue.category.replace("_", " ")}`);
      lines.push(`Severity: ${issue.severity}`);
      lines.push(`Affected: ${issue.affectedCount} variations`);
      lines.push("");
      lines.push(`Description: ${issue.description}`);
      lines.push(`Cause: ${issue.likelyCause}`);
      lines.push(`Fix: ${issue.suggestedFix}`);
      lines.push("");

      if (issue.failurePath.length > 0) {
        lines.push(`Path: ${issue.failurePath.join(" -> ")}`);
      }

      lines.push(`Error: ${issue.originalError || "No error message"}`);
      lines.push("");

      // Show first variation details
      if (variations.length > 0) {
        const v = variations[0];
        lines.push(`  FIRST VARIATION: ${v.variation.id}`);
        lines.push(`  Expected: ${v.variation.path.join(" -> ")}`);
        lines.push(`  Visited:  ${v.visitedNodes.join(" -> ")}`);
        lines.push(`  Status:   ${v.finalStatus}`);
        lines.push(`  Duration: ${v.durationMs}ms`);

        if (v.stack) {
          lines.push("");
          lines.push(`  STACK TRACE:`);
          for (const line of v.stack.split("\n").slice(0, 10)) {
            lines.push(`    ${line}`);
          }
          if (v.stack.split("\n").length > 10) {
            lines.push(`    ... (truncated)`);
          }
        }

        if (v.steps && v.steps.length > 0) {
          lines.push("");
          lines.push(`  EXECUTION STEPS:`);
          for (const step of v.steps) {
            lines.push(`    [${step.action}] ${step.nodeId}${step.details ? `: ${step.details}` : ""}`);
          }
        }
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

// =============================================================================
// MAIN RENDER FUNCTION
// =============================================================================

/**
 * Render the complete results dashboard
 */
export function renderResults(result: BladeRunnerResult): void {
  renderResultsHeader(result);
  renderResultsSummary(result);
  renderIssuesSummary(result);
}
