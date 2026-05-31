import { cn } from "@/shared/lib/utils";

interface StatusDotBadgeProps {
  /** Label text (uppercased by default) */
  label: string;
  /** Dot color class (e.g. "bg-emerald-500") */
  dotClassName: string;
  /** Size variant */
  size?: "sm" | "default";
  /** Additional class names */
  className?: string;
  /** Optional aria-label for screen readers */
  ariaLabel?: string;
  /** Disable uppercase transform */
  uppercase?: boolean;
  /** Hide text on mobile, show only dot */
  hideTextOnMobile?: boolean;
}

export function StatusDotBadge({
  label,
  dotClassName,
  size = "default",
  className,
  ariaLabel,
  uppercase = true,
  hideTextOnMobile = false,
}: StatusDotBadgeProps) {
  const text = uppercase ? label.toUpperCase() : label;

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 px-2 py-0.5 font-bold tracking-wide transition-all",
        size === "sm" ? "text-[9px]" : "text-[10px]",
        className
      )}
      aria-label={ariaLabel}
    >
      <span className={cn("size-1.5 rounded-full", dotClassName)} aria-hidden="true" />
      <span className={cn("text-foreground/80", hideTextOnMobile && "hidden lg:inline")}>{text}</span>
    </span>
  );
}
