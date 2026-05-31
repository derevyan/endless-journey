"use client";

import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { Switch } from "@/shared/components/ui/switch";

/**
 * IconSwitch - A styled switch with icon indicators
 *
 * Based on shadcn-studio switch-12 pattern. Displays icons on both sides
 * of the switch that indicate the two states. The switch thumb slides
 * over the icons with a smooth animation.
 *
 * @example
 * <IconSwitch
 *   checked={isSimulator}
 *   onCheckedChange={setIsSimulator}
 *   leftIcon={Pencil}
 *   rightIcon={Play}
 *   aria-label="Toggle mode"
 * />
 */
interface IconSwitchProps extends Omit<ComponentPropsWithoutRef<typeof Switch>, "className"> {
  /** Icon shown on the left (unchecked state) */
  leftIcon: LucideIcon;
  /** Icon shown on the right (checked state) */
  rightIcon: LucideIcon;
}

export function IconSwitch({ leftIcon: LeftIcon, rightIcon: RightIcon, ...props }: IconSwitchProps) {
  return (
    <div className="relative inline-grid h-7 grid-cols-[1fr_1fr] items-center text-sm font-medium">
      <Switch
        className="peer data-[state=checked]:bg-input/50 data-[state=unchecked]:bg-input/50 [&_span]:!bg-background absolute inset-0 h-[inherit] w-14 [&_span]:size-6.5 [&_span]:transition-transform [&_span]:duration-300 [&_span]:ease-[cubic-bezier(0.16,1,0.3,1)] [&_span]:data-[state=checked]:translate-x-7 [&_span]:data-[state=checked]:rtl:-translate-x-7"
        {...props}
      />
      <span className="peer-data-[state=checked]:text-muted-foreground/70 pointer-events-none relative ml-1.75 flex min-w-7 items-center text-center">
        <LeftIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="peer-data-[state=unchecked]:text-muted-foreground/70 pointer-events-none relative -ms-0.25 flex min-w-7 items-center text-center">
        <RightIcon className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
}
