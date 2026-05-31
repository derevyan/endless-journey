/**
 * useDurationField Hook
 *
 * Manages DHMS (Days/Hours/Minutes/Seconds) duration fields in TanStack forms.
 * Reduces ~60 lines of boilerplate to ~5 lines per duration field set.
 *
 * @module shared/hooks/use-duration-field
 */

import { useStore } from "@tanstack/react-store";
import type { Store } from "@tanstack/react-store";

/**
 * Minimal form interface for duration field management.
 * Compatible with TanStack Form's useForm return type.
 */
interface FormWithStore {
  store: Store<{ values: Record<string, unknown> }>;
  setFieldValue: (name: string, value: unknown) => void;
}

/**
 * Duration field state returned by the hook
 */
export interface DurationFieldState {
  /** Current days value */
  days: number | undefined;
  /** Current hours value */
  hours: number | undefined;
  /** Current minutes value */
  minutes: number | undefined;
  /** Current seconds value */
  seconds: number | undefined;
  /** Calculated total seconds from all fields */
  totalSeconds: number;
  /** Set days value */
  setDays: (value: number | undefined) => void;
  /** Set hours value */
  setHours: (value: number | undefined) => void;
  /** Set minutes value */
  setMinutes: (value: number | undefined) => void;
  /** Set seconds value */
  setSeconds: (value: number | undefined) => void;
  /** Set all fields from a total seconds value */
  setFromSeconds: (totalSeconds: number) => void;
  /** Clear all duration fields */
  clear: () => void;
  /** Check if any duration is set */
  hasValue: boolean;
}

/**
 * Hook for managing DHMS (Days/Hours/Minutes/Seconds) duration fields.
 *
 * Provides reactive state and actions for duration input, reducing boilerplate
 * from ~60 lines to ~5 lines per duration field set.
 *
 * @param form - TanStack Form instance (from useForm or useNodeEditorForm)
 * @param prefix - Field name prefix (e.g., "timer" creates timerDays, timerHours, etc.)
 * @returns Duration field state and actions
 *
 * @example
 * ```tsx
 * // In a node editor component
 * const timer = useDurationField(form, "timer");
 *
 * // Access reactive values
 * console.log(timer.totalSeconds); // 3661 (1 hour, 1 minute, 1 second)
 *
 * // Set from total seconds
 * timer.setFromSeconds(7200); // Sets to 2 hours
 *
 * // Clear all fields
 * timer.clear();
 *
 * // Check if any value is set
 * if (timer.hasValue) { ... }
 * ```
 */
export function useDurationField(form: FormWithStore, prefix: string): DurationFieldState {
  // Subscribe to form store for reactive updates
  const days = useStore(form.store, (state) => state.values[`${prefix}Days`] as number | undefined);
  const hours = useStore(form.store, (state) => state.values[`${prefix}Hours`] as number | undefined);
  const minutes = useStore(form.store, (state) => state.values[`${prefix}Minutes`] as number | undefined);
  const seconds = useStore(form.store, (state) => state.values[`${prefix}Seconds`] as number | undefined);

  // Calculate total seconds
  const totalSeconds = (days ?? 0) * 86400 + (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);

  // Check if any value is set
  const hasValue = totalSeconds > 0;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    hasValue,

    setDays: (value) => form.setFieldValue(`${prefix}Days`, value),
    setHours: (value) => form.setFieldValue(`${prefix}Hours`, value),
    setMinutes: (value) => form.setFieldValue(`${prefix}Minutes`, value),
    setSeconds: (value) => form.setFieldValue(`${prefix}Seconds`, value),

    setFromSeconds: (total) => {
      const d = Math.floor(total / 86400);
      const h = Math.floor((total % 86400) / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;

      // Only set values if > 0, otherwise undefined (empty field)
      form.setFieldValue(`${prefix}Days`, d > 0 ? d : undefined);
      form.setFieldValue(`${prefix}Hours`, h > 0 ? h : undefined);
      form.setFieldValue(`${prefix}Minutes`, m > 0 ? m : undefined);
      form.setFieldValue(`${prefix}Seconds`, s > 0 ? s : undefined);
    },

    clear: () => {
      form.setFieldValue(`${prefix}Days`, undefined);
      form.setFieldValue(`${prefix}Hours`, undefined);
      form.setFieldValue(`${prefix}Minutes`, undefined);
      form.setFieldValue(`${prefix}Seconds`, undefined);
    },
  };
}
