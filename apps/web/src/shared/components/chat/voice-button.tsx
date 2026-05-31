/**
 * Voice Button
 *
 * Push-to-talk button with visual feedback for audio level and recording state.
 *
 * @module components/chat/voice-button
 */

import { forwardRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface VoiceButtonProps {
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether currently transcribing */
  isTranscribing: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Called when user clicks to start recording */
  onStartRecording: () => void;
  /** Called when user clicks to stop recording */
  onStopRecording: () => void;
  /** Additional className */
  className?: string;
}

export const VoiceButton = forwardRef<HTMLButtonElement, VoiceButtonProps>(function VoiceButton(
  {
    isRecording,
    isTranscribing,
    disabled = false,
    error,
    onStartRecording,
    onStopRecording,
    className,
  },
  ref
) {
  const handleClick = () => {
    if (disabled || isTranscribing) return;

    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <div className="relative flex items-center">
      {/* Main button */}
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-200",
          "size-7",
          // Default state
          !isRecording &&
            !isTranscribing &&
            "bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground",
          // Recording state
          isRecording && "bg-sky-500 text-white",
          // Transcribing state
          isTranscribing && "bg-muted text-muted-foreground cursor-wait",
          // Disabled state
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {isTranscribing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : error ? (
          <MicOff className="size-3.5 text-destructive" />
        ) : (
          <Mic className="size-3.5" />
        )}
      </button>

      {/* Error message */}
      {error && !isRecording && !isTranscribing && (
        <div className="absolute -bottom-4 right-0 text-[9px] text-destructive whitespace-nowrap">
          {error.includes("denied") ? "Mic denied" : "Error"}
        </div>
      )}
    </div>
  );
});
