/**
 * Media Gallery Dialog
 *
 * Shows user's previously uploaded media files.
 * Allows selecting from gallery instead of re-uploading.
 *
 * @module components/ui/media-gallery-dialog
 */

import { useCheckMediaUsage, useDeleteMedia, useMediaGallery } from "@/hooks/queries/use-media-gallery";
import type { MediaItem } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";
import type { Media } from "@journey/schemas";
import { Check, Film, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { ScrollArea } from "./scroll-area";

// =============================================================================
// TYPES
// =============================================================================

interface MediaGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: Media) => void;
  /** Journey ID to fetch media for */
  journeyId: string | undefined;
  /** Filter by media type */
  filter?: "image" | "video" | "all";
}

interface DeleteState {
  mediaId: string | null;
  filename: string;
  usedIn: string[];
  isChecking: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MediaGalleryDialog({ open, onOpenChange, onSelect, journeyId, filter = "all" }: MediaGalleryDialogProps) {
  const { data: gallery, isLoading, error } = useMediaGallery(journeyId);
  const deleteMutation = useDeleteMedia(journeyId);
  const checkUsageMutation = useCheckMediaUsage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({
    mediaId: null,
    filename: "",
    usedIn: [],
    isChecking: false,
  });

  // Filter gallery items
  const items =
    gallery?.filter((item) => {
      if (filter === "all") return true;
      return item.type === filter;
    }) || [];

  const handleSelect = (item: MediaItem) => {
    setSelectedId(item.id);
  };

  const handleConfirm = () => {
    const item = items.find((i) => i.id === selectedId);
    if (item) {
      onSelect({
        type: item.type,
        url: item.url,
        filename: item.filename,
        mediaId: item.id,
      });
      onOpenChange(false);
      setSelectedId(null);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();

    // Check if media is in use
    setDeleteState({ mediaId: item.id, filename: item.filename, usedIn: [], isChecking: true });

    try {
      const result = await checkUsageMutation.mutateAsync(item.id);
      setDeleteState({
        mediaId: item.id,
        filename: item.filename,
        usedIn: result.usedIn,
        isChecking: false,
      });
    } catch {
      // Show dialog anyway if check fails
      setDeleteState({
        mediaId: item.id,
        filename: item.filename,
        usedIn: [],
        isChecking: false,
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteState.mediaId) return;

    deleteMutation.mutate(
      { mediaId: deleteState.mediaId },
      {
        onSuccess: () => {
          if (selectedId === deleteState.mediaId) {
            setSelectedId(null);
          }
          setDeleteState({ mediaId: null, filename: "", usedIn: [], isChecking: false });
        },
      }
    );
  };

  const handleDeleteDialogClose = (open: boolean) => {
    if (!open) {
      setDeleteState({ mediaId: null, filename: "", usedIn: [], isChecking: false });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Media Gallery</DialogTitle>
            <DialogDescription>Choose from previously uploaded files</DialogDescription>
          </DialogHeader>

          {/* Gallery Content */}
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Failed to load media gallery</p>
                <p className="text-sm">{error.message}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="size-12 mx-auto mb-3 opacity-30" />
                <p>No uploaded files yet</p>
                <p className="text-sm">Upload files to see them here</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-3 gap-3">
                  {items.map((item) => (
                    <GalleryItem
                      key={item.id}
                      item={item}
                      selected={selectedId === item.id}
                      onSelect={() => handleSelect(item)}
                      onDelete={(e) => handleDeleteClick(e, item)}
                      deleting={deleteState.isChecking && deleteState.mediaId === item.id}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedId}>
                Use Selected
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteState.mediaId !== null && !deleteState.isChecking}
        onOpenChange={handleDeleteDialogClose}
        onConfirm={handleDeleteConfirm}
        title={`Delete "${deleteState.filename}"?`}
        description="This will permanently delete the file from storage. This action cannot be undone."
        usedIn={deleteState.usedIn}
        isDeleting={deleteMutation.isPending}
        confirmText="Delete File"
      />
    </>
  );
}

// =============================================================================
// GALLERY ITEM
// =============================================================================

interface GalleryItemProps {
  item: MediaItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  deleting: boolean;
}

function GalleryItem({ item, selected, onSelect, onDelete, deleting }: GalleryItemProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
        selected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
      )}
    >
      {/* Thumbnail */}
      {item.type === "image" ? (
        <img src={item.url} alt={item.filename} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <Film className="size-8 text-muted-foreground" />
        </div>
      )}

      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
          <Check className="size-3" />
        </div>
      )}

      {/* Hover overlay with delete */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
        <div className="flex items-center justify-between w-full">
          <span className="text-white text-xs truncate max-w-[80%]">{item.filename}</span>
          <Button variant="ghost" size="icon" className="size-6 text-white hover:text-destructive hover:bg-white/20" onClick={onDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </Button>
        </div>
      </div>

      {/* Type badge */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
        {item.type === "image" ? <ImageIcon className="size-3" /> : <Film className="size-3" />}
      </div>
    </div>
  );
}
