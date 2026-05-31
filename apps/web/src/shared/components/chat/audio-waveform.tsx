/**
 * Audio Waveform
 *
 * Visual representation of audio recording, showing animated bars.
 * Uses CSS animations for reliable animation without audio level dependency.
 *
 * @module components/chat/audio-waveform
 */

import { cn } from "@/shared/lib/utils";

export interface AudioWaveformProps {
  /** Audio level (0-1) - used to boost animation when speaking loudly */
  level?: number;
  /** Number of bars to display */
  bars?: number;
  /** Height of the waveform container */
  height?: number;
  /** Color variant */
  variant?: "default" | "recording" | "playing" | "sky";
  /** Additional className */
  className?: string;
}

export function AudioWaveform({
  level = 0.5,
  bars = 5,
  height = 24,
  variant = "default",
  className,
}: AudioWaveformProps) {
  const colorClass = {
    default: "bg-muted-foreground/50",
    recording: "bg-rose-500",
    playing: "bg-primary",
    sky: "bg-sky-500",
  }[variant];

  // Animation delays for wave effect
  const delays = ["0ms", "150ms", "300ms", "150ms", "0ms", "200ms", "100ms"];

  return (
    <div
      className={cn("flex items-center justify-center gap-0.5", className)}
      style={{ height }}
    >
      {Array.from({ length: bars }, (_, index) => {
        // Create wave pattern - center bars are taller
        const centerIndex = (bars - 1) / 2;
        const distanceFromCenter = Math.abs(index - centerIndex) / (centerIndex || 1);
        const maxScale = 0.6 + (1 - distanceFromCenter) * 0.4;

        // Boost animation based on audio level
        const levelBoost = 1 + level * 0.5;

        return (
          <div
            key={index}
            className={cn("w-1 rounded-full", colorClass)}
            style={{
              height: `${height * maxScale * levelBoost}px`,
              animation: `waveform-pulse 0.6s ease-in-out infinite`,
              animationDelay: delays[index % delays.length],
              transformOrigin: "center",
            }}
          />
        );
      })}
      <style>{`
        @keyframes waveform-pulse {
          0%, 100% {
            transform: scaleY(0.4);
          }
          50% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Compact waveform indicator (for inline use)
 */
export function AudioWaveformCompact({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  if (!isActive) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-0.5 bg-rose-500 rounded-full"
          style={{
            height: "12px",
            animation: `waveform-pulse 0.5s ease-in-out infinite`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes waveform-pulse {
          0%, 100% {
            transform: scaleY(0.3);
          }
          50% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
