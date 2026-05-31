/**
 * AvatarUpload Component
 *
 * Circular avatar upload with preview, hover overlay, and remove functionality.
 * Used for user profile images and organisation logos.
 *
 * @module components/ui/avatar-upload
 */

import { createLogger, serializeError } from "@journey/logger";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import * as React from "react";

import { apiClient } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";

const log = createLogger("avatar-upload");

// =============================================================================
// TYPES
// =============================================================================

interface AvatarUploadProps {
  /** Current avatar URL */
  value?: string | null;
  /** Callback when avatar changes */
  onChange: (url: string | null) => void;
  /** Size of the avatar in pixels */
  size?: number;
  /** Disable interactions */
  disabled?: boolean;
  /** Fallback icon or initials when no avatar */
  fallback?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// =============================================================================
// COMPONENT
// =============================================================================

export function AvatarUpload({ value, onChange, size = 96, disabled = false, fallback, className }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so same file can be selected again
      e.target.value = "";

      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Please upload a JPEG, PNG, GIF, or WebP image");
        return;
      }

      // Validate file size
      if (file.size > MAX_SIZE) {
        setError("Image must be less than 5MB");
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const result = await apiClient.uploadAvatar(file);
        onChange(result.url);
        log.info({ url: result.url }, "avatarUpload:success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        log.error({ err: serializeError(err) }, "avatarUpload:error");
      } finally {
        setIsUploading(false);
      }
    },
    [onChange]
  );

  const handleRemove = React.useCallback(() => {
    onChange(null);
    setError(null);
  }, [onChange]);

  const handleClick = React.useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Avatar with upload overlay */}
      <div className="relative group">
        <Avatar
          style={{ width: size, height: size }}
          className={cn(
            "border-2 border-muted transition-all",
            !disabled && !isUploading && "cursor-pointer hover:border-primary/50",
            disabled && "opacity-50"
          )}
          onClick={handleClick}
        >
          {value ? <AvatarImage src={value} alt="Avatar" /> : null}
          <AvatarFallback className="bg-muted">
            {isUploading ? (
              <Loader2 className="size-1/3 animate-spin text-muted-foreground" />
            ) : (
              fallback || <User className="size-1/3 text-muted-foreground" />
            )}
          </AvatarFallback>
        </Avatar>

        {/* Upload overlay on hover */}
        {!disabled && !isUploading && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full",
              "bg-black/50 opacity-0 transition-opacity",
              "group-hover:opacity-100 cursor-pointer"
            )}
            onClick={handleClick}
          >
            <Camera className="size-1/4 text-white" />
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="sr-only"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={disabled || isUploading}>
          {isUploading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Uploading...
            </>
          ) : value ? (
            "Change"
          ) : (
            "Upload"
          )}
        </Button>

        {value && !isUploading && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={disabled} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  );
}

















