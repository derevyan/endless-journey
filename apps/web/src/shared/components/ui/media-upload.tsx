/**
 * MediaUpload Component
 *
 * Drag-and-drop file upload for images and videos with preview.
 * Includes option to select from previously uploaded files (gallery).
 *
 * @module components/ui/media-upload
 */

import { useUpload } from "@/hooks/queries/use-upload";
import { cn } from "@/shared/lib/utils";
import type { Media } from "@journey/schemas";
import { Film, FolderOpen, ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "./button";
import { MediaGalleryDialog } from "./media-gallery-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface MediaUploadProps {
  /** Current media value */
  value?: Media | null;
  /** Callback when media changes */
  onChange: (media: Media | null) => void;
  /** Journey ID for uploading media */
  journeyId: string | undefined;
  /** Disable interactions */
  disabled?: boolean;
  /** Accepted file types */
  accept?: string;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 300 * 1024 * 1024; // 300MB

// =============================================================================
// HELPERS
// =============================================================================

function getMediaTypeFromFile(file: File): "image" | "video" | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return "image";
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MediaUpload({ value, onChange, journeyId, disabled = false, accept = ACCEPTED_TYPES.join(","), className }: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const { mutate: upload, isPending } = useUpload();

  const handleGallerySelect = useCallback(
    (media: Media) => {
      onChange(media);
      setError(null);
    },
    [onChange]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    const mediaType = getMediaTypeFromFile(file);
    if (!mediaType) {
      return "Invalid file type. Please upload an image or video.";
    }

    const maxSize = mediaType === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      const limitMB = maxSize / (1024 * 1024);
      return `File too large. Maximum size for ${mediaType}s is ${limitMB}MB.`;
    }

    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (!journeyId) {
        setError("No journey selected");
        return;
      }

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      upload(
        { file, journeyId },
        {
          onSuccess: (data) => {
            onChange({
              type: data.type,
              url: data.url,
              filename: data.filename,
            });
          },
          onError: (err) => {
            setError(err.message || "Upload failed");
          },
        }
      );
    },
    [upload, onChange, validateFile, journeyId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFile]
  );

  const handleRemove = useCallback(() => {
    onChange(null);
    setError(null);
  }, [onChange]);

  // Show preview if we have a value
  if (value) {
    return (
      <div className={cn("relative rounded-lg border bg-muted/30 overflow-hidden", className)}>
        {/* Preview */}
        <div className="relative aspect-video bg-muted flex items-center justify-center">
          {value.type === "image" ? (
            <img src={value.url} alt={value.filename || "Uploaded image"} className="w-full h-full object-contain" />
          ) : (
            <video src={value.url} className="w-full h-full object-contain" controls preload="metadata" />
          )}
        </div>

        {/* Info bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-background/80 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            {value.type === "image" ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <Film className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{value.filename || "Media"}</span>
          </div>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove} className="size-7 p-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Show upload area
  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-colors",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed",
          isPending && "pointer-events-none"
        )}
      >
        <label className={cn("flex flex-col items-center justify-center gap-2 p-6 cursor-pointer", disabled && "cursor-not-allowed")}>
          <input type="file" accept={accept} onChange={handleFileSelect} disabled={disabled || isPending} className="sr-only" />

          {isPending ? (
            <>
              <Loader2 className="size-8 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground" />
              <div className="text-center">
                <span className="text-sm text-muted-foreground">
                  Drop file here or <span className="text-primary underline">browse</span>
                </span>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Images (JPEG, PNG, GIF, WebP) up to 10MB
                  <br />
                  Videos (MP4, WebM) up to 300MB
                </p>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Gallery button */}
      {!disabled && !isPending && (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setGalleryOpen(true)}>
          <FolderOpen className="size-4 mr-2" />
          Choose from Gallery
        </Button>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <X className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Gallery Dialog */}
      <MediaGalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen} onSelect={handleGallerySelect} journeyId={journeyId} />
    </div>
  );
}
