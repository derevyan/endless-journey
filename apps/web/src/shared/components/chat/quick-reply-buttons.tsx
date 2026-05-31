/**
 * Quick Reply Buttons
 *
 * Telegram-style vertical full-width quick reply buttons for chat interfaces.
 * Shared across Journey Simulator, Agent Workflows, and Impersonate Chat.
 *
 * @module shared/components/chat/quick-reply-buttons
 */

import { memo } from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface QuickReplyButtonsProps {
  /** Array of button options to display */
  buttons: Array<{ id: string; label: string }> | undefined;
  /** Callback fired when user clicks a button - receives button.id */
  onButtonClick: (buttonId: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disable all buttons */
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * QuickReplyButtons - Telegram-style vertical quick reply buttons
 *
 * Features:
 * - Full-width vertical stacked buttons
 * - Rounded-lg borders (Telegram style)
 * - Consistent h-9 height with text-sm
 * - Uses button.id for callback (robust for tracking)
 */
export const QuickReplyButtons = memo(function QuickReplyButtons({
  buttons,
  onButtonClick,
  className,
  disabled,
}: QuickReplyButtonsProps) {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1 mt-1.5 w-full", className)}>
      {buttons.map((button) => (
        <Button
          key={button.id}
          variant="outline"
          disabled={disabled}
          onClick={() => onButtonClick(button.id)}
          className="h-9 w-full justify-center text-sm font-normal rounded-lg bg-background/80 hover:bg-muted border-border/50"
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
});
