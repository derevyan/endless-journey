/**
 * Session Export Button
 *
 * Button for exporting current session as JSON file.
 * Works with both live simulator sessions and playback sessions.
 *
 * @module features/journey/session-player/components/session-export-button
 */

import { memo } from "react";
import { Download } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { useSessionExport } from "../hooks";

interface SessionExportButtonProps {
  /** Size variant - default "sm" for toolbar */
  size?: "sm" | "icon-sm";
  /** Variant - default "ghost" */
  variant?: "ghost" | "outline";
}

/**
 * Export button component
 *
 * Shows export status and downloads session as JSON file on click.
 * Disabled when no session is active.
 *
 * Usage:
 * ```tsx
 * <SessionExportButton />
 * <SessionExportButton size="icon-sm" variant="outline" />
 * ```
 */
export const SessionExportButton = memo(function SessionExportButton({
  size = "sm",
  variant = "ghost",
}: SessionExportButtonProps) {
  const { exportSession, canExport } = useSessionExport();

  return (
    <Button
      onClick={exportSession}
      disabled={!canExport}
      size={size}
      variant={variant}
      title="Download session as JSON file"
    >
      <Download className="size-4 mr-2" />
      Export Session
    </Button>
  );
});

SessionExportButton.displayName = "SessionExportButton";
