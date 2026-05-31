/**
 * Blade Runner - Real-Time Dashboard
 *
 * Live-updating test progress dashboard with interactive controls.
 * Displays progress, coverage, throughput, and worker status.
 *
 * @module engine/testing/blade-runner/dashboard
 */

import {
  style,
  icons,
  box,
  horizontalLine,
  progressBar,
  percentage,
  coverageBar,
  sparkline,
  spinnerFrame,
  formatRate,
  formatEta,
  hideCursor,
  showCursor,
  truncate,
  padRight,
  padLeft,
  visualLength,
} from "./ui";
import { KeyHandler, createKeyHandler } from "./key-handler";
import { BLADE_RUNNER_VERSION } from "./presets";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Dashboard state
 */
export interface DashboardState {
  // Progress
  completed: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  alternatePaths: number;

  // Live metrics
  variationsPerSecond: number;
  throughputHistory: number[];

  // Coverage
  coverage: {
    nodes: { current: number; total: number };
    edges: { current: number; total: number };
    branches: { current: number; total: number };
  };

  // Current variation
  currentVariation: string;

  // Timing
  startTime: number;
  etaMs: number;

  // Control state
  paused: boolean;
  failFast: boolean;
  timeScale: number;

  // Status
  status: "running" | "paused" | "completed" | "stopped";
}

/**
 * Dashboard callbacks
 */
export interface DashboardCallbacks {
  onQuit: () => void;
  onPause: () => void;
  onResume: () => void;
  onFailFastToggle: (enabled: boolean) => void;
  onTimeScaleChange: (scale: number) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DASHBOARD_WIDTH = 64;
const REFRESH_INTERVAL = 100; // ms
const MAX_SPEED_MULTIPLIER = 20000;
const MIN_TIME_SCALE = 1 / MAX_SPEED_MULTIPLIER;
const MAX_TIME_SCALE = 1;

function clampTimeScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0.01;
  }
  return Math.min(Math.max(value, MIN_TIME_SCALE), MAX_TIME_SCALE);
}
// =============================================================================
// DASHBOARD
// =============================================================================

/**
 * Real-time test execution dashboard
 */
export class Dashboard {
  private state: DashboardState;
  private callbacks: DashboardCallbacks;
  private keyHandler: KeyHandler;
  private refreshTimer: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private startRow = 0;

  constructor(initialState: Partial<DashboardState>, callbacks: DashboardCallbacks) {
    const state: DashboardState = {
      completed: 0,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      alternatePaths: 0,
      variationsPerSecond: 0,
      throughputHistory: [],
      coverage: {
        nodes: { current: 0, total: 0 },
        edges: { current: 0, total: 0 },
        branches: { current: 0, total: 0 },
      },
      currentVariation: "",
      startTime: Date.now(),
      etaMs: 0,
      paused: false,
      failFast: true,
      timeScale: 0.01,
      status: "running",
      ...initialState,
    };
    state.timeScale = clampTimeScale(state.timeScale);
    this.state = state;

    this.callbacks = callbacks;
    this.keyHandler = createKeyHandler();
  }

  /**
   * Start the dashboard
   */
  start(): void {
    // Get current cursor position for updates
    this.startRow = 1; // Start from top

    // Hide cursor and clear screen
    hideCursor();
    console.clear();

    // Render initial state
    this.render();

    // Start key handler
    this.keyHandler.start({
      onQuit: () => {
        this.state.status = "stopped";
        this.stop();
        this.callbacks.onQuit();
      },
      onPause: () => {
        this.state.paused = true;
        this.state.status = "paused";
        this.callbacks.onPause();
        this.render();
      },
      onResume: () => {
        this.state.paused = false;
        this.state.status = "running";
        this.callbacks.onResume();
        this.render();
      },
      onFailFastToggle: () => {
        this.state.failFast = !this.state.failFast;
        this.callbacks.onFailFastToggle(this.state.failFast);
        this.render();
      },
      onSpeedUp: () => {
        const newScale = clampTimeScale(this.state.timeScale / 2);
        this.state.timeScale = newScale;
        this.callbacks.onTimeScaleChange(newScale);
        this.render();
      },
      onSlowDown: () => {
        const newScale = clampTimeScale(this.state.timeScale * 2);
        this.state.timeScale = newScale;
        this.callbacks.onTimeScaleChange(newScale);
        this.render();
      },
    });

    // Start refresh timer
    this.refreshTimer = setInterval(() => {
      this.frameIndex++;
      this.render();
    }, REFRESH_INTERVAL);
  }

  /**
   * Stop the dashboard
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.keyHandler.stop();
    showCursor();
  }

  /**
   * Update dashboard state
   */
  update(partial: Partial<DashboardState>): void {
    const next = { ...partial };
    if (next.timeScale !== undefined) {
      next.timeScale = clampTimeScale(next.timeScale);
    }
    Object.assign(this.state, next);

    // Track throughput history
    if (partial.variationsPerSecond !== undefined) {
      this.state.throughputHistory.push(partial.variationsPerSecond);
      if (this.state.throughputHistory.length > 30) {
        this.state.throughputHistory.shift();
      }
    }
  }

  /**
   * Mark dashboard as completed
   */
  complete(): void {
    this.state.status = "completed";
    this.stop();
    this.renderFinal();
  }

  /**
   * Render the dashboard
   */
  private render(): void {
    const lines = this.buildLines();

    // Move to start and rewrite
    process.stdout.write("\x1b[1;1H"); // Move to top-left
    for (const line of lines) {
      process.stdout.write(`\x1b[K${line}\n`);
    }
  }

  /**
   * Render final state (without controls line)
   */
  private renderFinal(): void {
    console.clear();
    const lines = this.buildLines(false);
    for (const line of lines) {
      console.log(line);
    }
  }

  /**
   * Build a row with proper padding (accounts for ANSI codes)
   */
  private row(content: string): string {
    const innerWidth = DASHBOARD_WIDTH - 2; // Subtract left/right borders
    const contentWidth = visualLength(content);
    const padding = Math.max(0, innerWidth - contentWidth);
    return `${box.vertical}${content}${" ".repeat(padding)}${box.vertical}`;
  }

  /**
   * Format a number with thousands separator
   */
  private formatNum(n: number): string {
    return n.toLocaleString();
  }

  /**
   * Build dashboard lines
   */
  private buildLines(showControls = true): string[] {
    const lines: string[] = [];
    const s = this.state;
    const W = DASHBOARD_WIDTH;

    // Status indicator
    const statusIcon =
      s.status === "running"
        ? spinnerFrame(this.frameIndex)
        : s.status === "paused"
          ? "⏸"
          : s.status === "completed"
            ? "✓"
            : "✗";
    const statusText =
      s.status === "running"
        ? "Running"
        : s.status === "paused"
          ? "Paused"
          : s.status === "completed"
            ? "Complete"
            : "Stopped";

    // Header
    lines.push(`${box.topLeft}${horizontalLine(W - 2)}${box.topRight}`);
    const title = `  BLADE RUNNER v${BLADE_RUNNER_VERSION}`;
    const status = `[${statusIcon} ${statusText}]  `;
    const headerPad = W - 2 - visualLength(title) - visualLength(status);
    lines.push(
      `${box.vertical}${title}${" ".repeat(Math.max(1, headerPad))}${status}${box.vertical}`
    );
    lines.push(`${box.leftT}${horizontalLine(W - 2)}${box.rightT}`);

    // Progress bar
    const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    const bar = progressBar(s.completed, s.total, 20);
    const progressText = `  Progress: ${bar} ${padLeft(`${pct}%`, 4)}  (${this.formatNum(s.completed)}/${this.formatNum(s.total)})`;
    lines.push(this.row(progressText));

    // Rate and ETA on same line
    const rate = formatRate(s.variationsPerSecond);
    const eta = formatEta(s.etaMs);
    const rateEtaText = `  Rate: ${padRight(rate, 8)}  ETA: ${padRight(eta, 8)}`;
    lines.push(this.row(rateEtaText));

    // Empty line
    lines.push(this.row(""));

    // Coverage section header
    lines.push(this.row(`  ${style.bold("COVERAGE")}`));

    // Coverage bars with fixed-width formatting
    const nodeCov = s.coverage.nodes;
    const edgeCov = s.coverage.edges;
    const branchCov = s.coverage.branches;

    const coverageLine = (label: string, current: number, total: number): string => {
      const pctStr = padLeft(percentage(current, total), 4);
      const countsStr = `${current}/${total}`;
      return `  ${padRight(label, 10)} ${coverageBar(current, total, 12)} ${pctStr}  ${countsStr}`;
    };

    lines.push(this.row(coverageLine("Nodes:", nodeCov.current, nodeCov.total)));
    lines.push(this.row(coverageLine("Edges:", edgeCov.current, edgeCov.total)));
    lines.push(this.row(coverageLine("Branches:", branchCov.current, branchCov.total)));

    // Empty line
    lines.push(this.row(""));

    // Results section header
    lines.push(this.row(`  ${style.bold("RESULTS")}`));

    // Results with proper spacing
    const passedStr = style.success(`Passed: ${padLeft(String(s.passed), 6)}`);
    const failedStr =
      s.failed > 0
        ? style.error(`Failed: ${padLeft(String(s.failed), 6)}`)
        : style.dim(`Failed: ${padLeft(String(s.failed), 6)}`);
    const skippedStr =
      s.skipped > 0
        ? style.warning(`Skipped: ${padLeft(String(s.skipped), 5)}`)
        : style.dim(`Skipped: ${padLeft(String(s.skipped), 5)}`);
    lines.push(this.row(`  ${passedStr}  ${failedStr}  ${skippedStr}`));

    // Empty line
    lines.push(this.row(""));

    // Current variation
    const maxVarLen = W - 14; // "  Current: " + padding
    const currentTrunc = truncate(s.currentVariation || "...", maxVarLen);
    lines.push(this.row(`  Current: ${style.dim(currentTrunc)}`));

    // Throughput sparkline
    const spark = sparkline(s.throughputHistory, 20);
    lines.push(this.row(`  Throughput: ${style.cyan(spark)}`));

    // Controls footer
    if (showControls) {
      lines.push(`${box.leftT}${horizontalLine(W - 2)}${box.rightT}`);

      // Show "COLLECT ALL" in cyan when fail-fast is OFF to indicate all errors are collected
      const failFastStatus = s.failFast ? style.success("ON") : style.cyan("OFF (collect all)");
      const speedDisplay =
        s.timeScale <= 0.01
          ? `${Math.round(1 / s.timeScale)}x`
          : s.timeScale < 1
            ? `${Math.round(1 / s.timeScale)}x`
            : "1x";

      const controls = `  [q]uit  [p]ause  [f]ail-fast: ${failFastStatus}  [+/-] speed: ${speedDisplay}`;
      lines.push(this.row(controls));
    }

    lines.push(`${box.bottomLeft}${horizontalLine(W - 2)}${box.bottomRight}`);

    return lines;
  }
}

/**
 * Create a dashboard instance
 */
export function createDashboard(
  initialState: Partial<DashboardState>,
  callbacks: DashboardCallbacks
): Dashboard {
  return new Dashboard(initialState, callbacks);
}
