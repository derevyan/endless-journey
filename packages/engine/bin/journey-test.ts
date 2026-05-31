#!/usr/bin/env tsx
/**
 * Journey Variation Tester CLI
 *
 * Systematically tests all possible execution paths through a journey.
 *
 * @usage
 *   npx tsx bin/journey-test.ts <journey.json> [options]
 *
 * @example
 *   npx tsx bin/journey-test.ts ./journeys/onboarding.json
 *   npx tsx bin/journey-test.ts ./journey.json --coverage --fail-fast
 *   npx tsx bin/journey-test.ts ./journey.json --format json --output results.json
 */

// Set log level to silent BEFORE any imports (must be synchronous, before dynamic import)
// This allows the progress bar to be visible in text mode
// Can be overridden with --verbose flag or explicit LOG_LEVEL env var
const verboseMode = process.argv.includes("--verbose");
const jsonMode = process.argv.includes("--format") &&
  (process.argv.includes("json") || process.argv.includes("junit"));

if (!verboseMode && !jsonMode && !process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = "silent";
}

// Use dynamic imports to ensure LOG_LEVEL is set before logger initialization
const fs = await import("node:fs");
const path = await import("node:path");
const { VariationTester } = await import("../src/testing/variation-tester");
const { InteractiveRunner } = await import("../src/testing/interactive-runner");
import type { JourneyConfig } from "@journey/schemas";
import type { OutputFormat, CLIOptions } from "../src/testing/types";

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

interface ParsedArgs {
  journeyPath: string;
  options: Partial<CLIOptions> & { fastMode?: boolean; interactive?: boolean };
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    journeyPath: "",
    options: {
      format: "text",
      coverage: false,
      failFast: false,
      parallel: 500,
      timeout: 30000,
      raceTests: false,
      verbose: false,
      fastMode: false,
    },
    help: false,
    version: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case "-h":
      case "--help":
        result.help = true;
        break;

      case "-v":
      case "--version":
        result.version = true;
        break;

      case "-f":
      case "--format":
        result.options.format = args[++i] as OutputFormat;
        break;

      case "-c":
      case "--coverage":
        result.options.coverage = true;
        break;

      case "--fail-fast":
        result.options.failFast = true;
        break;

      case "-p":
      case "--parallel":
        result.options.parallel = parseInt(args[++i], 10);
        break;

      case "-t":
      case "--timeout":
        result.options.timeout = parseInt(args[++i], 10);
        break;

      case "-s":
      case "--seed":
        result.options.seed = parseInt(args[++i], 10);
        break;

      case "-r":
      case "--race-tests":
        result.options.raceTests = true;
        break;

      case "--verbose":
        result.options.verbose = true;
        break;

      case "--fast":
        result.options.fastMode = true;
        break;

      case "--filter":
        result.options.filter = args[++i];
        break;

      case "--max-paths":
        (result.options as Record<string, unknown>).maxPaths = parseInt(args[++i], 10);
        break;

      case "-I":
      case "--interactive":
        result.options.interactive = true;
        break;

      case "--no-interactive":
        result.options.interactive = false;
        break;

      default:
        if (!arg.startsWith("-") && !result.journeyPath) {
          result.journeyPath = arg;
        } else if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }

    i++;
  }

  return result;
}

function printHelp(): void {
  console.log(`
Journey Variation Tester

Systematically tests all possible execution paths through a journey graph.

USAGE:
  journey-test <journey.json> [options]

ARGUMENTS:
  <journey.json>    Path to the journey JSON file

OPTIONS:
  -h, --help           Show this help message
  -v, --version        Show version number
  -I, --interactive    Interactive mode: pause on failures (default when TTY)
  --no-interactive     Force batch mode (for CI/scripting)
  -f, --format <fmt>   Output format: text (default), json, junit
  -c, --coverage       Show detailed coverage report
  --fail-fast          Stop on first failure
  -p, --parallel <n>   Max concurrent test executions (default: 500)
  -t, --timeout <ms>   Timeout per variation in ms (default: 30000)
  -s, --seed <n>       Random seed for reproducibility
  -r, --race-tests     Include race condition tests
  --fast               Fast mode: additive variation generation (much faster)
  --filter <pattern>   Filter variations by ID or description pattern
  --max-paths <n>      Max paths to explore (default: 1000)
  --verbose            Show detailed logs

EXAMPLES:
  # Basic test
  journey-test ./journey.json

  # Fast mode (recommended for large journeys)
  journey-test ./journey.json --fast

  # With coverage report
  journey-test ./journey.json --coverage

  # Stop on first failure with race tests
  journey-test ./journey.json --fail-fast --race-tests

  # JSON output for CI
  journey-test ./journey.json --format json

  # Reproduce specific run
  journey-test ./journey.json --seed 12345

  # Run specific variation
  journey-test ./journey.json --filter "path-3"
`);
}

function printVersion(): void {
  console.log("Journey Variation Tester v1.0.0");
}

// =============================================================================
// JOURNEY LOADING
// =============================================================================

function loadJourney(journeyPath: string): JourneyConfig {
  const absolutePath = path.resolve(process.cwd(), journeyPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Journey file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf-8");

  try {
    return JSON.parse(content) as JourneyConfig;
  } catch (e) {
    throw new Error(`Failed to parse journey JSON: ${(e as Error).message}`);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  // Parse arguments (skip node and script path)
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  if (!args.journeyPath) {
    console.error("Error: Journey file path is required");
    console.error("Usage: journey-test <journey.json> [options]");
    console.error("Run 'journey-test --help' for more information");
    process.exit(1);
  }

  // Load journey
  let journey: JourneyConfig;
  try {
    journey = loadJourney(args.journeyPath);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  // Determine interactive mode: explicit flag > auto-detect TTY
  const isInteractive =
    args.options.interactive ??
    (process.stdout.isTTY && args.options.format === "text");

  const maxPaths = (args.options as Record<string, unknown>).maxPaths as number | undefined;

  // =========================================================================
  // INTERACTIVE MODE
  // =========================================================================
  if (isInteractive) {
    console.log("\nJourney Variation Tester v1.0.0 (Interactive Mode)\n");

    try {
      const runner = new InteractiveRunner(journey, {
        timeout: args.options.timeout,
        maxPaths: maxPaths ?? 1000,
        fastMode: args.options.fastMode ?? true, // Default fast for interactive
        concurrency: args.options.parallel, // Pass parallelism flag
      });

      const result = await runner.run();

      // Exit with error code if tests failed
      process.exit(result.summary.failed > 0 ? 1 : 0);
    } catch (e) {
      console.error(`\nError during test execution: ${(e as Error).message}`);
      if (args.options.verbose) {
        console.error((e as Error).stack);
      }
      process.exit(1);
    }

    return;
  }

  // =========================================================================
  // BATCH MODE (existing behavior)
  // =========================================================================

  // Print header
  if (args.options.format === "text") {
    console.log("\nJourney Variation Tester v1.0.0\n");
    console.log(`Journey: ${path.basename(args.journeyPath)}`);
    console.log(`Nodes: ${journey.nodes.length}, Edges: ${journey.edges.length}`);
    console.log("");
  }

  // Create tester
  const tester = new VariationTester(journey, {
    maxPaths: maxPaths ?? 1000,
    maxDepth: 100,
    includeDeadEnds: true,
    textSampleCount: 3,
    includeRaceTests: args.options.raceTests,
    seed: args.options.seed,
    fastMode: args.options.fastMode,
    concurrency: args.options.parallel,
    timeout: args.options.timeout,
    failFast: args.options.failFast,
    logLevel: args.options.verbose ? "debug" : "error",
    showProgress: args.options.format === "text",
    filter: args.options.filter,
    format: args.options.format,
  });

  // Show stats before running
  if (args.options.format === "text") {
    const stats = tester.getStats();
    console.log("Discovering variations...");
    console.log(`  Paths: ${stats.pathCount}`);
    console.log(`  Estimated variations: ${stats.estimatedVariations}`);
    console.log(`  Interactive nodes: ${stats.interactiveNodes}`);
    console.log(`  Timer nodes: ${stats.timerNodes}`);
    console.log("");
  }

  // Run tests
  try {
    // Run once and get both the result and formatted output
    const result = await tester.run();
    const { formatReport } = await import("../src/testing/coverage-report");
    const output = formatReport(result, args.options.format!);
    console.log(output);

    // Exit with error code if tests failed
    process.exit(result.summary.failed > 0 ? 1 : 0);
  } catch (e) {
    console.error(`\nError during test execution: ${(e as Error).message}`);
    if (args.options.verbose) {
      console.error((e as Error).stack);
    }
    process.exit(1);
  }
}

// Run
main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
