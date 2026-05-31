/**
 * AutoResizeTextarea Component
 *
 * A textarea that automatically adjusts its height based on content.
 * Also allows manual vertical resizing.
 *
 * @example
 * <AutoResizeTextarea
 *   value={content}
 *   onChange={(e) => setContent(e.target.value)}
 *   placeholder="Type here..."
 *   minRows={2}
 *   maxRows={10}
 * />
 */

import * as React from "react";
import { useLayoutEffect, useRef, useCallback } from "react";

import { cn } from "@/shared/lib/utils";

interface AutoResizeTextareaProps extends Omit<React.ComponentProps<"textarea">, "rows"> {
  /** Minimum number of visible rows (default: 2) */
  minRows?: number;
  /** Maximum number of visible rows before scrolling (default: unlimited) */
  maxRows?: number;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, minRows = 2, maxRows, onChange, value, ...props }, forwardedRef) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    // Combine refs
    const textareaRef = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const adjustHeight = useCallback(() => {
      const textarea = typeof textareaRef === "object" ? textareaRef.current : null;
      if (!textarea) return;

      // Get line height from computed styles
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseInt(computedStyle.lineHeight) || 20;
      const paddingTop = parseInt(computedStyle.paddingTop) || 0;
      const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
      const borderTop = parseInt(computedStyle.borderTopWidth) || 0;
      const borderBottom = parseInt(computedStyle.borderBottomWidth) || 0;

      // Calculate min and max heights
      const minHeight = lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom;
      const maxHeight = maxRows ? lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom : Infinity;

      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = "auto";

      // Calculate new height clamped between min and max
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;

      // Add overflow scroll if content exceeds maxRows
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [textareaRef, minRows, maxRows]);

    // Adjust height on value change
    useLayoutEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Adjust height on mount and window resize
    useLayoutEffect(() => {
      adjustHeight();
      window.addEventListener("resize", adjustHeight);
      return () => window.removeEventListener("resize", adjustHeight);
    }, [adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      // Defer height adjustment to next frame to ensure value is updated
      requestAnimationFrame(adjustHeight);
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        className={cn(
          "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y",
          className
        )}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";

export { AutoResizeTextarea };
