/**
 * Agent Chat Bubble
 *
 * Message bubble with optional execution trace.
 * Adapted from Journey Builder's chat-bubble pattern.
 *
 * @module features/workflows/components/test-panel/agent-chat-bubble
 */

import { useState } from "react";
import { Bot, User, ChevronDown, CheckCircle, XCircle, AlertCircle } from "lucide-react";

import { QuickReplyButtons } from "@/shared/components/chat";
import { MarkdownContent } from "@/shared/components/ui/markdown-content";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface AgentChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Quick-reply buttons to render (assistant messages only) */
  buttons?: Array<{ id: string; label: string }>;
  /** Callback when user clicks a quick-reply button - receives button.id */
  onButtonClick?: (buttonId: string) => void;
  trace?: {
    status: "completed" | "blocked" | "error";
    durationMs: number;
    path: string[];
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AgentChatBubble({ role, content, timestamp, buttons, onButtonClick, trace }: AgentChatBubbleProps) {
  const [showTrace, setShowTrace] = useState(false);
  const isBot = role === "assistant";

  const getStatusIcon = () => {
    if (!trace) return null;
    switch (trace.status) {
      case "completed":
        return <CheckCircle className="size-3 text-green-500" />;
      case "blocked":
        return <AlertCircle className="size-3 text-amber-500" />;
      case "error":
        return <XCircle className="size-3 text-red-500" />;
    }
  };

  return (
    <div
      className={cn("flex gap-2 px-3 py-1", isBot ? "justify-start" : "justify-end")}
      data-testid={isBot ? "agent-response" : "user-message"}
    >
      {/* Bot Avatar */}
      {isBot && (
        <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Bot className="size-3" />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[85%]", isBot ? "items-start" : "items-end")}>
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isBot
              ? "bg-muted/60 rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          )}
        >
          <MarkdownContent content={content} />
        </div>

        {/* Quick Reply Buttons - Telegram style (assistant only) */}
        {isBot && buttons && buttons.length > 0 && onButtonClick && (
          <QuickReplyButtons buttons={buttons} onButtonClick={onButtonClick} />
        )}

        {/* Execution trace (bot only) */}
        {isBot && trace && (
          <button
            onClick={() => setShowTrace(!showTrace)}
            className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            data-testid="execution-trace"
          >
            {getStatusIcon()}
            <ChevronDown
              className={cn("size-3 transition-transform", showTrace && "rotate-180")}
            />
            <span>
              {trace.path.join(" → ")} ({trace.durationMs}ms)
            </span>
          </button>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground/60 mt-0.5">
          {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* User Avatar */}
      {!isBot && (
        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="size-3" />
        </div>
      )}
    </div>
  );
}
