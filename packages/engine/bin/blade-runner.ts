#!/usr/bin/env tsx
/**
 * Blade Runner - Journey Testing CLI
 *
 * "More human than human" - Testing journeys like a Replicant Hunter
 *
 * An intelligent, interactive journey testing tool that guides users
 * through testing with intuitive menus, distinguishes between engine
 * bugs vs journey design issues, and provides progressive testing levels.
 *
 * @usage
 *   pnpm blade-runner <journey.json>
 *   pnpm blade-runner <journey.json> --quick
 *   pnpm blade-runner <journey.json> --full --format json
 *
 * @example
 *   pnpm blade-runner ./journeys/onboarding.json
 *   pnpm blade-runner ./journey.json --standard
 *   pnpm blade-runner ./journey.json --thorough --fail-fast
 */

// Set log level to silent BEFORE any imports to keep UI clean
const verboseMode = process.argv.includes("--verbose");

if (!verboseMode && !process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = "silent";
}

// Dynamic imports to ensure LOG_LEVEL is set before logger initialization
const fs = await import("node:fs");
const path = await import("node:path");
const { VariationTester } = await import("../src/testing/variation-tester");
const { VariationExplorer } = await import("../src/testing/variation-explorer");
const { formatReport } = await import("../src/testing/coverage-report");
const { validateJourneyStructure, formatValidationResult } = await import("../src/validation/journey-validator");
const {
  BLADE_RUNNER_VERSION,
  EXECUTION_PRESETS,
  DEFAULT_TIME_SCALE,
  DEFAULT_PARITY_WAIT_MS,
  DEFAULT_PARITY_POLL_MS,
  PARITY_DEFAULT_CONCURRENCY,
  getExecutionPreset,
  getExecutionPresetKeys,
} = await import("../src/testing/blade-runner/presets");
import type { JourneyConfig, JourneyContent } from "@journey/schemas";
import { mergeJourneyContent } from "@journey/schemas";
import type { TestLevelKey, BladeRunnerConfig } from "../src/testing/blade-runner/types";
import type { TestExecutionBackend } from "../src/testing/backends/types";
import type { ExecutionPresetKey } from "../src/testing/blade-runner/presets";
import {
  showMenu,
  analyzeJourney,
  showRunConfirmation,
  confirmRunAnother,
  getTestLevel,
  getTestLevelByNumber,
  enhanceResult,
  renderResults,
  interactiveReview,
  formatExport,
  style,
  icons,
  formatDuration,
  showCursor,
  createDashboard,
  type DashboardState,
} from "../src/testing/blade-runner";

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

/**
 * Parse an integer argument with validation
 */
function parseIntArg(
  args: string[],
  index: number,
  name: string,
  min = 0,
  max = Infinity
): number {
  if (index >= args.length || args[index] === undefined) {
    console.error(`Error: ${name} requires a value`);
    process.exit(1);
  }
  const value = parseInt(args[index], 10);
  if (Number.isNaN(value)) {
    console.error(`Error: ${name} must be a number, got "${args[index]}"`);
    process.exit(1);
  }
  if (value < min || value > max) {
    console.error(`Error: ${name} must be between ${min} and ${max}, got ${value}`);
    process.exit(1);
  }
  return value;
}

/**
 * Parse a float argument with validation
 */
function parseFloatArg(
  args: string[],
  index: number,
  name: string,
  min = 0,
  max = Infinity
): number {
  if (index >= args.length || args[index] === undefined) {
    console.error(`Error: ${name} requires a value`);
    process.exit(1);
  }
  const value = Number.parseFloat(args[index]);
  if (!Number.isFinite(value)) {
    console.error(`Error: ${name} must be a number, got "${args[index]}"`);
    process.exit(1);
  }
  if (value < min || value > max) {
    console.error(`Error: ${name} must be between ${min} and ${max}, got ${value}`);
    process.exit(1);
  }
  return value;
}

/**
 * Parse a string argument with validation
 */
function parseStringArg(
  args: string[],
  index: number,
  name: string,
  validValues?: string[]
): string {
  if (index >= args.length || args[index] === undefined) {
    console.error(`Error: ${name} requires a value`);
    process.exit(1);
  }
  const value = args[index];
  if (validValues && !validValues.includes(value)) {
    console.error(`Error: ${name} must be one of: ${validValues.join(", ")}, got "${value}"`);
    process.exit(1);
  }
  return value;
}

type PresetOverrideKey =
  | "level"
  | "backend"
  | "failFast"
  | "timeout"
  | "timeScale"
  | "concurrency"
  | "mockLlm"
  | "parityWaitMs"
  | "parityPollMs"
  | "parityFreezeTimers"
  | "parityStripMedia"
  | "parityUserId"
  | "sandboxStrict";

function applyPresetToArgs(
  result: ParsedArgs,
  presetKey: ExecutionPresetKey,
  overrides?: Set<PresetOverrideKey>
): void {
  const preset = getExecutionPreset(presetKey);
  if (!preset) {
    return;
  }

  if (preset.levelKey && !overrides?.has("level")) {
    result.level = preset.levelKey;
  }

  if (preset.backend && !overrides?.has("backend")) {
    result.backend = preset.backend;
  }

  const config = preset.config;
  if (config.failFast !== undefined && !overrides?.has("failFast")) {
    result.failFast = config.failFast;
  }
  if (config.timeout !== undefined && !overrides?.has("timeout")) {
    result.timeout = config.timeout;
  }
  if (config.timeScale !== undefined && !overrides?.has("timeScale")) {
    result.timeScale = config.timeScale;
  }
  if (config.concurrency !== undefined && !overrides?.has("concurrency")) {
    result.concurrency = config.concurrency;
  }
  if (config.mockLlm !== undefined && !overrides?.has("mockLlm")) {
    result.mockLlm = config.mockLlm;
  }
  if (config.parityWaitMs !== undefined && !overrides?.has("parityWaitMs")) {
    result.parityWaitMs = config.parityWaitMs;
  }
  if (config.parityPollMs !== undefined && !overrides?.has("parityPollMs")) {
    result.parityPollMs = config.parityPollMs;
  }
  if (config.parityFreezeTimers !== undefined && !overrides?.has("parityFreezeTimers")) {
    result.parityFreezeTimers = config.parityFreezeTimers;
  }
  if (config.parityStripMedia !== undefined && !overrides?.has("parityStripMedia")) {
    result.parityStripMedia = config.parityStripMedia;
  }
  if (config.parityUserId !== undefined && !overrides?.has("parityUserId")) {
    result.parityUserId = config.parityUserId;
  }
  if (config.sandboxStrict !== undefined && !overrides?.has("sandboxStrict")) {
    result.sandboxStrict = config.sandboxStrict;
  }
}

interface ParsedArgs {
  journeyPath: string;
  level?: TestLevelKey;
  format?: "text" | "json" | "junit" | "markdown";
  failFast: boolean;
  timeout?: number;
  concurrency?: number;
  verbose: boolean;
  help: boolean;
  version: boolean;
  listPresets: boolean;
  interactive: boolean;
  preset?: ExecutionPresetKey;
  seed?: number;
  filter?: string;
  timeScale?: number;
  output?: string;
  backend?: "engine" | "telegram-parity";
  sandboxStrict?: boolean;
  mockLlm?: boolean;
  parityWaitMs?: number;
  parityPollMs?: number;
  parityFreezeTimers?: boolean;
  parityStripMedia?: boolean;
  parityUserId?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    journeyPath: "",
    failFast: true, // Default: stop on first failure
    verbose: false,
    help: false,
    version: false,
    listPresets: false,
    interactive: true, // Default: interactive mode
    backend: "engine",
  };

  const explicitOverrides = new Set<PresetOverrideKey>();

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

      case "--list-presets":
        result.listPresets = true;
        break;

      // Test levels as flags
      case "-1":
      case "--quick":
        result.level = "quick";
        result.interactive = false;
        explicitOverrides.add("level");
        break;

      case "-2":
      case "--standard":
        result.level = "standard";
        result.interactive = false;
        explicitOverrides.add("level");
        break;

      case "-3":
      case "--thorough":
        result.level = "thorough";
        result.interactive = false;
        explicitOverrides.add("level");
        break;

      case "-4":
      case "--full":
        result.level = "full";
        result.interactive = false;
        explicitOverrides.add("level");
        break;

      // Output format
      case "-f":
      case "--format":
        result.format = parseStringArg(args, ++i, "--format", ["text", "json", "junit", "markdown"]) as ParsedArgs["format"];
        result.interactive = false;
        break;

      case "--seed":
        result.seed = parseIntArg(args, ++i, "--seed", 0, Number.MAX_SAFE_INTEGER);
        break;

      case "--filter":
        result.filter = parseStringArg(args, ++i, "--filter");
        result.interactive = false;
        break;

      case "--time-scale":
        result.timeScale = parseFloatArg(args, ++i, "--time-scale", 0.001, 100);
        explicitOverrides.add("timeScale");
        break;

      case "--output":
        result.output = parseStringArg(args, ++i, "--output");
        result.interactive = false;
        break;

      case "--backend":
        result.backend = parseStringArg(args, ++i, "--backend", ["engine", "telegram-parity"]) as ParsedArgs["backend"];
        explicitOverrides.add("backend");
        break;

      case "--preset":
        result.preset = parseStringArg(args, ++i, "--preset", getExecutionPresetKeys()) as ExecutionPresetKey;
        result.interactive = false;
        break;

      case "--mock-llm":
        result.mockLlm = true;
        explicitOverrides.add("mockLlm");
        break;

      case "--real-llm":
        result.mockLlm = false;
        explicitOverrides.add("mockLlm");
        break;

      case "--parity-wait-ms":
        result.parityWaitMs = parseIntArg(args, ++i, "--parity-wait-ms", 10, 600000);
        explicitOverrides.add("parityWaitMs");
        break;

      case "--parity-poll-ms":
        result.parityPollMs = parseIntArg(args, ++i, "--parity-poll-ms", 10, 600000);
        explicitOverrides.add("parityPollMs");
        break;

      case "--parity-freeze-timers":
        result.parityFreezeTimers = true;
        explicitOverrides.add("parityFreezeTimers");
        break;

      case "--no-parity-freeze-timers":
        result.parityFreezeTimers = false;
        explicitOverrides.add("parityFreezeTimers");
        break;

      case "--parity-strip-media":
        result.parityStripMedia = true;
        explicitOverrides.add("parityStripMedia");
        break;

      case "--no-parity-strip-media":
        result.parityStripMedia = false;
        explicitOverrides.add("parityStripMedia");
        break;

      case "--parity-user":
        result.parityUserId = parseStringArg(args, ++i, "--parity-user");
        explicitOverrides.add("parityUserId");
        break;

      case "--sandbox-strict":
        result.sandboxStrict = true;
        explicitOverrides.add("sandboxStrict");
        break;

      // Other options
      case "--fail-fast":
        result.failFast = true;
        explicitOverrides.add("failFast");
        break;

      case "--no-fail-fast":
        result.failFast = false;
        explicitOverrides.add("failFast");
        break;

      case "-t":
      case "--timeout":
        result.timeout = parseIntArg(args, ++i, "--timeout", 1000, 600000);
        explicitOverrides.add("timeout");
        break;

      case "-p":
      case "--parallel":
        result.concurrency = parseIntArg(args, ++i, "--parallel", 1, 10000);
        explicitOverrides.add("concurrency");
        break;

      case "--verbose":
        result.verbose = true;
        break;

      case "--batch":
      case "--no-interactive":
        result.interactive = false;
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

  if (result.preset) {
    applyPresetToArgs(result, result.preset, explicitOverrides);
  }

  return result;
}

// Performance defaults - worker threads don't work with tsx, timeScale can be overridden
const PERF_WORKERS = 1;

type OutputFormat = "text" | "json" | "junit" | "markdown";
type LogLevel = "silent" | "error" | "warn" | "info" | "debug" | "trace";

interface TesterConfig {
  concurrency: number;
  timeout?: number;
  failFast: boolean;
  logLevel: LogLevel;
  showProgress: boolean;
  format?: OutputFormat;
  timeScale: number;
  seed?: number;
  filter?: string;
  journeyPath: string;
  backend?: TestExecutionBackend;
}

function resolveTimeScale(timeScale?: number): number {
  return timeScale ?? DEFAULT_TIME_SCALE;
}

function resolveConcurrency(
  level: BladeRunnerConfig["level"],
  backend: BladeRunnerConfig["backend"],
  override?: number
): number {
  if (override !== undefined) {
    return override;
  }

  return backend === "telegram-parity" ? PARITY_DEFAULT_CONCURRENCY : level.concurrency;
}

function createTester(
  journey: JourneyConfig,
  level: BladeRunnerConfig["level"],
  config: TesterConfig
): VariationTester {
  return new VariationTester(journey, {
    maxPaths: level.maxPaths,
    fastMode: level.fastMode,
    textSampleCount: level.textSampleCount,
    includeRaceTests: level.includeRaceTests,
    concurrency: config.concurrency,
    timeout: config.timeout,
    failFast: config.failFast,
    logLevel: config.logLevel,
    showProgress: config.showProgress,
    format: config.format,
    workers: PERF_WORKERS,
    timeScale: config.timeScale,
    seed: config.seed,
    filter: config.filter,
    journeyPath: config.journeyPath,
    backend: config.backend,
  });
}

function printHelp(): void {
  console.log(`
${icons.sword}  BLADE RUNNER - Journey Testing Tool

${style.bold("USAGE:")}
  blade-runner <journey.json> [options]

${style.bold("ARGUMENTS:")}
  <journey.json>    Path to the journey JSON file

${style.bold("TEST LEVELS:")} (use one, or omit for interactive menu)
  -1, --quick       🚀 Quick Scan (~10 variations)
  -2, --standard    ⚡ Standard (~100 variations)
  -3, --thorough    🔍 Thorough (~500 variations)
  -4, --full        🎯 Full Coverage (~2000 variations)

${style.bold("OPTIONS:")}
  -h, --help           Show this help message
  -v, --version        Show version number
  -f, --format <fmt>   Output format: text, json, junit, markdown
  --output <path>      Write report to file (or directory)
  --seed <number>      Deterministic variation generation
  --filter <pattern>   Only run variations matching ID or description
  --time-scale <num>   Clock scale for timers (default: 0.01)
  --backend <name>     Execution backend: engine, telegram-parity
  --mock-llm           Force mock LLM (default for telegram-parity)
  --real-llm           Use real LLM provider (disables mock)
  --parity-wait-ms <n> Max wait per parity step in ms (default: 3000)
  --parity-poll-ms <n> Parity poll interval in ms (default: 50)
  --parity-freeze-timers    Pause session timers between inputs (default for parity)
  --no-parity-freeze-timers Allow timers to run normally between inputs
  --parity-strip-media      Send text/buttons only (skip media) in parity runs (default)
  --no-parity-strip-media   Allow media sends in parity runs
  --parity-user <id>    Mock user key for parity auth (default: user-demo)
  --preset <name>       Apply an execution preset (see --list-presets)
  --list-presets        List available presets and exit
  --sandbox-strict     Enforce Telegram API constraints in sandbox mode
  --fail-fast          Stop on first failure (default)
  --no-fail-fast       Run all variations even on failures
  -p, --parallel <n>   Max concurrent executions (default: level setting, parity defaults to 4)
  -t, --timeout <ms>   Timeout per variation in ms (default: 120000)
  --batch              Force batch mode (no interactive menu)
  --verbose            Show detailed logs

${style.bold("EXAMPLES:")}
  # Interactive mode
  blade-runner ./journey.json

  # Quick smoke test
  blade-runner ./journey.json --quick

  # Standard test with JSON output for CI
  blade-runner ./journey.json --standard --format json

  # Full coverage test
  blade-runner ./journey.json --full

  # Reproduce a specific variation
  blade-runner ./journey.json --seed 1767015016211 --filter "path-12"

  # Telegram parity with preset configuration
  blade-runner ./journey.json --preset parity-stable
`);
}

function printPresets(): void {
  console.log("");
  console.log(style.bold("Execution presets:"));
  for (const preset of EXECUTION_PRESETS) {
    const recommended = preset.recommended ? ` ${style.success("(recommended)")}` : "";
    console.log(`  ${preset.key}${recommended}`);
    console.log(style.dim(`    ${preset.name} - ${preset.description}`));
  }
  console.log("");
}

function printVersion(): void {
  console.log(`${icons.sword} Blade Runner v${BLADE_RUNNER_VERSION}`);
}

function resolveOutputPath(output: string, format: OutputFormat): string {
  const ext =
    format === "json"
      ? "json"
      : format === "markdown"
        ? "md"
        : format === "junit"
          ? "xml"
          : "txt";
  const resolved = path.resolve(process.cwd(), output);
  const endsWithSeparator = output.endsWith("/") || output.endsWith(path.sep);

  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return path.join(resolved, `blade-runner-report.${ext}`);
    }
  }

  if (endsWithSeparator) {
    fs.mkdirSync(resolved, { recursive: true });
    return path.join(resolved, `blade-runner-report.${ext}`);
  }

  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return resolved;
}

type BackendArgs = Pick<
  ParsedArgs,
  | "backend"
  | "sandboxStrict"
  | "mockLlm"
  | "parityWaitMs"
  | "parityPollMs"
  | "parityFreezeTimers"
  | "parityStripMedia"
  | "parityUserId"
  | "timeScale"
>;

async function resolveBackend(args: BackendArgs): Promise<TestExecutionBackend | undefined> {
  const isParity = args.backend === "telegram-parity";
  if (args.mockLlm !== undefined || isParity) {
    const mockLlm = args.mockLlm ?? true;
    process.env.FORCE_MOCK_LLM = mockLlm ? "true" : "false";
  }

  if (!isParity) {
    return undefined;
  }

  if (args.parityWaitMs !== undefined) {
    process.env.TELEGRAM_PARITY_WAIT_MS = String(args.parityWaitMs);
  } else if (!process.env.TELEGRAM_PARITY_WAIT_MS) {
    process.env.TELEGRAM_PARITY_WAIT_MS = String(DEFAULT_PARITY_WAIT_MS);
  }

  if (args.parityPollMs !== undefined) {
    process.env.TELEGRAM_PARITY_POLL_MS = String(args.parityPollMs);
  } else if (!process.env.TELEGRAM_PARITY_POLL_MS) {
    process.env.TELEGRAM_PARITY_POLL_MS = String(DEFAULT_PARITY_POLL_MS);
  }

  if (args.parityFreezeTimers !== undefined) {
    process.env.TELEGRAM_PARITY_FREEZE_TIMERS = args.parityFreezeTimers ? "true" : "false";
  } else if (!process.env.TELEGRAM_PARITY_FREEZE_TIMERS) {
    process.env.TELEGRAM_PARITY_FREEZE_TIMERS = "true";
  }

  if (args.parityStripMedia !== undefined) {
    process.env.TELEGRAM_PARITY_STRIP_MEDIA = args.parityStripMedia ? "true" : "false";
  } else if (!process.env.TELEGRAM_PARITY_STRIP_MEDIA) {
    process.env.TELEGRAM_PARITY_STRIP_MEDIA = "true";
  }

  if (args.parityUserId !== undefined) {
    process.env.TELEGRAM_PARITY_MOCK_USER_ID = args.parityUserId;
  }

  if (args.timeScale !== undefined) {
    process.env.TELEGRAM_PARITY_TIME_SCALE = String(args.timeScale);
  } else if (!process.env.TELEGRAM_PARITY_TIME_SCALE) {
    process.env.TELEGRAM_PARITY_TIME_SCALE = String(DEFAULT_TIME_SCALE);
  }

  if (!process.env.ALLOW_MOCK_AUTH) {
    process.env.ALLOW_MOCK_AUTH = "true";
  }
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "test";
  }

  const { TelegramParityBackend } = await import("../src/testing/backends/telegram-parity-backend");
  const apiHarnessUrl = new URL("../../../apps/api/src/testing/api-harness/index.ts", import.meta.url);
  const sandboxUrl = new URL("../../../apps/api/src/testing/telegram-sandbox/index.ts", import.meta.url);
  const { createApiHarness } = await import(apiHarnessUrl.toString());
  const { createTelegramSandbox } = await import(sandboxUrl.toString());

  return new TelegramParityBackend({
    createApiHarness,
    createTelegramSandbox,
    sandboxOptions: {
      strict: args.sandboxStrict ?? false,
    },
    mockUserId: args.parityUserId,
  });
}

async function resolveBackendForConfig(
  config: BladeRunnerConfig,
  timeScale: number
): Promise<TestExecutionBackend | undefined> {
  return resolveBackend({
    backend: config.backend,
    sandboxStrict: config.sandboxStrict,
    mockLlm: config.mockLlm,
    parityWaitMs: config.parityWaitMs,
    parityPollMs: config.parityPollMs,
    parityFreezeTimers: config.parityFreezeTimers,
    parityStripMedia: config.parityStripMedia,
    parityUserId: config.parityUserId,
    timeScale,
  });
}

async function resolveBackendForArgs(
  args: ParsedArgs,
  timeScale: number
): Promise<TestExecutionBackend | undefined> {
  return resolveBackend({
    backend: args.backend,
    sandboxStrict: args.sandboxStrict,
    mockLlm: args.mockLlm,
    parityWaitMs: args.parityWaitMs,
    parityPollMs: args.parityPollMs,
    parityFreezeTimers: args.parityFreezeTimers,
    parityStripMedia: args.parityStripMedia,
    parityUserId: args.parityUserId,
    timeScale,
  });
}

function formatBatchOutput(result: ReturnType<typeof enhanceResult>, format: OutputFormat): string {
  if (format === "junit") {
    return formatReport(result, "junit");
  }
  if (format === "json") {
    return formatExport(result, "json");
  }
  if (format === "markdown") {
    return formatExport(result, "markdown");
  }
  return formatExport(result, "text");
}

// =============================================================================
// JOURNEY LOADING
// =============================================================================

/**
 * Wrapper format for journey files with metadata
 * Format: { name, description, configuration: { nodes, edges } }
 * Note: Plugins are now embedded in node.data.plugins[] (no separate pluginNodes)
 */
interface JourneyWrapper {
  name?: string;
  description?: string;
  configuration: JourneyConfig;
}

/**
 * Type guard to detect wrapper format
 */
function isJourneyWrapper(obj: unknown): obj is JourneyWrapper {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "configuration" in obj &&
    typeof (obj as JourneyWrapper).configuration === "object" &&
    (obj as JourneyWrapper).configuration !== null
  );
}

/**
 * Load journey from file, handling both old and new formats:
 * - Old: { nodes: [...], edges: [...] }
 * - New: { name: "...", configuration: { nodes: [...], edges: [...] } }
 *
 * Also auto-merges content.json if found in same directory.
 */
function loadJourney(journeyPath: string): JourneyConfig {
  const absolutePath = path.resolve(process.cwd(), journeyPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Journey file not found: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, "utf-8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(fileContent);
  } catch (e) {
    throw new Error(`Failed to parse journey JSON: ${(e as Error).message}`);
  }

  // Handle wrapper format: { name, configuration: { nodes, edges } }
  // Note: Plugins are now embedded in node.data.plugins[] - no separate pluginNodes
  let config: JourneyConfig;
  if (isJourneyWrapper(parsed)) {
    config = parsed.configuration;
    if (verboseMode) {
      console.log(style.dim(`  Detected wrapper format, extracted configuration`));
    }
  } else {
    config = parsed as JourneyConfig;
  }

  // Check for content.json in same directory and merge if found
  const contentPath = path.join(path.dirname(absolutePath), "content.json");
  if (fs.existsSync(contentPath)) {
    try {
      const contentFile = JSON.parse(fs.readFileSync(contentPath, "utf-8")) as JourneyContent;
      config = mergeJourneyContent(config, contentFile);
      if (verboseMode) {
        console.log(style.dim(`  Merged content from content.json`));
      }
    } catch (e) {
      console.warn(style.warning(`  Warning: Failed to merge content.json: ${(e as Error).message}`));
      // Continue with unresolved content tokens - may cause issues later
    }
  }

  return config;
}

// =============================================================================
// MAIN RUNNER
// =============================================================================

async function runTests(
  journey: JourneyConfig,
  config: BladeRunnerConfig
): Promise<{ failed: boolean }> {
  const { level } = config;
  const timeScale = resolveTimeScale(config.timeScale);
  const concurrency = resolveConcurrency(level, config.backend, config.concurrency);
  const backend = await resolveBackendForConfig(config, timeScale);

  // Create tester with level settings
  const tester = createTester(journey, level, {
    concurrency,
    timeout: config.timeout || 120000,
    failFast: config.failFast,
    logLevel: config.verbose ? "debug" : "error",
    showProgress: true,
    timeScale,
    seed: config.seed,
    filter: config.filter,
    journeyPath: config.journeyPath,
    backend,
  });

  // Show what we're about to do
  const stats = tester.getStats();
  console.log(style.dim(`Discovering ${stats.estimatedVariations} variations...`));
  console.log("");

  // Run tests
  const startTime = Date.now();
  const result = await tester.run();
  const duration = Date.now() - startTime;

  // Enhance result with diagnosis (pass journey for node context extraction)
  const enhanced = enhanceResult(result, level.key, journey);

  // Render results
  renderResults(enhanced);

  // Interactive review if in interactive mode
  if (config.interactive && enhanced.issues.length > 0) {
    await interactiveReview(enhanced, { outputPath: config.output });
  }

  return { failed: result.summary.failed > 0 };
}

/**
 * Run tests with live dashboard (interactive mode with real-time updates)
 *
 * Wires up:
 * - Dashboard → Tester: keyboard controls (pause/resume/stop/failFast/timeScale)
 * - Tester → Dashboard: progress updates (completed/passed/failed/coverage/etc)
 */
async function runInteractiveTests(
  journey: JourneyConfig,
  config: BladeRunnerConfig
): Promise<{ failed: boolean }> {
  const { level } = config;
  const timeScale = resolveTimeScale(config.timeScale);
  const concurrency = resolveConcurrency(level, config.backend, config.concurrency);
  const backend = await resolveBackendForConfig(config, timeScale);

  // Create tester first to get stats
  const tester = createTester(journey, level, {
    concurrency,
    timeout: config.timeout || 120000,
    failFast: config.failFast,
    logLevel: "silent", // Dashboard handles display
    showProgress: false, // Dashboard handles progress
    timeScale,
    seed: config.seed,
    filter: config.filter,
    journeyPath: config.journeyPath,
    backend,
  });

  const stats = tester.getStats();

  // Create dashboard with initial state
  const initialState: Partial<DashboardState> = {
    total: stats.estimatedVariations,
    failFast: config.failFast,
    timeScale,
    coverage: {
      nodes: { current: 0, total: journey.nodes?.length || 0 },
      edges: { current: 0, total: journey.edges?.length || 0 },
      branches: { current: 0, total: 0 },
    },
  };

  // Create dashboard with callbacks wired to tester
  const dashboard = createDashboard(initialState, {
    onQuit: () => tester.stop(),
    onPause: () => tester.pause(),
    onResume: () => tester.resume(),
    onFailFastToggle: (enabled) => tester.setFailFast(enabled),
    onTimeScaleChange: (scale) => tester.setTimeScale(scale),
  });

  // Wire tester progress to dashboard
  tester.setProgressCallback((update) => {
    dashboard.update({
      completed: update.completed,
      total: update.total,
      passed: update.passed,
      failed: update.failed,
      skipped: update.skipped,
      alternatePaths: update.alternatePaths,
      currentVariation: update.currentVariation,
      variationsPerSecond: update.variationsPerSecond,
      etaMs: update.etaMs,
      coverage: update.coverage,
    });
  });

  // Start dashboard, run tests, complete dashboard
  dashboard.start();
  const startTime = Date.now();

  try {
    const result = await tester.run();
    const duration = Date.now() - startTime;

    // Complete dashboard (stops key handler, shows final state)
    dashboard.complete();

    // Small delay to ensure dashboard renders final state
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Enhance result with diagnosis
    const enhanced = enhanceResult(result, level.key, journey);

    // Clear screen and render full results
    console.clear();
    renderResults(enhanced);

    // Interactive review if there are issues
    if (enhanced.issues.length > 0) {
      await interactiveReview(enhanced, { outputPath: config.output });
    }

    return { failed: result.summary.failed > 0 };
  } catch (error) {
    dashboard.stop();
    throw error;
  }
}

async function runBatchMode(
  journey: JourneyConfig,
  args: ParsedArgs
): Promise<void> {
  const level = args.level ? getTestLevel(args.level) : getTestLevel("standard");
  const format: OutputFormat = args.format || "text";
  const runnerFormat = format === "markdown" ? "text" : format;
  const timeScale = resolveTimeScale(args.timeScale);
  const concurrency = resolveConcurrency(level, args.backend, args.concurrency);
  const backend = await resolveBackendForArgs(args, timeScale);

  // Create tester
  const showProgress = format === "text" && !args.output;
  const tester = createTester(journey, level, {
    concurrency,
    timeout: args.timeout,
    failFast: args.failFast,
    logLevel: args.verbose ? "debug" : "error",
    showProgress,
    format: runnerFormat,
    timeScale,
    seed: args.seed,
    filter: args.filter,
    journeyPath: args.journeyPath,
    backend,
  });

  // Run tests
  const result = await tester.run();

  // Enhance and format output (pass journey for node context extraction)
  const enhanced = enhanceResult(result, level.key, journey);

  if (args.output) {
    const outputPath = resolveOutputPath(args.output, format);
    const content = formatBatchOutput(enhanced, format);
    fs.writeFileSync(outputPath, content);
  } else if (format === "json") {
    console.log(formatExport(enhanced, "json"));
  } else if (format === "markdown") {
    console.log(formatExport(enhanced, "markdown"));
  } else if (format === "junit") {
    console.log(formatReport(enhanced, "junit"));
  } else {
    renderResults(enhanced);
  }

  process.exit(result.summary.failed > 0 ? 1 : 0);
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  // Ensure cursor is shown on exit
  process.on("exit", () => showCursor());
  process.on("SIGINT", () => {
    showCursor();
    console.log("\n" + style.dim("Interrupted."));
    process.exit(130); // 128 + 2 (SIGINT)
  });
  process.on("SIGTERM", () => {
    showCursor();
    console.log("\n" + style.dim("Received SIGTERM, shutting down..."));
    process.exit(143); // 128 + 15 (SIGTERM)
  });

  // Parse arguments and resolve performance defaults based on mode
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.listPresets) {
    printPresets();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  if (!args.journeyPath) {
    console.error("Error: Journey file path is required");
    console.error("Usage: blade-runner <journey.json> [options]");
    console.error("Run 'blade-runner --help' for more information");
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

  // Run pre-flight validation
  const validationResult = validateJourneyStructure(journey);
  if (!validationResult.valid) {
    console.error("");
    console.error(style.error("❌ Journey has validation errors:"));
    console.error("");
    console.error(formatValidationResult(validationResult));
    process.exit(1);
  }

  // Show warnings but continue
  if (validationResult.warnings.length > 0) {
    console.log("");
    console.log(style.warning("⚠️  Validation warnings:"));
    for (const warning of validationResult.warnings) {
      const location = warning.nodeId ? ` (node: ${warning.nodeId})` : "";
      console.log(style.dim(`   ${warning.message}${location}`));
    }
    console.log("");
  }

  // Get stats for menu
  const explorer = new VariationExplorer(journey, { maxPaths: 1000, fastMode: true });
  const stats = explorer.getStats();

  // Determine mode
  if (!args.interactive || args.format || args.level) {
    // Batch mode - run directly without menu
    await runBatchMode(journey, args);
    return;
  }

  // Interactive mode - show menu with loop
  let running = true;
  let hasFailures = false;

  while (running) {
    const config = await showMenu(journey, args.journeyPath, {
      pathCount: stats.pathCount,
      interactiveNodes: stats.interactiveNodes,
      timerNodes: stats.timerNodes,
    });

    if (!config) {
      // User quit from menu
      break;
    }

    // Apply CLI overrides
    if (args.timeout !== undefined) {
      config.timeout = args.timeout;
    }
    if (args.concurrency !== undefined) {
      config.concurrency = args.concurrency;
    }
    if (args.timeScale !== undefined) {
      config.timeScale = args.timeScale;
    }
    if (args.seed !== undefined) {
      config.seed = args.seed;
    }
    if (args.filter) {
      config.filter = args.filter;
    }
    if (args.mockLlm !== undefined) {
      config.mockLlm = args.mockLlm;
    }
    if (args.parityWaitMs !== undefined) {
      config.parityWaitMs = args.parityWaitMs;
    }
    if (args.parityPollMs !== undefined) {
      config.parityPollMs = args.parityPollMs;
    }
    config.failFast = args.failFast;
    config.verbose = args.verbose;
    config.backend = args.backend;
    config.sandboxStrict = args.sandboxStrict;
    if (args.output) {
      config.output = args.output;
    }

    // Run with live dashboard (handles confirmation, progress, and results display)
    const result = await runInteractiveTests(journey, config);

    if (result.failed) {
      hasFailures = true;
    }

    // Ask if user wants to run another test
    console.log("");
    running = await confirmRunAnother();

    if (running) {
      console.log("");
    }
  }

  // Exit with appropriate code for CI integration
  // Note: menu.ts already prints "Goodbye!" when user quits,
  // and the report already shows pass/fail status clearly
  process.exit(hasFailures ? 1 : 0);
}

// Run
main().catch((e) => {
  showCursor();
  console.error("Unexpected error:", e);
  process.exit(1);
});
