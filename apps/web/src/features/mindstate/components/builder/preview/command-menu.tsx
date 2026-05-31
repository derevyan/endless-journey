/**
 * Command Menu
 *
 * Shows available slash commands for quick testing scenarios.
 */

import { cn } from "@/shared/lib/utils";
import { SLASH_COMMANDS } from "../../../lib/defaults";

interface CommandMenuProps {
  input: string;
  onSelect: (text: string) => void;
  onClose: () => void;
}

export function CommandMenu({ input, onSelect, onClose }: CommandMenuProps) {
  // Filter commands based on input
  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.cmd.toLowerCase().startsWith(input.toLowerCase())
  );

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
      <div className="p-2 border-b border-border">
        <p className="text-xs text-muted-foreground">Quick test scenarios</p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.map((cmd) => (
          <button
            key={cmd.cmd}
            onClick={() => {
              onSelect(cmd.text);
              onClose();
            }}
            className={cn(
              "w-full flex flex-col items-start gap-1 p-3 text-left",
              "hover:bg-accent transition-colors",
              "border-b border-border/50 last:border-0"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-primary">{cmd.cmd}</span>
              <span className="text-xs font-medium text-foreground">{cmd.label}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {cmd.text}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
