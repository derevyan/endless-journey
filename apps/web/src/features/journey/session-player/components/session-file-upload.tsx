/**
 * Session File Upload Component
 *
 * File input for loading session JSON files.
 * Handles file selection, validation, and playback initialization.
 *
 * @module features/journey/session-player/components/session-file-upload
 */

import { memo, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { useSessionFileUpload } from "../hooks";

interface SessionFileUploadProps {
  /** Size variant - default "sm" for toolbar */
  size?: "sm" | "icon-sm";
  /** Variant - default "outline" */
  variant?: "outline" | "ghost";
}

/**
 * File upload component for session JSON files
 *
 * Presents a file input button that:
 * 1. Accepts .json files only
 * 2. Shows loading state while processing
 * 3. Validates file structure
 * 4. Loads session and starts playback
 *
 * Usage:
 * ```tsx
 * <SessionFileUpload />
 * <SessionFileUpload size="icon-sm" variant="ghost" />
 * ```
 */
export const SessionFileUpload = memo(function SessionFileUpload({
  size = "sm",
  variant = "outline",
}: SessionFileUploadProps) {
  const { loadSessionFile } = useSessionFileUpload();
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      await loadSessionFile(file);
    } finally {
      setIsLoading(false);
    }

    // Reset input so same file can be selected again
    event.target.value = "";
  };

  return (
    <>
      <input
        id="session-file-input"
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        disabled={isLoading}
        style={{ display: "none" }}
      />
      <label htmlFor="session-file-input" style={{ cursor: isLoading ? "not-allowed" : "pointer" }}>
        <Button
          asChild
          disabled={isLoading}
          size={size}
          variant={variant}
          title="Load session JSON file"
        >
          <span>
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                Load Session
              </>
            )}
          </span>
        </Button>
      </label>
    </>
  );
});

SessionFileUpload.displayName = "SessionFileUpload";
