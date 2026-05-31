/**
 * Blade Runner - UI Components
 *
 * Terminal rendering primitives for the blade-runner CLI.
 * Provides consistent, beautiful output across all modes.
 *
 * @module engine/testing/blade-runner/ui
 */

import * as readline from "node:readline";
import chalk from "chalk";

// =============================================================================
// COLORS & STYLING (using chalk)
// =============================================================================

/** Style helper functions using chalk for terminal colors */
export const style = {
  // Text modifiers
  bold: (s: string) => chalk.bold(s),
  dim: (s: string) => chalk.dim(s),
  italic: (s: string) => chalk.italic(s),
  underline: (s: string) => chalk.underline(s),

  // Basic colors
  red: (s: string) => chalk.red(s),
  green: (s: string) => chalk.green(s),
  yellow: (s: string) => chalk.yellow(s),
  blue: (s: string) => chalk.blue(s),
  magenta: (s: string) => chalk.magenta(s),
  cyan: (s: string) => chalk.cyan(s),
  gray: (s: string) => chalk.gray(s),
  white: (s: string) => chalk.white(s),

  // Semantic colors
  success: (s: string) => chalk.greenBright(s),
  error: (s: string) => chalk.redBright(s),
  warning: (s: string) => chalk.yellowBright(s),
  info: (s: string) => chalk.cyanBright(s),
};

// =============================================================================
// BOX DRAWING
// =============================================================================

/** Box drawing characters */
export const box = {
  // Single line
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  leftT: "├",
  rightT: "┤",
  topT: "┬",
  bottomT: "┴",
  cross: "┼",

  // Heavy horizontal
  heavyHorizontal: "━",

  // Double line
  dTopLeft: "╔",
  dTopRight: "╗",
  dBottomLeft: "╚",
  dBottomRight: "╝",
  dHorizontal: "═",
  dVertical: "║",
};

/**
 * Create a horizontal line
 */
export function horizontalLine(width: number, char = box.horizontal): string {
  return char.repeat(width);
}

/**
 * Create a heavy horizontal line (for section headers)
 */
export function heavyLine(width: number): string {
  return box.heavyHorizontal.repeat(width);
}

/**
 * Create a boxed header
 */
export function boxedHeader(title: string, width = 60): string {
  const padding = Math.max(0, width - title.length - 4);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;

  return [
    `${box.topLeft}${horizontalLine(width - 2)}${box.topRight}`,
    `${box.vertical} ${" ".repeat(leftPad)}${style.bold(title)}${" ".repeat(rightPad)} ${box.vertical}`,
    `${box.leftT}${horizontalLine(width - 2)}${box.rightT}`,
  ].join("\n");
}

/**
 * Create a simple section divider
 */
export function sectionDivider(width = 60): string {
  return style.dim(horizontalLine(width));
}

// =============================================================================
// PROGRESS BAR
// =============================================================================

/**
 * Create a progress bar
 */
export function progressBar(
  current: number,
  total: number,
  width = 10,
  filled = "█",
  empty = "░"
): string {
  const percentage = total > 0 ? Math.min(1, current / total) : 0;
  const filledCount = Math.round(percentage * width);
  const emptyCount = width - filledCount;

  return filled.repeat(filledCount) + empty.repeat(emptyCount);
}

/**
 * Create a percentage display
 */
export function percentage(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

// =============================================================================
// STATUS ICONS
// =============================================================================

export const icons = {
  success: "✅",
  failure: "❌",
  warning: "⚠️",
  info: "ℹ️",
  skip: "⏭️",
  running: "🔄",
  clock: "⏱️",
  chart: "📊",
  rocket: "🚀",
  lightning: "⚡",
  magnifier: "🔍",
  target: "🎯",
  wrench: "🛠️",
  sword: "🗡️",
  bug: "🐛",
  design: "🎨",
  timeout: "⏰",
  question: "❓",
  check: "✓",
  cross: "✗",
  dot: "•",
  arrow: "→",
  arrowRight: "▶",
};

// =============================================================================
// TERMINAL INTERACTION
// =============================================================================

/**
 * Clear the current line
 */
export function clearLine(): void {
  process.stdout.write("\r\x1b[K");
}

/**
 * Move cursor up N lines
 */
export function cursorUp(n = 1): void {
  process.stdout.write(`\x1b[${n}A`);
}

/**
 * Move cursor down N lines
 */
export function cursorDown(n = 1): void {
  process.stdout.write(`\x1b[${n}B`);
}

/**
 * Hide cursor
 */
export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

/**
 * Show cursor
 */
export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

/**
 * Wait for a single keypress
 */
export async function waitForKey(validKeys?: string[]): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Enable raw mode if available
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const onData = (data: Buffer) => {
      const key = data.toString().toLowerCase();

      // Handle Ctrl+C
      if (key === "\x03") {
        showCursor();
        process.exit(0);
      }

      // Ignore invalid keys
      if (validKeys && !validKeys.includes(key)) {
        return;
      }

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.off("data", onData);
      rl.close();
      resolve(key);
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Print and wait for any key
 */
export async function pressAnyKey(message = "Press any key to continue..."): Promise<void> {
  console.log(style.dim(message));
  await waitForKey();
}

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a number with commas
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Strip ANSI escape codes from string to get visual length
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Get the visual length of a string (ignoring ANSI codes)
 */
export function visualLength(str: string): number {
  return stripAnsi(str).length;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Pad string to width (accounts for ANSI codes)
 */
export function padRight(str: string, width: number): string {
  const visLen = visualLength(str);
  if (visLen >= width) return str;
  return str + " ".repeat(width - visLen);
}

/**
 * Pad string to width (left, accounts for ANSI codes)
 */
export function padLeft(str: string, width: number): string {
  const visLen = visualLength(str);
  if (visLen >= width) return str;
  return " ".repeat(width - visLen) + str;
}

/**
 * Center string in width (accounts for ANSI codes)
 */
export function center(str: string, width: number): string {
  const visLen = visualLength(str);
  if (visLen >= width) return str;
  const padding = width - visLen;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return " ".repeat(leftPad) + str + " ".repeat(rightPad);
}

// =============================================================================
// COMPOSITE COMPONENTS
// =============================================================================

/**
 * Render a key-value pair
 */
export function keyValue(key: string, value: string | number, keyWidth = 15): string {
  return `${style.dim(padRight(key + ":", keyWidth))} ${value}`;
}

/**
 * Render a metric with bar
 */
export function metricBar(
  label: string,
  current: number,
  total: number,
  labelWidth = 12
): string {
  const pct = percentage(current, total);
  const bar = progressBar(current, total);
  return `${padRight(label + ":", labelWidth)} ${padLeft(current + "/" + total, 8)} (${padLeft(pct, 4)}) ${bar}`;
}

/**
 * Render a two-column layout
 */
export function twoColumns(
  left: string[],
  right: string[],
  leftWidth = 30,
  separator = "  "
): string {
  const maxRows = Math.max(left.length, right.length);
  const lines: string[] = [];

  for (let i = 0; i < maxRows; i++) {
    const leftLine = left[i] || "";
    const rightLine = right[i] || "";
    lines.push(padRight(leftLine, leftWidth) + separator + rightLine);
  }

  return lines.join("\n");
}

// =============================================================================
// DASHBOARD PRIMITIVES
// =============================================================================

/**
 * Update multiple lines in place (for dashboard refresh)
 */
export function updateLines(lines: string[], startRow: number): void {
  // Move cursor to start row and clear/rewrite each line
  process.stdout.write(`\x1b[${startRow};1H`); // Move to row
  for (const line of lines) {
    process.stdout.write(`\x1b[K${line}\n`); // Clear line, write, newline
  }
}

/**
 * Save current cursor position
 */
export function saveCursor(): void {
  process.stdout.write("\x1b[s");
}

/**
 * Restore saved cursor position
 */
export function restoreCursor(): void {
  process.stdout.write("\x1b[u");
}

/**
 * Move cursor to specific position
 */
export function moveCursor(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}

/**
 * Color-coded coverage bar based on percentage
 */
export function coverageBar(
  current: number,
  total: number,
  width = 20
): string {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.round((pct / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);

  // Color based on coverage level
  if (pct >= 80) return style.success(bar);
  if (pct >= 50) return style.warning(bar);
  return style.error(bar);
}

/**
 * Throughput sparkline visualization
 * Uses braille characters for smooth visualization
 */
export function sparkline(values: number[], width = 20): string {
  if (values.length === 0) return " ".repeat(width);

  const chars = "▁▂▃▄▅▆▇█";
  const recent = values.slice(-width);
  const max = Math.max(...recent, 1);
  const min = Math.min(...recent, 0);
  const range = max - min;

  const result = recent
    .map((v) => {
      const normalized = range > 0 ? (v - min) / range : 0.5;
      const index = Math.round(normalized * (chars.length - 1));
      return chars[index];
    })
    .join("");

  // Pad to width if needed
  return result.padStart(width, " ");
}

/**
 * Animated spinner frames
 */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Get next spinner frame
 */
export function spinnerFrame(frameIndex: number): string {
  return SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
}

/**
 * Format rate (variations per second)
 */
export function formatRate(rate: number): string {
  if (rate >= 1000) {
    return `${(rate / 1000).toFixed(1)}k/s`;
  }
  return `${Math.round(rate)}/s`;
}

/**
 * Format ETA
 */
export function formatEta(remainingMs: number): string {
  if (remainingMs <= 0) return "done";
  if (remainingMs < 1000) return "<1s";
  if (remainingMs < 60000) return `${Math.ceil(remainingMs / 1000)}s`;

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.ceil((remainingMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
