/**
 * Blade Runner - Execution Presets
 *
 * Curated configurations for fast, stable, or debug-friendly runs.
 *
 * @module engine/testing/blade-runner/presets
 */

import type { BladeRunnerConfig, TestLevelKey } from "./types";

export const BLADE_RUNNER_VERSION = "2.0.0";
export const DEFAULT_TIME_SCALE = 0.01;
export const DEFAULT_PARITY_WAIT_MS = 3000;
export const DEFAULT_PARITY_POLL_MS = 50;
export const PARITY_DEFAULT_CONCURRENCY = 4;

export type ExecutionPresetKey =
  | "engine-default"
  | "engine-fast"
  | "engine-debug"
  | "parity-fast"
  | "parity-stable"
  | "parity-debug"
  | "custom";

type PresetConfig = Partial<
  Pick<
    BladeRunnerConfig,
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
    | "sandboxStrict"
  >
>;

export interface ExecutionPreset {
  key: ExecutionPresetKey;
  name: string;
  description: string;
  backend: BladeRunnerConfig["backend"];
  levelKey?: TestLevelKey;
  config: PresetConfig;
  recommended?: boolean;
}

export const EXECUTION_PRESETS: ExecutionPreset[] = [
  {
    key: "engine-default",
    name: "Engine Default",
    description: "Local engine run with standard timings.",
    backend: "engine",
    config: {
      timeScale: DEFAULT_TIME_SCALE,
      failFast: true,
    },
  },
  {
    key: "engine-fast",
    name: "Engine Fast",
    description: "Aggressive time scaling with high parallelism.",
    backend: "engine",
    config: {
      timeScale: 0.001,
      concurrency: 1000,
      failFast: true,
    },
  },
  {
    key: "engine-debug",
    name: "Engine Debug",
    description: "Slow, single-threaded run for step-by-step tracing.",
    backend: "engine",
    config: {
      timeScale: 0.05,
      concurrency: 1,
      failFast: true,
    },
  },
  {
    key: "parity-stable",
    name: "Telegram Parity Stable",
    description: "Balanced parity settings with safer timer handling.",
    backend: "telegram-parity",
    levelKey: "standard",
    config: {
      timeScale: 0.01,
      concurrency: 10,
      failFast: false,
      mockLlm: true,
      parityWaitMs: 1000,
      parityPollMs: 25,
      parityFreezeTimers: true,
      parityStripMedia: true,
      sandboxStrict: false,
    },
    recommended: true,
  },
  {
    key: "parity-fast",
    name: "Telegram Parity Fast",
    description: "Max speed parity with mock LLM and stripped media.",
    backend: "telegram-parity",
    levelKey: "standard",
    config: {
      timeScale: 0.001,
      concurrency: 50,
      failFast: false,
      mockLlm: true,
      parityWaitMs: 500,
      parityPollMs: 10,
      parityFreezeTimers: false,
      parityStripMedia: true,
      sandboxStrict: false,
    },
  },
  {
    key: "parity-debug",
    name: "Telegram Parity Debug",
    description: "Low concurrency with strict sandbox checks.",
    backend: "telegram-parity",
    levelKey: "quick",
    config: {
      timeScale: 0.05,
      concurrency: 2,
      failFast: true,
      mockLlm: true,
      parityWaitMs: DEFAULT_PARITY_WAIT_MS,
      parityPollMs: DEFAULT_PARITY_POLL_MS,
      parityFreezeTimers: true,
      parityStripMedia: true,
      sandboxStrict: true,
    },
  },
];

export function getExecutionPreset(key: ExecutionPresetKey): ExecutionPreset | undefined {
  return EXECUTION_PRESETS.find((preset) => preset.key === key);
}

export function getExecutionPresetKeys(): ExecutionPresetKey[] {
  return EXECUTION_PRESETS.map((preset) => preset.key);
}

export function getExecutionPresetsForBackend(
  backend: BladeRunnerConfig["backend"]
): ExecutionPreset[] {
  return EXECUTION_PRESETS.filter((preset) => preset.backend === backend);
}
