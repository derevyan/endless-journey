/**
 * Appearance Section
 *
 * Canvas settings (edge style, animations) and theme configuration.
 *
 * @module components/settings/sections/appearance-section
 */

import { useStore } from "@tanstack/react-store";
import { AlertTriangle, GitBranch, Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { notify } from "@/shared/lib/ui/notify";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { type EdgeConnectionStyle, uiActions, uiStore } from "@/stores/ui-store";

const EDGE_STYLE_OPTIONS: { value: EdgeConnectionStyle; label: string; description: string }[] = [
  { value: "default", label: "Bezier", description: "Smooth curved connections" },
  { value: "straight", label: "Straight", description: "Direct line connections" },
  { value: "step", label: "Step", description: "Right-angle stepped connections" },
  { value: "smoothstep", label: "Smooth Step", description: "Rounded right-angle connections" },
];

export function AppearanceSection() {
  const edgeConnectionStyle = useStore(uiStore, (state) => state.edgeConnectionStyle);
  const edgeAnimations = useStore(uiStore, (state) => state.edgeAnimations);
  const { theme, setTheme } = useTheme();
  const selectedOption = EDGE_STYLE_OPTIONS.find((opt) => opt.value === edgeConnectionStyle);

  const handleEdgeStyleChange = (value: EdgeConnectionStyle) => {
    uiActions.setEdgeConnectionStyle(value);
    const option = EDGE_STYLE_OPTIONS.find((opt) => opt.value === value);
    notify.success(`Edge style changed to ${option?.label || value}`, {
      description: option?.description,
    });
  };

  const handleEdgeAnimationsChange = (enabled: boolean) => {
    uiActions.setEdgeAnimations(enabled);
    notify.success(enabled ? "Edge animations enabled" : "Edge animations disabled", {
      description: enabled ? "Edges will now animate. Note: This may increase CPU usage." : "Animations disabled for better performance.",
    });
  };

  return (
    <div className="space-y-8">
      {/* Theme Selection */}
      <div className="space-y-3">
        <Label>Theme</Label>
        <div className="flex gap-2">
          <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")} className="flex items-center gap-2">
            <Sun className="size-4" />
            Light
          </Button>
          <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")} className="flex items-center gap-2">
            <Moon className="size-4" />
            Dark
          </Button>
          <Button variant={theme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")} className="flex items-center gap-2">
            System
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Choose your preferred color scheme</p>
      </div>

      {/* Journey Canvas Settings Section */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-base font-medium">Journey Canvas</h3>
          <p className="text-xs text-muted-foreground">Configure how the journey canvas looks and behaves</p>
        </div>

        {/* Edge Connection Style */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            <Label htmlFor="edge-style">Edge Connection Style</Label>
          </div>
          <Select value={edgeConnectionStyle} onValueChange={handleEdgeStyleChange}>
            <SelectTrigger id="edge-style" className="w-full">
              <SelectValue>{selectedOption?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EDGE_STYLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="py-2">
                  <span>{option.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">— {option.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Choose how connections between nodes are drawn on the canvas.</p>
        </div>

        {/* Edge Animations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <Label htmlFor="edge-animations">Edge Animations</Label>
            </div>
            <Switch id="edge-animations" checked={edgeAnimations} onCheckedChange={handleEdgeAnimationsChange} />
          </div>
          <p className="text-xs text-muted-foreground">Animate edges with flowing dash patterns during simulation and journey visualization.</p>
          <div className="flex items-center gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>
              {edgeAnimations
                ? "Animations enabled — this can significantly increase CPU/GPU usage and may cause browser performance issues."
                : "Enable with caution: animations can significantly increase CPU/GPU usage and cause browser performance issues."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
