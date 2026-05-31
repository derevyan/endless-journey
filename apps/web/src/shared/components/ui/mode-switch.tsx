import { Pencil, Play } from "lucide-react";

import { IconSwitch } from "@/shared/components/ui/icon-switch";
import { saveManagerActions } from "@/stores/save-manager-store";

type EditorMode = "edit" | "simulator";

/**
 * ModeSwitch - Toggle between Edit and Simulator modes
 *
 * A controlled component that toggles between edit and simulator modes.
 * Uses IconSwitch for a styled toggle with embedded icons.
 * Left icon (Pencil) = Edit mode (default)
 * Right icon (Play) = Simulator mode
 *
 * Automatically flushes any pending auto-save before switching modes
 * to ensure editor changes are preserved.
 *
 * @example
 * // With journey builder (uiStore)
 * const mode = useStore(uiStore, (s) => s.mode);
 * <ModeSwitch mode={mode} onModeChange={uiActions.setMode} />
 *
 * // With agent workflow (agentWorkflowStore)
 * const mode = useStore(agentWorkflowStore, (s) => s.mode);
 * <ModeSwitch mode={mode} onModeChange={agentWorkflowActions.setMode} />
 */
interface ModeSwitchProps {
  /** Current mode */
  mode: EditorMode;
  /** Callback when mode changes */
  onModeChange: (mode: EditorMode) => void;
}

export function ModeSwitch({ mode, onModeChange }: ModeSwitchProps) {
  // Switch is checked when in simulator mode (right side = Play icon)
  const isSimulator = mode === "simulator";

  const handleCheckedChange = async (checked: boolean) => {
    // Flush any pending editor changes before switching modes
    const flushed = await saveManagerActions.flushActiveEditor();
    if (!flushed) {
      // Editor validation failed, don't switch modes
      return;
    }

    onModeChange(checked ? "simulator" : "edit");
  };

  return (
    <div data-testid="mode-switch">
      <IconSwitch
        checked={isSimulator}
        onCheckedChange={handleCheckedChange}
        leftIcon={Pencil}
        rightIcon={Play}
        aria-label={isSimulator ? "Switch to Edit mode" : "Switch to Simulator mode"}
      />
    </div>
  );
}
