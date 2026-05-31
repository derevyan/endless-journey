/**
 * Question Understanding Runner
 *
 * Interactive runner for testing the question understanding service
 * with predefined conversation scenarios.
 */

import chalk from "chalk";
import { QuestionUnderstandingConfigSchema } from "@journey/schemas";
import { QU_WORKERS, QU_EVALUATOR, QU_FALLBACK } from "@journey/schemas/config";
import { executeQuestionUnderstanding } from "../../src/services/question-understanding";
import {
  questionUnderstandingScenarios,
  formatHistoryAsString,
  type ConversationScenario,
} from "../scenarios";
import { ui } from "../utils/console-ui";

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration for playground testing
 * Uses the new config system defaults
 */
function getDefaultConfig() {
  return QuestionUnderstandingConfigSchema.parse({
    // Convert QU_WORKERS to WorkerModelConfig format
    workers: QU_WORKERS.map((w) => ({
      id: w.id,
      model: w.model.id,
      provider: w.model.provider,
    })),
    workersTemperature: 0.1,
    workerTimeoutMs: 6000,
    maxWorkersThreads: 6,
    // Convert QU_EVALUATOR to expected format
    evaluator: {
      model: QU_EVALUATOR.primary.id,
      temperature: QU_EVALUATOR.temperature,
      timeoutMs: QU_EVALUATOR.timeoutMs,
      backupModels: QU_EVALUATOR.backups.map((b) => b.id),
    },
    // Use QU_FALLBACK config
    fallback: {
      enabled: QU_FALLBACK.enabled,
      strategy: QU_FALLBACK.strategy,
    },
    requireAllWorkers: false,
    includeReasoningInOutput: true,
  });
}

// ============================================================================
// Runner
// ============================================================================

/**
 * Run question understanding for a single scenario
 */
async function runScenario(scenario: ConversationScenario): Promise<void> {
  console.log();
  ui.divider();
  ui.label("Scenario", `${scenario.name} (${scenario.id})`);
  ui.info(scenario.description);
  console.log();
  const boxWidth = ui.getBoxWidth();

  // Display conversation history
  ui.boxLines("Conversation History", ui.formatConversationHistory(scenario.history), {
    color: chalk.cyan,
    width: boxWidth,
  });
  console.log();

  // Display user input
  console.log(chalk.bold.green("User Input:"), scenario.userInput);

  if (scenario.expectedSynthesis) {
    console.log(chalk.gray(`Expected: "${scenario.expectedSynthesis}"`));
  }

  console.log();
  console.log(chalk.yellow("Running question understanding..."));
  console.log();

  // Get config and run
  const config = getDefaultConfig();
  const startTime = Date.now();

  try {
    const result = await executeQuestionUnderstanding(scenario.userInput, config, {
      conversationHistory: formatHistoryAsString(scenario.history),
      organizationId: "playground-test-org", // For usage tracking in dev
    });

    const elapsed = Date.now() - startTime;

    // Display worker results
    const successfulWorkers = result.workerAnswers.filter((w) => !w.answer.includes("ERROR"));
    const failedWorkers = config.workers.length - successfulWorkers.length;

    ui.boxLines(
      "Worker Results",
      ui.formatWorkerResults(
        result.workerAnswers.map((w) => ({
          workerId: w.workerId,
          model: w.model,
          answer: w.answer,
          confidence: w.confidence,
        }))
      ),
      { color: chalk.cyan, width: boxWidth }
    );
    console.log();

    // Display selected answer
    const selectedLines = [
      chalk.bold(`Answer: "${result.selectedAnswer}"`),
      chalk.gray(`Selected: ${result.selectedWorkerId}`),
    ];

    if (result.evaluation?.evaluationReasoning) {
      selectedLines.push(chalk.gray(`Reasoning: ${result.evaluation.evaluationReasoning}`));
    }

    ui.boxLines("Selected Answer", selectedLines, { color: chalk.green, width: boxWidth });

    // Display stats
    ui.stats({
      timeMs: elapsed,
      tokens: result.usage?.totalTokens,
      cost: result.usage?.totalCostUSD,
      workersSucceeded: successfulWorkers.length,
      workersFailed: failedWorkers,
    });

    // Compare with expected (if available)
    if (scenario.expectedSynthesis) {
      console.log(chalk.gray("─".repeat(50)));
      console.log(chalk.bold("Comparison:"));
      console.log(chalk.gray(`Expected: "${scenario.expectedSynthesis}"`));
      console.log(chalk.gray(`Got:      "${result.selectedAnswer}"`));
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log();
    ui.error(`Failed after ${elapsed}ms`);
    ui.error((error as Error).message);

    if ((error as Error).stack) {
      console.log(chalk.gray((error as Error).stack));
    }
  }
}

/**
 * Main entry point for question understanding playground
 */
export async function runQuestionUnderstandingPlayground(): Promise<void> {
  ui.header("Question Understanding Playground");

  console.log(chalk.gray("Test the question understanding map-reduce service"));
  console.log(chalk.gray("with predefined conversation scenarios.\n"));

  // Show available scenarios
  const choices = questionUnderstandingScenarios.map((s) => ({
    name: `${s.name} - ${s.description}`,
    value: s.id,
  }));

  // Add "Run All" option
  choices.push({
    name: chalk.cyan("Run All Scenarios"),
    value: "all",
  });

  // Select scenario
  const selectedId = await ui.select("Select a scenario:", choices);

  if (selectedId === "all") {
    // Run all scenarios
    for (const scenario of questionUnderstandingScenarios) {
      await runScenario(scenario);

      // Ask to continue after each scenario
      if (questionUnderstandingScenarios.indexOf(scenario) < questionUnderstandingScenarios.length - 1) {
        const continueRunning = await ui.confirm("Continue to next scenario?", true);
        if (!continueRunning) break;
      }
    }
  } else {
    // Run selected scenario
    const scenario = questionUnderstandingScenarios.find((s) => s.id === selectedId);
    if (scenario) {
      await runScenario(scenario);
    } else {
      ui.error(`Scenario not found: ${selectedId}`);
    }
  }
}
