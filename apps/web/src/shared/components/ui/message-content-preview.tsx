/**
 * MessageContentPreview Component
 *
 * Renders message content with Telegram HTML/markdown conversion.
 * Supports line clamping for compact node previews.
 *
 * @module shared/components/ui/message-content-preview
 */

import { cn } from "@/shared/lib/utils";
import { telegramToMarkdown } from "@/features/journey/simulator/lib/telegram-markdown";
import { MarkdownContent } from "./markdown-content";

interface MessageContentPreviewProps {
  content: string;
  className?: string;
  /** Number of lines to clamp (e.g., 2 for node preview) */
  lineClamp?: number;
  /** Use compact styling for node previews */
  compact?: boolean;
}

/**
 * Render message content with proper formatting
 * Converts Telegram HTML tags and markdown to rendered output
 */
export function MessageContentPreview({ content, className, lineClamp, compact = false }: MessageContentPreviewProps) {
  if (!content) return null;

  // Convert Telegram formatting to standard markdown
  const markdown = telegramToMarkdown(content);

  return (
    <div
      className={cn(
        // Base styles
        compact && "text-[13px] text-muted-foreground leading-relaxed",
        // Line clamping if specified
        lineClamp && `line-clamp-${lineClamp}`,
        // Compact node preview styles
        compact && "[&_p]:my-0 [&_p]:leading-relaxed [&_*]:text-[13px]",
        // Override markdown spacing for compact mode
        compact && "[&_ul]:my-1 [&_ol]:my-1 [&_li]:mt-0.5",
        // For non-compact mode, add spacing between paragraph blocks (visible empty lines)
        // Each paragraph block is wrapped in a div by MemoizedMarkdownBlock
        !compact && "[&>div:not(:first-child)]:mt-[1.5em]",
        className
      )}
    >
      <MarkdownContent
        content={markdown}
        className={cn(
          "[&_p]:leading-relaxed",
          compact && "[&_p]:my-0 [&_p]:text-muted-foreground"
        )}
      />
    </div>
  );
}
