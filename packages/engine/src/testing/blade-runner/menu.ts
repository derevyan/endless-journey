/**
 * Blade Runner - Interactive Menu
 *
 * Uses @inquirer/prompts for polished interactive menus
 * following the playground:llm pattern.
 *
 * @module engine/testing/blade-runner/menu
 */

import { select, confirm, input } from "@inquirer/prompts";
import type { JourneyConfig } from "@journey/schemas";
import { TEST_LEVELS, estimateVariations, createCustomLevel } from "./levels";
import type { TestLevel, JourneyInfo, BladeRunnerConfig, TestLevelKey } from "./types";
import type { ExecutionPreset } from "./presets";
import {
  BLADE_RUNNER_VERSION,
  DEFAULT_PARITY_POLL_MS,
  DEFAULT_PARITY_WAIT_MS,
  DEFAULT_TIME_SCALE,
  PARITY_DEFAULT_CONCURRENCY,
  getExecutionPresetsForBackend,
} from "./presets";
import { style, icons, heavyLine } from "./ui";
import { hasTimer, isInteractiveNode } from "../journey-node-utils";
import { recommendTestLevel, type LevelRecommendation } from "./recommender";

// =============================================================================
// CONSTANTS
// =============================================================================

const MENU_WIDTH = 60;
// =============================================================================
// JOURNEY ANALYSIS
// =============================================================================

/**
 * Analyze a journey to extract display info
 */
export function analyzeJourney(journey: JourneyConfig, filePath: string): JourneyInfo {
  const nodes = journey.nodes || [];
  const edges = journey.edges || [];

  // Count node types
  let interactiveNodes = 0;
  let timerNodes = 0;
  let conditionNodes = 0;

  for (const node of nodes) {
    if (isInteractiveNode(node)) {
      interactiveNodes++;
    }
    if (hasTimer(node)) {
      timerNodes++;
    }
    if (node.data.type === "condition") {
      conditionNodes++;
    }
  }

  const name =
    (journey as { name?: string }).name ||
    (journey as { id?: string }).id ||
    filePath.split("/").pop()?.replace(".json", "") ||
    "Unknown Journey";

  return {
    name,
    path: filePath,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    interactiveNodes,
    timerNodes,
    conditionNodes,
  };
}

// =============================================================================
// UI RENDERING
// =============================================================================

/**
 * Display the blade-runner header
 */
export function renderHeader(): void {
  console.log("");
  console.log(style.bold(`${icons.sword}  BLADE RUNNER v${BLADE_RUNNER_VERSION}`));
  console.log(heavyLine(MENU_WIDTH));
}

/**
 * Display journey information
 */
export function renderJourneyInfo(info: JourneyInfo): void {
  console.log("");
  console.log(`Journey: ${style.cyan(info.name)}`);
  console.log(
    style.dim(
      `  ${info.nodeCount} nodes ${icons.dot} ${info.edgeCount} edges ${icons.dot} ` +
        `${info.interactiveNodes} interactive ${icons.dot} ${info.timerNodes} timers`
    )
  );
  console.log("");
}

// =============================================================================
// INTERACTIVE MENU
// =============================================================================

/**
 * Build choices for the select menu
 */
function buildLevelChoices(
  stats: { pathCount: number; interactiveNodes: number; timerNodes: number },
  recommendation: LevelRecommendation
) {
  return TEST_LEVELS.map((level, index) => {
    const estimated = estimateVariations(level, stats);
    const estimatedStr = estimated > 1000 ? `~${Math.round(estimated / 1000)}k` : `~${estimated}`;

    // Mark recommended level
    const isRecommended = level.key === recommendation.level.key;
    const suffix = isRecommended ? style.success(" (recommended)") : "";
    const keyHint = level.key !== "custom" ? `[${index + 1}] ` : "";

    return {
      name: `${keyHint}${level.icon} ${level.name}${suffix}`,
      value: level.key,
      description: `${estimatedStr} variations - ${level.description}`,
    };
  });
}

function applyPresetToConfig(
  config: BladeRunnerConfig,
  preset: ExecutionPreset
): BladeRunnerConfig {
  return {
    ...config,
    backend: preset.backend,
    ...preset.config,
  };
}

function validateIntRange(value: string, min: number, max: number): true | string {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < min || num > max) {
    return `Please enter a number between ${min} and ${max}`;
  }
  return true;
}

function validateFloatRange(value: string, min: number, max: number): true | string {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    return `Please enter a number between ${min} and ${max}`;
  }
  return true;
}

async function promptBackend(): Promise<BladeRunnerConfig["backend"]> {
  return select({
    message: "Execution backend:",
    choices: [
      {
        name: "Engine (local)",
        value: "engine",
        description: "In-process engine runner (fast, deterministic).",
      },
      {
        name: "Telegram parity",
        value: "telegram-parity",
        description: "API + adapter + sandbox parity run.",
      },
    ],
  });
}

async function promptPreset(
  backend: BladeRunnerConfig["backend"]
): Promise<ExecutionPreset | "custom"> {
  const presets = getExecutionPresetsForBackend(backend);
  const orderedPresets = [...presets].sort(
    (a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended))
  );
  const choices = orderedPresets.map((preset) => ({
    name: preset.recommended ? `${preset.name} ${style.success("(recommended)")}` : preset.name,
    value: preset.key,
    description: preset.description,
  }));

  choices.push({
    name: "Custom",
    value: "custom",
    description: "Configure settings manually.",
  });

  const selected = await select({
    message: "Preset:",
    choices,
  });

  if (selected === "custom") {
    return "custom";
  }

  return orderedPresets.find((preset) => preset.key === selected) ?? "custom";
}

async function promptAdvancedSettings(
  config: BladeRunnerConfig
): Promise<Partial<BladeRunnerConfig>> {
  const backend = config.backend ?? "engine";
  const concurrencyDefault =
    config.concurrency ??
    (backend === "telegram-parity" ? PARITY_DEFAULT_CONCURRENCY : config.level.concurrency);
  const timeScaleDefault = config.timeScale ?? DEFAULT_TIME_SCALE;
  const timeoutDefault = config.timeout ?? 120000;

  const concurrencyInput = await input({
    message: "Parallel executions:",
    default: String(concurrencyDefault),
    validate: (value) => validateIntRange(value, 1, 10000),
  });
  const timeScaleInput = await input({
    message: "Time scale (1.0 = real time):",
    default: String(timeScaleDefault),
    validate: (value) => validateFloatRange(value, 0.001, 100),
  });
  const timeoutInput = await input({
    message: "Timeout per variation (ms):",
    default: String(timeoutDefault),
    validate: (value) => validateIntRange(value, 1000, 600000),
  });
  const failFast = await confirm({
    message: "Stop on first failure?",
    default: config.failFast,
  });

  const overrides: Partial<BladeRunnerConfig> = {
    concurrency: Number.parseInt(concurrencyInput, 10),
    timeScale: Number.parseFloat(timeScaleInput),
    timeout: Number.parseInt(timeoutInput, 10),
    failFast,
  };

  if (backend === "telegram-parity") {
    const parityWaitInput = await input({
      message: "Parity wait max (ms):",
      default: String(config.parityWaitMs ?? DEFAULT_PARITY_WAIT_MS),
      validate: (value) => validateIntRange(value, 10, 600000),
    });
    const parityPollInput = await input({
      message: "Parity poll interval (ms):",
      default: String(config.parityPollMs ?? DEFAULT_PARITY_POLL_MS),
      validate: (value) => validateIntRange(value, 10, 600000),
    });
    const parityFreezeTimers = await confirm({
      message: "Freeze timers between inputs?",
      default: config.parityFreezeTimers ?? true,
    });
    const parityStripMedia = await confirm({
      message: "Strip media sends?",
      default: config.parityStripMedia ?? true,
    });
    const sandboxStrict = await confirm({
      message: "Enable Telegram sandbox strict mode?",
      default: config.sandboxStrict ?? false,
    });
    const mockLlm = await confirm({
      message: "Force mock LLM responses?",
      default: config.mockLlm ?? true,
    });
    const parityUserId = await input({
      message: "Mock user ID:",
      default: config.parityUserId ?? "user-demo",
      validate: (value) => (value.trim() ? true : "Please enter a user id"),
    });

    overrides.parityWaitMs = Number.parseInt(parityWaitInput, 10);
    overrides.parityPollMs = Number.parseInt(parityPollInput, 10);
    overrides.parityFreezeTimers = parityFreezeTimers;
    overrides.parityStripMedia = parityStripMedia;
    overrides.sandboxStrict = sandboxStrict;
    overrides.mockLlm = mockLlm;
    overrides.parityUserId = parityUserId.trim();
  }

  return overrides;
}

/**
 * Show the main menu and get user selection
 */
export async function showMenu(
  journey: JourneyConfig,
  journeyPath: string,
  stats: { pathCount: number; interactiveNodes: number; timerNodes: number }
): Promise<BladeRunnerConfig | null> {
  const info = analyzeJourney(journey, journeyPath);

  // Get recommendation for this journey
  const recommendation = recommendTestLevel(journey);

  // Show header and journey info
  console.clear();
  renderHeader();
  renderJourneyInfo(info);

  // Show recommendation
  console.log(style.bold("Recommendation:"));
  console.log(
    `  ${recommendation.level.icon} ${style.cyan(recommendation.level.name)} ` +
      `(${recommendation.stats.complexity} complexity: ${recommendation.stats.complexityScore}/100)`
  );
  for (const reason of recommendation.reasoning.slice(0, 2)) {
    console.log(style.dim(`  → ${reason}`));
  }
  console.log("");

  // Build choices with variation estimates
  const levelChoices = buildLevelChoices(
    {
      pathCount: stats.pathCount,
      interactiveNodes: info.interactiveNodes,
      timerNodes: info.timerNodes,
    },
    recommendation
  );

  // Add quit option - use separate array with union type
  const choices: Array<{ name: string; value: TestLevelKey | "quit"; description: string }> = [
    ...levelChoices,
    {
      name: "❌ Quit",
      value: "quit",
      description: "Exit blade-runner",
    },
  ];

  try {
    // Use @inquirer/prompts select
    const selectedKey = await select({
      message: "Select test level:",
      choices,
    });

    if (selectedKey === "quit") {
      console.log("");
      console.log(style.dim("Goodbye!"));
      return null;
    }

    // Get the selected level
    let level = TEST_LEVELS.find((l) => l.key === selectedKey)!;

    // Handle custom level
    if (level.key === "custom") {
      level = await configureCustomLevel();
    }

    const backend = await promptBackend();
    let config: BladeRunnerConfig = {
      journeyPath,
      level,
      interactive: true,
      failFast: true,
      verbose: false,
      backend,
    };

    const preset = await promptPreset(backend);
    if (preset === "custom") {
      const overrides = await promptAdvancedSettings(config);
      config = { ...config, ...overrides };
    } else {
      config = applyPresetToConfig(config, preset);
      const adjust = await confirm({
        message: "Adjust advanced settings?",
        default: false,
      });
      if (adjust) {
        const overrides = await promptAdvancedSettings(config);
        config = { ...config, ...overrides };
      }
    }

    console.log("");
    console.log(`${icons.arrowRight} Running ${level.icon} ${style.bold(level.name)} test...`);
    showRunConfirmation(config);

    return config;
  } catch {
    // User pressed Ctrl+C
    console.log("");
    console.log(style.dim("Cancelled."));
    return null;
  }
}

/**
 * Prompt for custom level configuration
 */
async function configureCustomLevel(): Promise<TestLevel> {
  console.log("");
  console.log(style.bold("Custom Configuration"));
  console.log(style.dim("Configure your test level parameters:"));
  console.log("");

  // Prompt for max paths
  const maxPathsInput = await input({
    message: "Maximum paths to explore:",
    default: "100",
    validate: (value) => {
      const num = parseInt(value, 10);
      if (Number.isNaN(num) || num < 1 || num > 100000) {
        return "Please enter a number between 1 and 100000";
      }
      return true;
    },
  });
  const maxPaths = parseInt(maxPathsInput, 10);

  // Prompt for text sample count
  const textSampleCountInput = await input({
    message: "Text input samples per field:",
    default: "3",
    validate: (value) => {
      const num = parseInt(value, 10);
      if (Number.isNaN(num) || num < 1 || num > 10) {
        return "Please enter a number between 1 and 10";
      }
      return true;
    },
  });
  const textSampleCount = parseInt(textSampleCountInput, 10);

  // Prompt for fast mode
  const fastMode = await confirm({
    message: "Enable fast mode (skip delays)?",
    default: true,
  });

  // Prompt for race condition tests
  const includeRaceTests = await confirm({
    message: "Include race condition tests?",
    default: false,
  });

  console.log("");
  console.log(
    style.dim(
      `Custom: ${maxPaths} paths, ${textSampleCount} samples, fast=${fastMode}, race=${includeRaceTests}`
    )
  );

  return createCustomLevel({
    maxPaths,
    fastMode,
    textSampleCount,
    includeRaceTests,
    concurrency: 500,
  });
}

/**
 * Confirm whether to run another test
 */
export async function confirmRunAnother(): Promise<boolean> {
  try {
    return await confirm({
      message: "Run another test?",
      default: true,
    });
  } catch {
    return false;
  }
}

/**
 * Show a quick confirmation before running
 */
export function showRunConfirmation(config: BladeRunnerConfig): void {
  console.log(style.dim(`Mode: ${config.level.name}`));
  console.log(style.dim(`Backend: ${config.backend ?? "engine"}`));
  console.log(
    style.dim(
      `Settings: maxPaths=${config.level.maxPaths}, ` +
        `fast=${config.level.fastMode}, ` +
        `race=${config.level.includeRaceTests}`
    )
  );

  const backend = config.backend ?? "engine";
  const concurrency =
    config.concurrency ??
    (backend === "telegram-parity" ? PARITY_DEFAULT_CONCURRENCY : config.level.concurrency);
  const timeScale = config.timeScale ?? DEFAULT_TIME_SCALE;
  console.log(style.dim(`Performance: parallel=${concurrency}, clock=${timeScale}x`));

  if (backend === "telegram-parity") {
    const waitMs = config.parityWaitMs ?? DEFAULT_PARITY_WAIT_MS;
    const pollMs = config.parityPollMs ?? DEFAULT_PARITY_POLL_MS;
    const freezeTimers = config.parityFreezeTimers ?? true;
    const stripMedia = config.parityStripMedia ?? true;
    const sandboxStrict = config.sandboxStrict ?? false;
    console.log(
      style.dim(
        `Parity: wait=${waitMs}ms, poll=${pollMs}ms, freeze=${freezeTimers}, stripMedia=${stripMedia}, sandbox=${sandboxStrict}`
      )
    );
  }
  console.log("");
}
