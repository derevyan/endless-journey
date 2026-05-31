/**
 * CollapsibleSection Component
 *
 * Unified collapsible section component with support for both controlled
 * and uncontrolled modes, multiple size variants, and chevron positions.
 *
 * @module components/ui/collapsible-section
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { cn } from "@/shared/lib/utils";

interface CollapsibleSectionProps {
  /** Icon to show in the trigger */
  icon: LucideIcon;
  /** Label text for the trigger */
  label: string;
  /** Content to show when expanded */
  children: React.ReactNode;

  // Controlled mode props
  /** Whether the section is expanded (controlled mode) */
  open?: boolean;
  /** Callback when expansion state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;

  // Uncontrolled mode props
  /** Default expanded state (uncontrolled mode) */
  defaultOpen?: boolean;

  // Styling props
  /** Additional class names for the root element */
  className?: string;
  /** Additional class names for the content wrapper */
  contentClassName?: string;
  /** Padding class for content (default: "pl-6") */
  paddingClass?: string;

  // Variants
  /** Size variant: "default" or "sm" */
  size?: "default" | "sm";
  /** Chevron style: "down" rotates 180°, "right" rotates 90° */
  chevronStyle?: "down" | "right";

  /** Optional badge count to show after label */
  badge?: number | string;
}

/**
 * Unified collapsible section with consistent styling.
 *
 * Supports both controlled and uncontrolled modes:
 *
 * @example Controlled mode (for node editors)
 * ```tsx
 * const [open, setOpen] = useState(true);
 * <CollapsibleSection
 *   open={open}
 *   onOpenChange={setOpen}
 *   icon={Key}
 *   label="Authentication"
 * >
 *   <AuthFields />
 * </CollapsibleSection>
 * ```
 *
 * @example Uncontrolled mode (for CRM client detail)
 * ```tsx
 * <CollapsibleSection
 *   defaultOpen
 *   icon={User}
 *   label="Contact Info"
 *   chevronStyle="right"
 * >
 *   <ContactFields />
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  icon: Icon,
  label,
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  className,
  contentClassName,
  paddingClass = "pl-6",
  size = "default",
  chevronStyle = "down",
  badge,
}: CollapsibleSectionProps) {
  // Handle controlled vs uncontrolled mode
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setUncontrolledOpen(newOpen);
    }
  };

  const isSmall = size === "sm";
  const iconSize = isSmall ? "size-3.5" : "size-4";
  const chevronSize = isSmall ? "size-3.5" : "size-4";

  // Chevron component based on style
  const ChevronIcon = chevronStyle === "right" ? ChevronRight : ChevronDown;
  const chevronRotation =
    chevronStyle === "right"
      ? isOpen && "rotate-90"
      : isOpen && "rotate-180";

  const triggerClasses = cn(
    "flex w-full items-center gap-2 font-medium transition-colors",
    chevronStyle === "right"
      ? "justify-between py-2.5 px-3 hover:bg-muted/50 rounded-md group-data-[state=open]:bg-muted/30"
      : "hover:text-foreground text-muted-foreground",
    isSmall ? "py-1.5 text-xs" : "py-2 text-sm"
  );

  const contentClasses = cn(
    chevronStyle === "right"
      ? "pt-1 pb-2 pl-1 pr-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden"
      : cn("space-y-3 pt-2", paddingClass),
    contentClassName
  );

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(chevronStyle === "right" && "group", className)}
    >
      <CollapsibleTrigger className={triggerClasses}>
        {chevronStyle === "right" ? (
          <>
            <span className="flex items-center gap-2.5 font-medium text-foreground/80 group-hover:text-foreground transition-colors">
              <Icon className={cn(iconSize, "text-muted-foreground/70 group-hover:text-muted-foreground transition-colors")} />
              {label}
            </span>
            <ChevronIcon className={cn(chevronSize, "text-muted-foreground/70 transition-transform duration-200", chevronRotation)} />
          </>
        ) : (
          <>
            <Icon className={iconSize} />
            <span>{label}</span>
            {badge !== undefined && badge !== null && (
              <span className={cn("ml-1 rounded-full bg-primary/10 px-1.5 py-0.5", "text-[10px]")}>
                {badge}
              </span>
            )}
            <ChevronIcon className={cn(chevronSize, "ml-auto transition-transform", chevronRotation)} />
          </>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className={contentClasses}>{children}</CollapsibleContent>
    </Collapsible>
  );
}
