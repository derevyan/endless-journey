/**
 * Interactive UI for Journey Variation Tester
 *
 * Handles console rendering and keyboard input for interactive testing mode.
 * Uses Node.js built-in readline for keypress handling (no external dependencies).
 *
 * @module engine/testing/interactive-ui
 */

import * as readline from "node:readline";
import type { JourneyConfig } from "@journey/schemas";
import type {
  InteractiveAction,
  ProblemContext,
  VariationResult,
  VariationTesterResult,
  JourneyStats,
} from "./types";

// =============================================================================
// ANSI COLORS (no dependencies)
// =============================================================================

const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  reset: "\x1b[0m",
};

// =============================================================================
// RENDERING FUNCTIONS
// =============================================================================

/**
 * Render the startup summary
 */
export function renderStartup(stats: JourneyStats): void {
  console.log("");
  console.log(colors.cyan(`   ${stats.journeyName}`));
  console.log(
    colors.dim(
      `   ${stats.nodeCount} nodes | ${stats.edgeCount} edges | ~${stats.variationCount} variations`
    )
  );
  console.log("");
}

/**
 * Render progress bar (overwrites current line)
 */
export function renderProgress(
  current: number,
  total: number,
  failed: number,
  skipped: number
): void {
  const width = 30;
  const percent = Math.min(current / total, 1);
  const filled = Math.round(width * percent);
  const empty = width - filled;

  const bar = colors.green("=".repeat(filled)) + colors.dim("-".repeat(empty));
  const failedStr = failed > 0 ? colors.red(` ${failed} failed`) : "";
  const skippedStr = skipped > 0 ? colors.yellow(` ${skipped} skipped`) : "";

  process.stdout.write(
    `\r   Testing...  [${bar}] ${current}/${total}${failedStr}${skippedStr}   `
  );
}

/**
 * Clear the progress line
 */
export function clearProgress(): void {
  process.stdout.write("\r" + " ".repeat(80) + "\r");
}

/**
 * Render a problem for user decision
 */
export function renderProblem(context: ProblemContext): void {
  clearProgress();
  console.log("");

  // Header
  const icon = context.type === "validation" ? "!" : "X";
  const typeLabel =
    context.type === "validation"
      ? colors.yellow("VALIDATION ISSUE")
      : context.type === "timeout"
        ? colors.yellow("TIMEOUT")
        : colors.red("EXECUTION ERROR");

  console.log(
    `${colors.red(icon)} ${typeLabel} at variation ${context.variationIndex}/${context.totalVariations}`
  );
  console.log("");

  // Path visualization
  const failedNodeId = context.variation.path[context.failedAtIndex];
  const pathParts = context.variation.path.map((nodeId, idx) => {
    if (idx < context.failedAtIndex) {
      return colors.dim(nodeId);
    } else if (idx === context.failedAtIndex) {
      return colors.red(nodeId);
    } else {
      return colors.dim("...");
    }
  });
  // Truncate to show relevant portion
  const visiblePath = pathParts.slice(
    Math.max(0, context.failedAtIndex - 3),
    context.failedAtIndex + 2
  );
  console.log(`   Path: ${visiblePath.join(colors.dim(" -> "))}`);

  // Error message
  const errorMsg = context.result.error || "Unknown error";
  console.log(`   Error: ${colors.red(errorMsg.slice(0, 80))}`);

  // Node info
  console.log(`   Node: ${colors.cyan(failedNodeId)}`);
  console.log("");

  // Actions
  const skipCount = context.similarVariations.length;
  const skipLabel =
    skipCount > 0
      ? `[s] Skip family (${skipCount} similar)`
      : colors.dim("[s] Skip family (none)");

  console.log(`   [c] Continue   [i] Inspect   ${skipLabel}   [q] Quit`);
  process.stdout.write("   > ");
}

/**
 * Render detailed inspection view
 */
export function renderInspection(
  result: VariationResult,
  journey: JourneyConfig
): void {
  console.log("");
  console.log(colors.cyan("=".repeat(60)));
  console.log(colors.bold(`   INSPECTION: ${result.variation.id}`));
  console.log(colors.cyan("=".repeat(60)));
  console.log("");

  // Visited nodes
  console.log(colors.bold("   VISITED NODES:"));
  const nodeMap = new Map(journey.nodes.map((n) => [n.id, n]));
  result.visitedNodes.forEach((nodeId, idx) => {
    const node = nodeMap.get(nodeId);
    const nodeType = node?.data?.type || "unknown";
    const isLast = idx === result.visitedNodes.length - 1;
    const marker = isLast && !result.success ? colors.red("<- FAILED HERE") : "";
    console.log(
      `   ${idx + 1}. ${colors.cyan(nodeId)} ${colors.dim(`(${nodeType})`)} ${marker}`
    );
  });
  console.log("");

  // Messages sent
  if (result.messagesSent.length > 0) {
    console.log(colors.bold("   MESSAGES SENT:"));
    result.messagesSent.slice(0, 5).forEach((msg, idx) => {
      const preview = msg.length > 50 ? msg.slice(0, 50) + "..." : msg;
      console.log(`   ${idx + 1}. "${preview}"`);
    });
    if (result.messagesSent.length > 5) {
      console.log(colors.dim(`   ... and ${result.messagesSent.length - 5} more`));
    }
    console.log("");
  }

  // Execution steps
  console.log(colors.bold("   EXECUTION STEPS:"));
  result.steps.slice(-10).forEach((step, idx) => {
    const actionColor =
      step.action === "click"
        ? colors.green
        : step.action === "text"
          ? colors.cyan
          : step.action === "timeout"
            ? colors.yellow
            : colors.dim;
    console.log(
      `   ${idx + 1}. [${actionColor(step.action)}] ${step.nodeId} - ${step.details || ""}`
    );
  });
  if (result.steps.length > 10) {
    console.log(colors.dim(`   ... (${result.steps.length - 10} earlier steps)`));
  }
  console.log("");

  // Error details
  if (result.error) {
    console.log(colors.bold("   ERROR DETAILS:"));
    console.log(`   ${colors.red(result.error)}`);
    if (result.stack) {
      const stackLines = result.stack.split("\n").slice(1, 4);
      stackLines.forEach((line) => console.log(colors.dim(`   ${line.trim()}`)));
    }
    console.log("");
  }

  // Duration
  console.log(
    colors.dim(`   Duration: ${result.durationMs}ms | Status: ${result.finalStatus}`)
  );
  console.log("");
  console.log(colors.dim("   Press any key to return..."));
}

/**
 * Render final summary
 */
export function renderSummary(result: VariationTesterResult): void {
  console.log("");
  console.log(colors.cyan("=".repeat(60)));

  const { passed, failed, skipped, total } = result.summary;

  if (failed === 0) {
    console.log(colors.green(`   ALL PASSED: ${passed}/${total} variations`));
  } else {
    console.log(
      colors.red(`   FAILED: ${failed}/${total} variations`) +
        (skipped > 0 ? colors.yellow(` (${skipped} skipped)`) : "")
    );
  }

  // Coverage summary
  const { nodes, edges, branches } = result.coverage;
  console.log(
    colors.dim(
      `   Coverage: Nodes ${nodes.coverage.toFixed(0)}% | Edges ${edges.coverage.toFixed(0)}% | Branches ${branches.coverage.toFixed(0)}%`
    )
  );

  console.log(
    colors.dim(`   Time: ${(result.summary.durationMs / 1000).toFixed(1)}s`)
  );
  console.log(colors.cyan("=".repeat(60)));
  console.log("");
}

// =============================================================================
// INPUT HANDLING
// =============================================================================

/**
 * Wait for user action (single keypress)
 */
export async function waitForAction(): Promise<InteractiveAction> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Non-TTY: default to continue
      resolve("continue");
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    const handler = (str: string | undefined, key: readline.Key | undefined) => {
      process.stdin.setRawMode(false);
      process.stdin.removeListener("keypress", handler);
      process.stdin.pause();

      const keyName = key?.name || str || "";

      switch (keyName.toLowerCase()) {
        case "c":
          console.log("continue");
          resolve("continue");
          break;
        case "i":
          console.log("inspect");
          resolve("inspect");
          break;
        case "s":
          console.log("skip");
          resolve("skip_family");
          break;
        case "q":
        case "escape":
          console.log("quit");
          resolve("quit");
          break;
        default:
          // Invalid key - ask again
          process.stdout.write("\r   > ");
          waitForAction().then(resolve);
      }
    };

    process.stdin.on("keypress", handler);
    process.stdin.resume();
  });
}

/**
 * Wait for any key to continue
 */
export async function waitForAnyKey(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    const handler = () => {
      process.stdin.setRawMode(false);
      process.stdin.removeListener("keypress", handler);
      process.stdin.pause();
      resolve();
    };

    process.stdin.on("keypress", handler);
    process.stdin.resume();
  });
}
