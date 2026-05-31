/**
 * Wait/Timer Logic
 *
 * Utilities for working with wait nodes and timers.
 */

import { secondsToDHMS } from "@/shared/lib/utils/duration-utils";

/**
 * Format seconds as a human-readable duration string
 */
export function formatDuration(seconds: number): string {
  const { days, hours, minutes, seconds: secs } = secondsToDHMS(seconds);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Format seconds as a verbose duration string
 */
export function formatDurationVerbose(seconds: number): string {
  const { days, hours, minutes, seconds: secs } = secondsToDHMS(seconds);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (secs > 0 || parts.length === 0)
    parts.push(`${secs} second${secs !== 1 ? "s" : ""}`);

  return parts.join(", ");
}

/**
 * Parse a duration string into seconds
 * Supports formats like: "1d", "2h", "30m", "60s", "1d 2h 30m"
 */
export function parseDuration(durationStr: string): number {
  let totalSeconds = 0;

  // Match patterns like "1d", "2h", "30m", "60s"
  const pattern = /(\d+)\s*(d|h|m|s)/gi;
  let match;

  while ((match = pattern.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case "d":
        totalSeconds += value * 86400;
        break;
      case "h":
        totalSeconds += value * 3600;
        break;
      case "m":
        totalSeconds += value * 60;
        break;
      case "s":
        totalSeconds += value;
        break;
    }
  }

  // If no pattern matched, try to parse as plain number (seconds)
  if (totalSeconds === 0) {
    const parsed = parseInt(durationStr, 10);
    if (!isNaN(parsed)) {
      totalSeconds = parsed;
    }
  }

  return totalSeconds;
}

/**
 * Calculate when a timer will trigger
 */
export function calculateTriggerTime(
  startTime: Date,
  durationSeconds: number
): Date {
  return new Date(startTime.getTime() + durationSeconds * 1000);
}

/**
 * Check if a timer has expired
 */
export function isTimerExpired(
  startTime: Date,
  durationSeconds: number,
  currentTime: Date = new Date()
): boolean {
  const triggerTime = calculateTriggerTime(startTime, durationSeconds);
  return currentTime >= triggerTime;
}

/**
 * Get remaining time until timer triggers
 */
export function getRemainingTime(
  startTime: Date,
  durationSeconds: number,
  currentTime: Date = new Date()
): number {
  const triggerTime = calculateTriggerTime(startTime, durationSeconds);
  const remaining = Math.max(
    0,
    Math.floor((triggerTime.getTime() - currentTime.getTime()) / 1000)
  );
  return remaining;
}

/**
 * Common duration presets in seconds
 */
export const DURATION_PRESETS = {
  "1 minute": 60,
  "5 minutes": 300,
  "15 minutes": 900,
  "30 minutes": 1800,
  "1 hour": 3600,
  "2 hours": 7200,
  "6 hours": 21600,
  "12 hours": 43200,
  "1 day": 86400,
  "2 days": 172800,
  "1 week": 604800,
} as const;
