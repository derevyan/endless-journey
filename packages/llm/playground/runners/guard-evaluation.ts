/**
 * Guard Evaluation Playground Runner
 *
 * Tests all guard workers (safety, policy, injection, spam)
 * with real content to verify blocking behavior.
 *
 * Features:
 * - Run individual test scenarios
 * - Run all scenarios with pass/fail summary
 * - Custom input for ad-hoc testing
 * - Displays per-worker decisions, timing, tokens, and cost
 */

import chalk from "chalk";
import { ui } from "../utils/console-ui";
import {
  evaluateGuards,
  type GuardEvaluationResult,
} from "../../src/services/guard-service";
import { llmConfig } from "@journey/schemas";
import guardScenariosJson from "../scenarios/guard-scenarios.json" with { type: "json" };

// ============================================================================
// Types
// ============================================================================

interface GuardScenario {
  id: string;
  name: string;
  category: string;
  content: string;
  context?: string;
  expectedResult?: "allowed" | "blocked";
  expectedBlockedBy?: string[];
}

const scenarios = guardScenariosJson.scenarios as GuardScenario[];

// ============================================================================
// Main Entry Point
// ============================================================================

export async function runGuardEvaluationPlayground(): Promise<void> {
  ui.header("Guard Evaluation Playground");

  console.log(chalk.gray("Test safety guards with predefined scenarios"));
  console.log(chalk.gray("or custom input. All 4 guards run in parallel.\n"));

  // Display available guards in a nice box
  const guardList = llmConfig.guards.workers
    .map((w) => `• ${w.id}: ${w.model}`)
    .join("\n");
  ui.box("Active Guards", guardList);
  console.log();

  // Main menu
  let continueRunning = true;

  while (continueRunning) {
    const action = await ui.select("What would you like to do?", [
      { name: "Run a test scenario", value: "scenario" },
      { name: chalk.cyan("Run all scenarios"), value: "all" },
      { name: "Custom input", value: "custom" },
      { name: chalk.red("Back to main menu"), value: "exit" },
    ]);

    if (action === "exit") {
      continueRunning = false;
      continue;
    }

    if (action === "custom") {
      await runCustomInput();
    } else if (action === "all") {
      await runAllScenarios();
    } else {
      await selectAndRunScenario();
    }

    if (action !== "exit") {
      console.log();
      continueRunning = await ui.confirm("Run another guard test?", true);
    }
  }
}

// ============================================================================
// Custom Input
// ============================================================================

async function runCustomInput(): Promise<void> {
  console.log();
  const content = await ui.input("Enter content to evaluate:");

  if (!content.trim()) {
    ui.warn("No content provided");
    return;
  }

  console.log();
  console.log(chalk.yellow("Running guard evaluation..."));
  console.log();

  await evaluateAndDisplay(content);
}

// ============================================================================
// Scenario Selection
// ============================================================================

async function selectAndRunScenario(): Promise<void> {
  // Group scenarios by category
  const categories = [...new Set(scenarios.map((s) => s.category))];

  const categoryChoices = categories.map((cat) => ({
    name: `${cat.charAt(0).toUpperCase() + cat.slice(1)} (${scenarios.filter((s) => s.category === cat).length} tests)`,
    value: cat,
  }));

  console.log();
  const selectedCategory = await ui.select("Select a category:", categoryChoices);

  const categoryScenarios = scenarios.filter((s) => s.category === selectedCategory);
  const scenarioChoices = categoryScenarios.map((s) => ({
    name: `${s.name} - "${s.content.slice(0, 40)}${s.content.length > 40 ? "..." : ""}"`,
    value: s.id,
  }));

  console.log();
  const selectedId = await ui.select("Select a scenario:", scenarioChoices);

  const scenario = scenarios.find((s) => s.id === selectedId)!;
  await runScenario(scenario, false);
}

// ============================================================================
// Run All Scenarios
// ============================================================================

async function runAllScenarios(): Promise<void> {
  ui.header("Running All Guard Scenarios");

  let passed = 0;
  let failed = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const scenario of scenarios) {
    const { success, result } = await runScenario(scenario, true);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    totalTokens += result.usage?.totalTokens ?? 0;
    totalCost += result.usage?.totalCostUSD ?? 0;
  }

  // Summary
  ui.divider();
  console.log();
  console.log(chalk.bold.cyan("┌─ Test Summary ───────────────────────────────┐"));
  console.log(chalk.cyan("│ ") + chalk.green(`✓ Passed: ${passed}`));
  if (failed > 0) {
    console.log(chalk.cyan("│ ") + chalk.red(`✗ Failed: ${failed}`));
  }
  console.log(chalk.cyan("│ ") + chalk.gray(`  Total:  ${scenarios.length}`));
  console.log(chalk.cyan("│"));
  console.log(chalk.cyan("│ ") + chalk.yellow(`  Tokens: ${totalTokens}`));
  console.log(chalk.cyan("│ ") + chalk.green(`  Cost:   $${totalCost.toFixed(4)}`));
  console.log(chalk.cyan("└──────────────────────────────────────────────┘"));
  console.log();
}

// ============================================================================
// Run Single Scenario
// ============================================================================

async function runScenario(
  scenario: GuardScenario,
  quiet: boolean
): Promise<{ success: boolean; result: GuardEvaluationResult }> {
  if (!quiet) {
    console.log();
    ui.divider();
    ui.label("Scenario", `${scenario.name} (${scenario.id})`);
    ui.info(`Category: ${scenario.category}`);
    console.log();

    // Display content in a box
    ui.box("Content", scenario.content.slice(0, 200) + (scenario.content.length > 200 ? "..." : ""));

    if (scenario.expectedResult) {
      console.log(chalk.gray(`Expected: ${scenario.expectedResult}`));
    }
    console.log();
    console.log(chalk.yellow("Running guard evaluation..."));
    console.log();
  } else {
    process.stdout.write(chalk.gray(`  [${scenario.category}] ${scenario.name}... `));
  }

  const result = await evaluateAndDisplay(scenario.content, scenario.context, quiet);

  // Verify expected result if provided
  if (scenario.expectedResult) {
    const actualResult = result.allowed ? "allowed" : "blocked";
    const matches = actualResult === scenario.expectedResult;

    if (quiet) {
      if (matches) {
        console.log(chalk.green("✓"));
      } else {
        console.log(chalk.red(`✗ (expected ${scenario.expectedResult}, got ${actualResult})`));
      }
    } else {
      console.log();
      if (matches) {
        ui.success(`Expected: ${scenario.expectedResult}, Got: ${actualResult}`);
      } else {
        ui.error(`Expected: ${scenario.expectedResult}, Got: ${actualResult}`);
      }
    }

    return { success: matches, result };
  }

  return { success: true, result };
}

// ============================================================================
// Evaluate and Display Results
// ============================================================================

async function evaluateAndDisplay(
  content: string,
  context?: string,
  quiet = false
): Promise<GuardEvaluationResult> {
  const result = await evaluateGuards({
    content,
    conversationContext: context,
  });

  if (quiet) {
    // Just return, logging is handled by caller
    return result;
  }

  const boxWidth = ui.getBoxWidth();
  const workerLines: string[] = [];

  for (const r of result.results) {
    const icon = r.safe ? chalk.green("✓") : chalk.red("✗");
    const status = r.safe
      ? chalk.green("safe")
      : chalk.red(`BLOCKED (${r.category || "?"})`);

    // Build info string with tokens and time
    const parts: string[] = [];
    if (r.tokenUsage?.totalTokens) {
      parts.push(`${r.tokenUsage.totalTokens} tokens`);
    }
    parts.push(`${r.processingTimeMs}ms`);
    const info = chalk.gray(`(${parts.join(", ")})`);

    workerLines.push(
      `${icon} ${chalk.yellow(r.workerId.padEnd(10))} ${status.padEnd(30)} ${info}`
    );

    if (r.confidence !== undefined) {
      workerLines.push(chalk.gray(`  Confidence: ${(r.confidence * 100).toFixed(1)}%`));
    }

    if (r.error) {
      workerLines.push(chalk.red(`  Error: ${r.error}`));
    }
  }

  ui.boxLines("Worker Results", workerLines, { color: chalk.cyan, width: boxWidth });
  console.log();

  // Overall verdict in styled box
  if (result.allowed) {
    ui.boxLines("Verdict", [chalk.bold("✓ ALLOWED - All guards passed")], {
      color: chalk.green,
      width: boxWidth,
    });
  } else {
    const verdictLines = [chalk.bold(`✗ BLOCKED by: ${result.blockedBy?.join(", ")}`)];
    if (result.isSpamBlock) {
      verdictLines.push(chalk.gray("(Spam block - would show friendly redirect)"));
    }
    ui.boxLines("Verdict", verdictLines, { color: chalk.red, width: boxWidth });
  }

  // Stats
  ui.stats({
    timeMs: result.totalProcessingTimeMs,
    tokens: result.usage?.totalTokens,
    cost: result.usage?.totalCostUSD,
    workersSucceeded: result.results.filter((r) => !r.error).length,
    workersFailed: result.results.filter((r) => r.error).length,
  });

  return result;
}
