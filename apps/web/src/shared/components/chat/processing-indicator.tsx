/**
 * Processing Indicator
 *
 * Animated indicator shown while the AI is thinking/processing.
 * Used in both journey simulator and agent workflow test panels.
 *
 * @module components/chat/processing-indicator
 */

import { Bot, RefreshCw } from "lucide-react";

interface ProcessingIndicatorProps {
  /** Optional status message to display instead of bouncing dots */
  status?: string;
  /** Visual variant - "dots" for bouncing dots, "spinner" for rotating icon */
  variant?: "dots" | "spinner";
}

/**
 * Processing indicator with animated bouncing dots or spinner.
 * Shows a bot icon and animation to indicate AI is thinking.
 *
 * @example
 * // Default bouncing dots
 * <ProcessingIndicator />
 *
 * @example
 * // With status message
 * <ProcessingIndicator status="Analyzing message..." variant="spinner" />
 */
export function ProcessingIndicator({ status, variant = "dots" }: ProcessingIndicatorProps) {
  // Spinner variant with status text
  if (variant === "spinner" || status) {
    return (
      <div className="flex justify-start animate-pulse" data-testid="processing-indicator">
        <div className="bg-muted/20 border border-border/20 p-4 rounded-2xl rounded-tl-sm flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm text-primary font-mono">{status || "Processing..."}</span>
        </div>
      </div>
    );
  }

  // Default bouncing dots variant
  return (
    <div className="flex items-center gap-2 px-3 py-2" data-testid="processing-indicator">
      <div className="shrink-0 size-6 rounded-full bg-muted flex items-center justify-center">
        <Bot className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex gap-1.5 items-center px-3 py-2 rounded-2xl rounded-tl-sm bg-muted/60">
        <span className="size-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
        <span className="size-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.15s]" />
        <span className="size-2 rounded-full bg-foreground/40 animate-bounce" />
      </div>
    </div>
  );
}
