/**
 * Chat Bubble
 *
 * Individual message bubble component with support for text, media, buttons.
 *
 * @module features/simulator/components/chat/chat-bubble
 */

import { Bot, MousePointerClick, User } from "lucide-react";

import { QuickReplyButtons } from "@/shared/components/chat";
import { MarkdownContent } from "@/shared/components/ui/markdown-content";
import { cn } from "@/shared/lib/utils";
import { telegramToMarkdown } from "../../lib/telegram-markdown";
import type { ChatBubbleProps } from "./types";

/** Format timestamp for display */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ChatBubble({ content, buttons, media, timestamp, isBot, isAction, onButtonClick }: ChatBubbleProps) {
  return (
    <div className={cn("flex gap-2 px-3 py-1", isBot ? "justify-start" : "justify-end")}>
      {/* Bot avatar */}
      {isBot && (
        <div className="shrink-0 size-3 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <Bot className="size-3.5 text-muted-foreground" />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[85%]", isBot ? "items-start" : "items-end")}>
        {/* Media (image or video) */}
        {media && (
          <div className={cn("rounded-xs overflow-hidden mb-1", isBot ? "rounded-tl-sm" : "rounded-tr-sm")}>
            {media.type === "image" ? (
              <img src={media.url} alt="Media attachment" className="max-w-full max-h-64 object-contain bg-muted" loading="lazy" />
            ) : (
              <video src={media.url} controls preload="metadata" className="max-w-full max-h-64 bg-muted" />
            )}
          </div>
        )}

        {/* Message bubble - different styles for action vs regular messages */}
        {content && (
          <div
            className={cn(
              "rounded-xs px-3 py-2 text-xs",
              isBot ? "bg-muted/60 text-foreground rounded-tl-sm" : isAction ? "py-1.5 px-0" : "bg-primary text-primary-foreground rounded-tr-sm"
            )}
          >
            {isAction ? (
              // Button click: icon + styled button (like Simulator mode)
              <span className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium border border-border bg-background px-3 py-1 rounded-full">{content}</span>
              </span>
            ) : (
              <div className="[&>div:not(:first-child)]:mt-[1em]">
                <MarkdownContent
                  content={telegramToMarkdown(content)}
                  className={cn("[&_p]:my-0 [&_p]:leading-relaxed", !isBot && "[&_p]:text-primary-foreground [&_a]:text-primary-foreground")}
                />
              </div>
            )}
          </div>
        )}

        {/* Quick Reply Buttons (bot only) - Telegram style */}
        {isBot && buttons && buttons.length > 0 && <QuickReplyButtons buttons={buttons} onButtonClick={onButtonClick} />}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground/60 mt-0.5 px-1">{formatTime(timestamp)}</span>
      </div>

      {/* User avatar */}
      {!isBot && (
        <div className="shrink-0 size-3 rounded-full bg-muted/60 flex items-center justify-center mt-0.5">
          <User className="size-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
