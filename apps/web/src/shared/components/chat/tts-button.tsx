/**
 * TTS Button
 *
 * Toggle button for text-to-speech on chat messages.
 *
 * @module components/chat/tts-button
 */

import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface TTSButtonProps {
  /** Whether TTS is currently playing */
  isPlaying: boolean;
  /** Whether TTS is loading/generating */
  isLoading?: boolean;
  /** Whether TTS is enabled */
  enabled: boolean;
  /** Called when clicked */
  onClick: () => void;
  /** Additional className */
  className?: string;
}

export function TTSButton({
  isPlaying,
  isLoading = false,
  enabled,
  onClick,
  className,
}: TTSButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-full transition-all duration-200",
        "size-7",
        // Default state
        enabled && !isPlaying && "bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground",
        // Playing state
        isPlaying && "bg-primary text-primary-foreground",
        // Disabled state
        !enabled && "bg-muted/50 text-muted-foreground/50",
        className
      )}
      title={enabled ? (isPlaying ? "Stop speaking" : "Speak response") : "TTS disabled"}
    >
      {isLoading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : isPlaying ? (
        <VolumeX className="size-3.5" />
      ) : (
        <Volume2 className="size-3.5" />
      )}
    </button>
  );
}
