/**
 * VariableTypeBadge Component
 *
 * A badge component for displaying variable types with distinct colors
 * that work well on both light and dark themes.
 *
 * Types: string, number, boolean, array, object, null
 */

import { cn } from "@/shared/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// =============================================================================
// TYPES
// =============================================================================

export type VariableType = "string" | "number" | "boolean" | "array" | "object" | "null";

// =============================================================================
// STYLES
// =============================================================================

const variableTypeBadgeVariants = cva(
  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
  {
    variants: {
      type: {
        string: "bg-var-string/20 text-var-string-foreground",
        number: "bg-var-number/20 text-var-number-foreground",
        boolean: "bg-var-boolean/20 text-var-boolean-foreground",
        array: "bg-var-array/20 text-var-array-foreground",
        object: "bg-var-object/20 text-var-object-foreground",
        null: "bg-var-null/20 text-var-null-foreground",
      },
      size: {
        xs: "text-[8px] px-1 py-0 h-3.5",
        sm: "text-[10px] px-1.5 py-0.5",
        md: "text-xs px-2 py-0.5",
      },
    },
    defaultVariants: {
      type: "string",
      size: "sm",
    },
  }
);

// =============================================================================
// HELPER
// =============================================================================

/**
 * Infer the variable type from a value
 */
export function inferVariableType(value: unknown): VariableType {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

// =============================================================================
// COMPONENT
// =============================================================================

interface VariableTypeBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof variableTypeBadgeVariants> {
  /** The variable type to display */
  type?: VariableType;
  /** Automatically infer type from a value */
  value?: unknown;
}

export function VariableTypeBadge({
  className,
  type,
  value,
  size,
  ...props
}: VariableTypeBadgeProps) {
  // If value is provided, infer the type from it
  const resolvedType = type ?? (value !== undefined ? inferVariableType(value) : "string");

  return (
    <span
      className={cn(variableTypeBadgeVariants({ type: resolvedType, size }), className)}
      {...props}
    >
      {resolvedType}
    </span>
  );
}

