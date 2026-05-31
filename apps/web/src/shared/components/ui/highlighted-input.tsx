/**
 * HighlightedInput Component
 *
 * A single-line input with syntax highlighting for template variables using overlay approach.
 * Renders a div with highlighted content behind a transparent input.
 *
 * Uses a variant-based API for reliable text alignment:
 * - "default": h-9, text-sm (standard size)
 * - "compact": h-8, text-xs, font-mono (for variable editors)
 *
 * @module components/ui/highlighted-input
 */

import { forwardRef, useCallback, useRef, useState } from "react";

import { highlightVariables } from "@/shared/lib/template";
import { cn } from "@/shared/lib/utils";

/**
 * Pre-tested variant configurations.
 * Each variant defines synchronized styles for input and backdrop.
 * The backdrop line-height matches the input height for vertical centering.
 */
const variants = {
  default: {
    input: "h-9 px-3 py-1 text-sm",
    backdrop: "px-3 text-sm leading-9",
  },
  compact: {
    input: "h-8 px-3 py-1 text-xs font-mono",
    backdrop: "px-3 text-xs font-mono leading-8",
  },
} as const;

type HighlightedInputVariant = keyof typeof variants;

interface HighlightedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Size variant - controls height, font-size, and text alignment */
  variant?: HighlightedInputVariant;
  /** Additional CSS classes for the input (non-structural styles like colors) */
  className?: string;
  /** CSS class for highlighted variables */
  highlightClass?: string;
  /** When true, hides the highlighted backdrop */
  hideBackdrop?: boolean;
  /** Class for the wrapper container */
  wrapperClassName?: string;
  /** Callback when mouse enters/leaves a variable - receives (variablePath, x, y) or (null, 0, 0) */
  onVariableHover?: (variablePath: string | null, x: number, y: number) => void;
  /** Shows error styling (red border) when true */
  hasError?: boolean;
}

/**
 * HighlightedInput with syntax highlighting for {{variables}}
 *
 * Uses overlay approach:
 * - Background div renders highlighted content (visible text)
 * - Transparent input overlays for editing (invisible text, visible caret)
 *
 * @example
 * ```tsx
 * // Default size (h-9, text-sm)
 * <HighlightedInput value={value} onChange={onChange} />
 *
 * // Compact size for variable editors (h-8, text-xs, font-mono)
 * <HighlightedInput variant="compact" value={value} onChange={onChange} />
 * ```
 */
export const HighlightedInput = forwardRef<HTMLInputElement, HighlightedInputProps>(
  ({ variant = "default", className, wrapperClassName, highlightClass = "text-sky-500", hideBackdrop = false, onVariableHover, hasError, value, onChange, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Get styles for the selected variant
    const styles = variants[variant];

    // Use forwarded ref or internal ref
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

    // Sync scroll position from input to backdrop
    const handleScroll = useCallback((e: React.UIEvent<HTMLInputElement>) => {
      const target = e.currentTarget;
      setScrollLeft(target.scrollLeft);
    }, []);

    // Detect hover by checking bounding rectangles of variable spans
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
              className={cn(styles.backdrop, "whitespace-nowrap text-foreground")}
              style={{
                // Use transform for scroll sync
                transform: `translateX(${-scrollLeft}px)`,
              }}
            >
              {highlightVariables(textValue, highlightClass)}
            </div>
          </div>
        )}

        {/* Actual input (transparent text, visible caret) */}
        <input
          ref={inputRef}
          type="text"
          className={cn(
            // Variant-specific styles (height, padding, font)
            styles.input,
            // Base input styles (matching shadcn Input)
            "w-full rounded-md border border-input bg-transparent shadow-xs transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Make text transparent but keep caret visible
            "text-transparent caret-foreground",
            // Selection should be visible
            "selection:bg-primary/30 selection:text-transparent",
            // Error styling
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

HighlightedInput.displayName = "HighlightedInput";
