/**
 * NodeMediaPreview Component
 *
 * Shared media preview display for node components.
 * Shows a compact indicator of attached media (image or video).
 */

import type { Media } from "@journey/schemas";
import { Film, ImageIcon } from "lucide-react";
import { MEDIA_PREVIEW_STYLES } from "../../config/node-theme";

interface NodeMediaPreviewProps {
  media: Media | null | undefined;
}

/**
 * Compact media preview for node display
 * Shows icon and filename for attached images/videos
 */
export function NodeMediaPreview({ media }: NodeMediaPreviewProps) {
  // Only render if media exists with valid url
  if (!media || typeof media !== "object" || !media.url) {
    return null;
  }

  return (
    <div className={`${MEDIA_PREVIEW_STYLES.layout} ${MEDIA_PREVIEW_STYLES.base}`}>
      {media.type === "video" ? <Film className={MEDIA_PREVIEW_STYLES.icon.size} /> : <ImageIcon className={MEDIA_PREVIEW_STYLES.icon.size} />}
      <span className="truncate">{media.filename || media.type}</span>
    </div>
  );
}
