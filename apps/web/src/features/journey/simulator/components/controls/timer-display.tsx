/**
 * Timer Display
 *
 * Shows active timer countdown with skip button.
 *
 * @module features/simulator/components/controls/timer-display
 */

import { SkipForward, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { secondsToDHMS } from "@/shared/lib/utils/duration-utils";

interface TimerDisplayProps {
  timerId: string;
  durationMs: number;
  onSkip: () => void;
}

export function TimerDisplay({ timerId, durationMs, onSkip }: TimerDisplayProps) {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const startTimeRef = useRef(Date.now());

  // Reset start time when timer changes
  useEffect(() => {
    startTimeRef.current = Date.now();
    setRemainingMs(durationMs);
  }, [timerId, durationMs]);

  // Single interval that calculates remaining time from start
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, durationMs - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerId, durationMs]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const { hours, minutes, seconds } = secondsToDHMS(totalSeconds);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 mx-3 my-2 px-4 py-3">
      <div className="flex items-center justify-center">
        <Timer className="w-5 h-5 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="tabular-nums text-foreground">{formatTime(remainingMs)}</p>
      </div>
      <Button onClick={onSkip} variant="outline" size="sm">
        <SkipForward className="w-4 h-4 mr-1.5 text-orange-400" />
        Skip Timer
      </Button>
    </div>
  );
}
