/**
 * Agent Chat Input
 *
 * Text input with send button.
 * Adapted from Journey Builder's chat-input pattern.
 *
 * @module features/workflows/components/test-panel/agent-chat-input
 */

import { ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

// =============================================================================
// TYPES
// =============================================================================

interface AgentChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AgentChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  isProcessing,
}: AgentChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit();
      }
    }
  };

  const getPlaceholder = () => {
    if (isProcessing) return "Processing...";
    if (disabled) return "Disabled";
    return "Type a message...";
  };

  return (
    <div className="px-3 py-2 border-t bg-background shrink-0" data-testid="agent-chat-input">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={disabled}
          className="flex-1"
          data-testid="test-message-input"
        />
        <Button
          size="icon"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          data-testid="test-send-button"
        >
          {isProcessing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
