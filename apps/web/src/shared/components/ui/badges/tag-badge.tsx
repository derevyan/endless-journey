import { Check } from "lucide-react";

import { Badge } from "./badge";
import { Label } from "@/shared/components/ui/label";
import { TAG_AVAILABLE_COLORS, TAG_COLOR_MAP } from "@/shared/lib/app-config";
import { cn } from "@/shared/lib/utils";

interface TagBadgeProps {
  tag: string;
  color?: string | null;
  className?: string;
}

export function TagBadge({ tag, color, className }: TagBadgeProps) {
  // Use static color map to ensure Tailwind JIT includes all classes
  const dotColor = color && TAG_COLOR_MAP[color] ? TAG_COLOR_MAP[color] : "bg-slate-500";

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-mono font-medium max-w-28 whitespace-nowrap", className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dotColor)} />
      <span className="truncate">{tag}</span>
    </Badge>
  );
}

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  /**
   * Optional custom colors array. If provided, uses these instead of TAG_AVAILABLE_COLORS.
   * For hex colors, pass the hex values directly (e.g., ["#6b7280", "#3b82f6"]).
   * For Tailwind color tokens, use the format "color-shade" (e.g., ["slate-500", "blue-500"]).
   */
  colors?: readonly string[];
}

/**
 * Check if a color string is a hex color
 */
function isHexColor(color: string): boolean {
  return color.startsWith("#");
}

export function ColorPicker({ value, onChange, label, colors }: ColorPickerProps) {
  const colorList = colors ?? TAG_AVAILABLE_COLORS;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-2">
        {colorList.map((color) => {
          const isHex = isHexColor(color);
          // For hex colors, use inline style; for Tailwind tokens, use class map
          const bgClass = isHex ? undefined : TAG_COLOR_MAP[color];
          const bgStyle = isHex ? { backgroundColor: color } : undefined;
          const colorName = isHex ? color : color.split("-")[0];

          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={cn(
                "relative size-8 rounded-full border-2 transition-all hover:scale-110",
                bgClass,
                value === color ? "border-foreground scale-110" : "border-transparent"
              )}
              style={bgStyle}
              title={colorName}
            >
              {value === color && (
                <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TAG_COLOR_MAP };
