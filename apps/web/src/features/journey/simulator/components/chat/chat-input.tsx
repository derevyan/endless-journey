/**
 * Chat Input
 *
 * Text input field with send button for user messages.
 *
 * @module features/simulator/components/chat/chat-input
 */

import { ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import type { ChatInputProps } from "./types";

export function ChatInput({ value, onChange, onSubmit, disabled, isProcessing, isCompleted }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const placeholder = disabled ? (isCompleted ? "Test completed" : "Processing...") : "Type a message...";

  return (
    <div className="px-3 py-2 bg-background shrink-0">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
        />
        <Button onClick={onSubmit} disabled={disabled || !value.trim()} size="icon" className="size-9 shrink-0">
          {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </div>
  );
}
