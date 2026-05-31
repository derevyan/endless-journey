/**
 * Playback Controls Component
 *
 * Compact media player-style controls for session replay.
 * Includes play/pause, step forward/back, and seek bar.
 *
 * @module features/simulator/components/controls/playback-controls
 */

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect } from "react";

import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { useSimulatorPlayback } from "../../hooks/simulator-selectors";
import { simulatorActions } from "../../store";

interface PlaybackControlsProps {
  className?: string;
}

export function PlaybackControls({ className }: PlaybackControlsProps) {
  // Use granular selector for playback state and actions
  const { playback, isPlaying, playbackIndex } = useSimulatorPlayback();
  const totalInteractions = playback?.totalInteractions ?? 0;

  const isAtStart = playbackIndex === 0;
  const isAtEnd = playbackIndex >= totalInteractions - 1;

  const handlePlayPause = useCallback(() => {
    if (isAtEnd && !isPlaying) {
      simulatorActions.setPlaybackIndex(0);
      simulatorActions.setIsPlaying(true);
    } else {
      simulatorActions.togglePlayback();
    }
  }, [isAtEnd, isPlaying]);

  const handlePrevious = useCallback(() => {
    simulatorActions.playbackPrevious();
  }, []);

  const handleNext = useCallback(() => {
    simulatorActions.playbackNext();
  }, []);

  const handleSeek = useCallback((value: number) => {
    simulatorActions.setPlaybackIndex(value);
  }, []);

  const handleReset = useCallback(() => {
    simulatorActions.setPlaybackIndex(0);
    simulatorActions.setIsPlaying(false);
  }, []);

  // Keyboard shortcuts for playback control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case " ": // Space - toggle play/pause
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft": // Left arrow - previous
          e.preventDefault();
          handlePrevious();
          break;
        case "ArrowRight": // Right arrow - next
          e.preventDefault();
          handleNext();
          break;
        case "Home": // Home - jump to start
          e.preventDefault();
          handleReset();
          break;
        case "End": // End - jump to end
          e.preventDefault();
          simulatorActions.setPlaybackIndex(totalInteractions - 1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handlePrevious, handleNext, handleReset, totalInteractions]);

  if (totalInteractions === 0) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">No interactions</div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center gap-1 px-2 py-1", className)}>
        {/* Reset */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={handleReset} disabled={isAtStart && !isPlaying} className="size-6">
              <RotateCcw className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset (Home)</TooltipContent>
        </Tooltip>

        {/* Previous */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={handlePrevious} disabled={isAtStart} className="size-6">
              <ChevronLeft className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous (←)</TooltipContent>
        </Tooltip>

        {/* Play/Pause */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="icon-sm" onClick={handlePlayPause} className="size-6">
              {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isPlaying ? "Pause" : "Play"} (Space)</TooltipContent>
        </Tooltip>

        {/* Next */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={handleNext} disabled={isAtEnd} className="size-6">
              <ChevronRight className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next (→)</TooltipContent>
        </Tooltip>

        {/* Seek slider */}
        <input
          type="range"
          value={playbackIndex}
          min={0}
          max={Math.max(0, totalInteractions - 1)}
          step={1}
          onChange={(e) => handleSeek(parseInt(e.target.value, 10))}
          className={cn(
            "flex-1 h-1 mx-1 cursor-pointer appearance-none rounded-full bg-muted",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground/50",
            "[&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground/50 [&::-moz-range-thumb]:border-0"
          )}
        />

        {/* Position */}
        <span className="text-[10px] tabular-nums text-muted-foreground min-w-[36px] text-right">
          {playbackIndex + 1}/{totalInteractions}
        </span>
      </div>
    </TooltipProvider>
  );
}
