#!/usr/bin/env tsx
/**
 * Journey Analyzer CLI
 *
 * Fast O(n+e) structural analysis of journey graphs.
 * Run before variation testing to catch problems early.
 *
 * @usage
 *   npx tsx bin/journey-analyze.ts <journey.json> [options]
 *
 * @example
 *   npx tsx bin/journey-analyze.ts ./journeys/onboarding.json
 *   npx tsx bin/journey-analyze.ts ./journey.json --json
 *   npx tsx bin/journey-analyze.ts ./journey.json --strict
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { JourneyConfig } from "@journey/schemas";
import {
  analyzeJourney,
  formatAnalysisReport,
  formatAnalysisJson,
  type AnalyzerOptions,
} from "../src/validation/journey-analyzer";

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

interface ParsedArgs {
  journeyPath: string;
  options: {
    json: boolean;
    strict: boolean;
    full: boolean;
    maxPaths: number;
  };
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    journeyPath: "",
    options: {
      json: false,
      strict: false,
      full: false,
      maxPaths: 10000,
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

      case "--json":
        result.options.json = true;
        break;

      case "--strict":
        result.options.strict = true;
        break;

      case "--full":
        result.options.full = true;
        break;

      case "--max-paths":
        result.options.maxPaths = parseInt(args[++i], 10);
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
Journey Analyzer

Fast O(n+e) structural analysis of journey graphs.
Run before variation testing to catch problems early.

USAGE:
  journey-analyze <journey.json> [options]

ARGUMENTS:
  <journey.json>    Path to the journey JSON file

OPTIONS:
  -h, --help        Show this help message
  -v, --version     Show version number
  --json            Output as JSON (for CI integration)
  --strict          Treat warnings as errors (exit 1 if any warnings)
  --full            Include all metrics (slightly slower)
  --max-paths <n>   Max paths to enumerate (default: 10000)

EXAMPLES:
  # Basic analysis
  journey-analyze ./journey.json

  # JSON output for CI
  journey-analyze ./journey.json --json

  # Strict mode (fail on warnings)
  journey-analyze ./journey.json --strict

  # Full analysis with higher path limit
  journey-analyze ./journey.json --full --max-paths 50000

OUTPUT:
  The analyzer checks:
  - Start/End node presence and uniqueness
  - Node connectivity (unreachable nodes)
  - Cycles (infinite auto-transition loops)
  - Timer and condition edge coverage
  - Button connections
  - Path metrics (count, depth, bottlenecks)

EXIT CODES:
  0 - Valid journey (no errors)
  1 - Invalid journey (has errors, or warnings in --strict mode)
`);
}

function printVersion(): void {
  console.log("Journey Analyzer v1.0.0");
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
  // Parse arguments
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
    console.error("Usage: journey-analyze <journey.json> [options]");
    console.error("Run 'journey-analyze --help' for more information");
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

  // Run analysis
  const analyzerOptions: AnalyzerOptions = {
    maxPaths: args.options.maxPaths,
    includeBottlenecks: args.options.full,
  };

  const result = analyzeJourney(journey, analyzerOptions);

  // Output
  const journeyName = path.basename(args.journeyPath);

  if (args.options.json) {
    console.log(formatAnalysisJson(result));
  } else {
    console.log("");
    console.log(formatAnalysisReport(result, journeyName));
  }

  // Determine exit code
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  if (hasErrors) {
    process.exit(1);
  }

  if (args.options.strict && hasWarnings) {
    if (!args.options.json) {
      console.log("");
      console.log("⚠ Exiting with error (--strict mode, warnings present)");
    }
    process.exit(1);
  }

  process.exit(0);
}

// Run
main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
