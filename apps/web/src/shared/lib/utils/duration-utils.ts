/**
 * Duration Utilities
 *
 * Shared time conversion functions for node editor forms.
 * Handles conversion between total seconds and days/hours/minutes/seconds.
 */

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Convert total seconds to days, hours, minutes, seconds
 */
export function secondsToDHMS(totalSeconds: number): DurationParts {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

/**
 * Convert days, hours, minutes, seconds to total seconds
 */
export function dhmsToSeconds(
  days: number = 0,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0
): number {
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

