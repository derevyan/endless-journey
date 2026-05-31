/**
 * Console UI Utilities for LLM Playground
 *
 * Provides styled console output using Chalk and interactive prompts
 * using @inquirer/prompts.
 */

import chalk from "chalk";
import { select, confirm, input } from "@inquirer/prompts";

// ============================================================================
// Types
// ============================================================================

export interface SelectChoice<T = string> {
  name: string;
  value: T;
  description?: string;
}

// ============================================================================
// Styled Output
// ============================================================================

/**
 * Print a styled header
 */
export function header(text: string): void {
  const line = "═".repeat(text.length + 6);
  console.log(chalk.bold.cyan(`\n╔${line}╗`));
  console.log(chalk.bold.cyan(`║   ${text}   ║`));
  console.log(chalk.bold.cyan(`╚${line}╝\n`));
}

/**
 * Print a success message
 */
export function success(text: string): void {
  console.log(chalk.green(`✓ ${text}`));
}

/**
 * Print an error message
 */
export function error(text: string): void {
  console.log(chalk.red(`✗ ${text}`));
}

/**
 * Print an info message
 */
export function info(text: string): void {
  console.log(chalk.gray(`ℹ ${text}`));
}

/**
 * Print a warning message
 */
export function warn(text: string): void {
  console.log(chalk.yellow(`⚠ ${text}`));
}

/**
 * Print a labeled value
 */
export function label(name: string, value: string): void {
  console.log(`${chalk.bold.blue(name)}: ${value}`);
}

/**
 * Print a section divider
 */
export function divider(): void {
  console.log(chalk.gray("─".repeat(60)));
}

const DEFAULT_BOX_WIDTH = 76;
const MIN_BOX_WIDTH = 50;

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(value: string): number {
  return stripAnsi(value).length;
}

function wrapWords(text: string, width: number): string[] {
  if (width <= 0) return [text];

  const words = text.trim().split(/\s+/);
  if (words.length === 1 && !words[0]) {
    return [""];
  }

  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (visibleLength(next) > width) {
      if (current) {
        wrapped.push(current);
        current = word;
      } else {
        wrapped.push(word);
        current = "";
      }
      continue;
    }
    current = next;
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped;
}

function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];

  const lines = text.split("\n");
  const wrapped: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      wrapped.push("");
      continue;
    }

    const leadingMatch = line.match(/^\s*/);
    const leading = leadingMatch ? leadingMatch[0] : "";
    const content = line.slice(leading.length);
    const contentWidth = Math.max(1, width - visibleLength(leading));
    const segments = wrapWords(content, contentWidth);

    segments.forEach((segment, index) => {
      const prefix = index === 0 ? leading : " ".repeat(visibleLength(leading));
      wrapped.push(`${prefix}${segment}`);
    });
  }

  return wrapped;
}

export function getBoxWidth(maxWidth = DEFAULT_BOX_WIDTH): number {
  const columns = process.stdout.columns ?? DEFAULT_BOX_WIDTH + 4;
  return Math.max(MIN_BOX_WIDTH, Math.min(maxWidth, columns - 4));
}

function resolveBoxWidth(
  title: string,
  lines: string[],
  preferredWidth?: number
): number {
  const titleWidth = visibleLength(title) + 2;
  const maxLineWidth = lines.reduce((max, line) => Math.max(max, visibleLength(line)), 0);
  const desired = preferredWidth ?? getBoxWidth();
  return Math.max(titleWidth, Math.min(desired, Math.max(titleWidth, maxLineWidth)));
}

export function boxLines(
  title: string,
  lines: string[],
  options?: { width?: number; color?: (value: string) => string }
): void {
  const color = options?.color ?? chalk.cyan;
  const contentLines = lines.length ? lines : [""];
  const width = resolveBoxWidth(title, contentLines, options?.width);
  const wrappedLines = contentLines.flatMap((line) => wrapText(line, width));
  const titleWidth = visibleLength(title);
  const dashCount = Math.max(0, width - titleWidth - 1);

  console.log(color(`┌─ ${title} ${"─".repeat(dashCount)}┐`));
  for (const line of wrappedLines) {
    const padding = " ".repeat(Math.max(0, width - visibleLength(line)));
    console.log(color("│ ") + line + padding + color(" │"));
  }
  console.log(color(`└${"─".repeat(width + 2)}┘`));
}

/**
 * Print content in a styled box
 */
export function box(title: string, content: string): void {
  boxLines(title, content.split("\n"));
}

/**
 * Print conversation history in a readable format
 */
export function conversationHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): void {
  for (const line of formatConversationHistory(history)) {
    console.log(line);
  }
}

export function formatConversationHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): string[] {
  return history.map((msg) => {
    const roleColor = msg.role === "user" ? chalk.green : chalk.blue;
    const roleLabel = msg.role === "user" ? "User" : "AI";
    return `${roleColor(`${roleLabel}:`)} ${msg.content}`;
  });
}

/**
 * Print worker results
 */
export function workerResults(
  results: Array<{
    workerId: string;
    model?: string;
    answer: string;
    confidence?: number;
    error?: string;
  }>
): void {
  for (const line of formatWorkerResults(results)) {
    console.log(`  ${line}`);
  }
}

export function formatWorkerResults(
  results: Array<{
    workerId: string;
    model?: string;
    answer: string;
    confidence?: number;
    error?: string;
  }>
): string[] {
  return results.map((r) => {
    if (r.error) {
      return chalk.red(`${r.workerId}: [ERROR] ${r.error}`);
    }
    const confidence = r.confidence ? chalk.gray(` (${(r.confidence * 100).toFixed(0)}%)`) : "";
    const model = r.model ? chalk.gray(` [${r.model}]`) : "";
    return `${chalk.yellow(r.workerId)}${model}: "${r.answer}"${confidence}`;
  });
}

/**
 * Print stats summary
 */
export function stats(data: {
  timeMs: number;
  tokens?: number;
  cost?: number;
  workersSucceeded?: number;
  workersFailed?: number;
}): void {
  const parts: string[] = [];

  parts.push(chalk.cyan(`${data.timeMs}ms`));

  if (data.tokens !== undefined) {
    parts.push(chalk.yellow(`${data.tokens} tokens`));
  }

  if (data.cost !== undefined) {
    parts.push(chalk.green(`$${data.cost.toFixed(4)}`));
  }

  if (data.workersSucceeded !== undefined) {
    const failed = data.workersFailed || 0;
    const total = data.workersSucceeded + failed;
    const color = failed > 0 ? chalk.yellow : chalk.green;
    parts.push(color(`${data.workersSucceeded}/${total} workers`));
  }

  console.log(`\n${chalk.bold("Stats:")} ${parts.join(" | ")}\n`);
}

// ============================================================================
// Interactive Prompts
// ============================================================================

/**
 * Prompt user to select from a list
 */
export async function selectPrompt<T = string>(
  message: string,
  choices: SelectChoice<T>[]
): Promise<T> {
  return select({
    message,
    choices: choices.map((c) => ({
      name: c.name,
      value: c.value,
      description: c.description,
    })),
  });
}

/**
 * Prompt user for confirmation
 */
export async function confirmPrompt(message: string, defaultValue = true): Promise<boolean> {
  return confirm({ message, default: defaultValue });
}

/**
 * Prompt user for text input
 */
export async function inputPrompt(message: string, defaultValue?: string): Promise<string> {
  return input({ message, default: defaultValue });
}

// ============================================================================
// Export UI namespace for convenience
// ============================================================================

export const ui = {
  header,
  success,
  error,
  info,
  warn,
  label,
  divider,
  box,
  boxLines,
  getBoxWidth,
  conversationHistory,
  formatConversationHistory,
  workerResults,
  formatWorkerResults,
  stats,
  select: selectPrompt,
  confirm: confirmPrompt,
  input: inputPrompt,
};
