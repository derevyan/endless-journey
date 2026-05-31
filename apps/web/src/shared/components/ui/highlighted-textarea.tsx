/**
 * HighlightedTextarea Component
 *
 * A textarea with syntax highlighting for template variables using overlay approach.
 * Renders a div with highlighted content behind a transparent textarea.
 *
 * Uses a variant-based API for reliable text alignment:
 * - "default": text-sm (standard size)
 * - "compact": text-xs, font-mono (for code-like editors)
 *
 * @module components/ui/highlighted-textarea
 */

import { forwardRef, useCallback, useRef, useState } from "react";

import { highlightVariables } from "@/shared/lib/template";
import { cn } from "@/shared/lib/utils";

/**
 * Pre-tested variant configurations.
 * Each variant defines synchronized styles for textarea and backdrop.
 */
const variants = {
  default: {
    textarea: "px-3 py-2 text-sm",
    backdrop: "px-3 py-2 text-sm",
  },
  compact: {
    textarea: "px-3 py-2 text-xs font-mono",
    backdrop: "px-3 py-2 text-xs font-mono",
  },
} as const;

type HighlightedTextareaVariant = keyof typeof variants;

interface HighlightedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  /** Size variant - controls font-size and padding */
  variant?: HighlightedTextareaVariant;
  /** Additional CSS classes for the textarea (non-structural styles) */
  className?: string;
  /** CSS class for highlighted variables */
  highlightClass?: string;
  /** When true, hides the highlighted backdrop (useful for read-only/preview overlays) */
  hideBackdrop?: boolean;
  /** Class for the wrapper container (use for sizing/layout) */
  wrapperClassName?: string;
  /** Callback when mouse enters/leaves a variable - receives (variablePath, x, y) or (null, 0, 0) */
  onVariableHover?: (variablePath: string | null, x: number, y: number) => void;
  /** Show error styling (red border) */
  hasError?: boolean;
}

/**
 * HighlightedTextarea with syntax highlighting for {{variables}}
 *
 * Uses overlay approach:
 * - Background div renders highlighted content (visible text)
 * - Transparent textarea overlays for editing (invisible text, visible caret)
 * - Scroll positions are synced via transform
 *
 * @example
 * ```tsx
 * // Default size
 * <HighlightedTextarea value={value} onChange={onChange} />
 *
 * // Compact size for code-like editors
 * <HighlightedTextarea variant="compact" value={value} onChange={onChange} />
 * ```
 */
export const HighlightedTextarea = forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
  ({ variant = "default", className, wrapperClassName, highlightClass = "text-primary", hideBackdrop = false, onVariableHover, hasError, value, onChange, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Get styles for the selected variant
    const styles = variants[variant];

    // Use forwarded ref or internal ref
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    // Sync scroll position from textarea to backdrop
    const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);
      setScrollLeft(target.scrollLeft);
    }, []);

    // Detect hover by checking bounding rectangles of variable spans
    // (elementsFromPoint doesn't work for pointer-events: none elements)
    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onVariableHover) return;

        // Query all variable spans in this component
        const wrapper = e.currentTarget;
        const variableSpans = wrapper.querySelectorAll<HTMLSpanElement>("[data-variable-path]");

        // Check if mouse is within any span's bounding rect
        for (const span of variableSpans) {
          const rect = span.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const path = span.getAttribute("data-variable-path");
            onVariableHover(path, e.clientX, e.clientY);
            return;
          }
        }

        // Not hovering over any variable
        onVariableHover(null, 0, 0);
      },
      [onVariableHover]
    );

    const handleMouseLeave = useCallback(() => {
      onVariableHover?.(null, 0, 0);
    }, [onVariableHover]);

    const textValue = typeof value === "string" ? value : "";

    return (
      <div className={cn("relative", wrapperClassName)} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        {/* Backdrop with highlighted content - this shows the visible text */}
        {!hideBackdrop && (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent"
            aria-hidden="true"
          >
            <div
              className={cn(styles.backdrop, "whitespace-pre-wrap break-words text-foreground")}
              style={{
                // Use transform for scroll sync (reliable, no negative values)
                transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`,
              }}
            >
              {highlightVariables(textValue, highlightClass, { trailingNewline: true, emptyPlaceholder: "\u00A0" })}
            </div>
          </div>
        )}

        {/* Actual textarea (transparent text, visible caret) */}
        <textarea
          ref={textareaRef}
          className={cn(
            // Variant-specific styles (padding, font)
            styles.textarea,
            // Base textarea styles
            "w-full rounded-md border border-input bg-transparent shadow-xs",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Make text transparent but keep caret visible
            "text-transparent caret-foreground",
            // Selection should be visible
            "selection:bg-primary/30 selection:text-transparent",
            // Disable native resize by default (container should handle sizing)
            "resize-none",
            // Error state
            hasError && "border-destructive focus-visible:ring-destructive",
            // User's additional classes (non-structural)
            className
          )}
          value={value}
          onChange={onChange}
          onScroll={handleScroll}
          {...props}
        />
      </div>
    );
  }
);

HighlightedTextarea.displayName = "HighlightedTextarea";
