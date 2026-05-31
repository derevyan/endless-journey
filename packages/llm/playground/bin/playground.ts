#!/usr/bin/env tsx
/**
 * LLM Playground CLI
 *
 * Interactive playground for testing LLM modules with real API calls.
 *
 * @usage
 *   pnpm playground:llm              # From root folder
 *   pnpm --filter @journey/llm playground  # From llm package
 *
 * @requires
 *   - API keys in apps/api/.env (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/api/.env
const envPath = path.resolve(__dirname, "../../../../apps/api/.env");
const result = config({ path: envPath });

if (result.error) {
  console.log(chalk.yellow(`⚠ Could not load .env from ${envPath}`));
  console.log(chalk.gray("Make sure apps/api/.env exists with API keys\n"));
}

// Import after env is loaded
import { ui } from "../utils/console-ui";
import { runQuestionUnderstandingPlayground } from "../runners/question-understanding";
import { runGuardEvaluationPlayground } from "../runners/guard-evaluation";
import { usageTrackingService } from "../../src/services/usage-tracking-service";

// ============================================================================
// Environment Validation
// ============================================================================

interface EnvCheck {
  key: string;
  required: boolean;
  description: string;
}

const ENV_CHECKS: EnvCheck[] = [
  { key: "OPENAI_API_KEY", required: true, description: "OpenAI API key" },
  { key: "ANTHROPIC_API_KEY", required: true, description: "Anthropic API key" },
  { key: "GEMINI_API_KEY", required: false, description: "Google Gemini API key" },
  { key: "GROQ_API_KEY", required: false, description: "Groq API key" },
];

function validateEnvironment(): boolean {
  let hasErrors = false;

  console.log(chalk.bold("\nEnvironment Check:"));

  for (const check of ENV_CHECKS) {
    const value = process.env[check.key];
    const isSet = value && value.length > 10 && !value.includes("your_");

    if (isSet) {
      console.log(chalk.green(`  ✓ ${check.key}`));
    } else if (check.required) {
      console.log(chalk.red(`  ✗ ${check.key} (required)`));
      hasErrors = true;
    } else {
      console.log(chalk.yellow(`  ○ ${check.key} (optional)`));
    }
  }

  console.log();

  if (hasErrors) {
    console.log(chalk.red("Missing required API keys!"));
    console.log(chalk.gray(`Please set them in: ${envPath}\n`));
    return false;
  }

  return true;
}

// ============================================================================
// Available Modules
// ============================================================================

interface PlaygroundModule {
  name: string;
  value: string;
  description: string;
  run: () => Promise<void>;
}

const MODULES: PlaygroundModule[] = [
  {
    name: "Question Understanding",
    value: "question-understanding",
    description: "Test map-reduce question synthesis",
    run: runQuestionUnderstandingPlayground,
  },
  {
    name: "Guard Evaluation",
    value: "guard-evaluation",
    description: "Test safety guards (safety, policy, injection, spam)",
    run: runGuardEvaluationPlayground,
  },
];

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  ui.header("LLM Playground");

  console.log(chalk.gray("Interactive testing environment for @journey/llm modules"));
  console.log(chalk.gray("Makes real API calls - ensure API keys are configured\n"));

  // Validate environment
  if (!validateEnvironment()) {
    process.exit(1);
  }

  // Initialize model registry for cost calculation
  try {
    const { EssentialModelAdapter } = await import("../../src/adapters");
    const { setModelRegistryAdapter } = await import("../../src/server");
    const adapter = new EssentialModelAdapter();
    setModelRegistryAdapter(adapter);
    console.log(chalk.green("✓ Model registry initialized"));
  } catch (error) {
    console.log(chalk.yellow("⚠ Model registry initialization failed (cost tracking unavailable)"));
    console.log(chalk.gray(`  Error: ${(error as Error).message}`));
  }

  // Initialize usage tracking (background flush to DB)
  try {
    usageTrackingService.initialize();
    console.log(chalk.green("✓ Usage tracking initialized\n"));
  } catch (error) {
    console.log(chalk.yellow("⚠ Usage tracking initialization failed\n"));
  }

  // Module selection loop
  let running = true;

  while (running) {
    // Select module
    const moduleChoices = MODULES.map((m) => ({
      name: `${m.name} - ${m.description}`,
      value: m.value,
    }));

    moduleChoices.push({
      name: chalk.red("Exit"),
      value: "exit",
    });

    const selectedModule = await ui.select("Select a module to test:", moduleChoices);

    if (selectedModule === "exit") {
      running = false;
      continue;
    }

    // Find and run module
    const module = MODULES.find((m) => m.value === selectedModule);
    if (module) {
      try {
        await module.run();
      } catch (error) {
        ui.error(`Module error: ${(error as Error).message}`);
        if ((error as Error).stack) {
          console.log(chalk.gray((error as Error).stack));
        }
      }
    }

    // Ask to continue
    console.log();
    const continueRunning = await ui.confirm("Run another test?", true);
    if (!continueRunning) {
      running = false;
    }
  }

  console.log(chalk.cyan("\nGoodbye! 👋\n"));
}

// Run
main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
