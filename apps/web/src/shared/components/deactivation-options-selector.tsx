/**
 * Deactivation Options Selector
 *
 * Reusable radio group for selecting session deactivation mode.
 * Used in SaveVersionDialog and DeactivationDialog.
 *
 * @module shared/components/deactivation-options-selector
 */

import type { DeactivationMode } from "@journey/schemas";

import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { DEACTIVATION_OPTIONS } from "@/shared/lib/deactivation-options";
import { cn } from "@/shared/lib/utils";

interface DeactivationOptionsSelectorProps {
  value: DeactivationMode;
  onChange: (mode: DeactivationMode) => void;
  /** Optional label text above the selector */
  label?: string;
  /** Additional class name for the container */
  className?: string;
}

export function DeactivationOptionsSelector({
  value,
  onChange,
  label = "Deactivation Strategy",
  className,
}: DeactivationOptionsSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 leading-none">
          {label}
        </Label>
      )}
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as DeactivationMode)}
        className="grid gap-2"
      >
        {DEACTIVATION_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              value === option.value
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value={option.value} id={`mode-${option.value}`} className="mt-1" />
            <div className="flex-1 grid gap-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{option.icon}</span>
                <span className="text-sm font-medium leading-none">{option.label}</span>
                {option.warning && (
                  <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider ml-auto">
                    {option.warning}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-normal">{option.description}</p>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
