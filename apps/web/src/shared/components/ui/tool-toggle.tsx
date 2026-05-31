/**
 * ToolToggle Component
 *
 * A reusable toggle component for tool/feature configuration.
 * Shows icon, label, description and a switch control.
 */

import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import type { LucideIcon } from "lucide-react";

export interface ToolToggleProps {
  /** Unique ID for the toggle (used for label htmlFor) */
  id: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Label text */
  label: string;
  /** Description text */
  description: string;
  /** Current checked state */
  checked: boolean;
  /** Callback when toggle state changes */
  onChange: (checked: boolean) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
}

export function ToolToggle({ id, icon: Icon, label, description, checked, onChange, disabled }: ToolToggleProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="space-y-0">
          <Label htmlFor={id} className="text-xs cursor-pointer">{label}</Label>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
