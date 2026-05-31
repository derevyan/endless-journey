/**
 * Media validation utility
 *
 * Validates and normalizes media objects for message sending.
 */

export type ValidatedMedia = { type: "image" | "video"; url: string; mediaId?: string };

/**
 * Validate and normalize media format
 *
 * Ensures the media object has the correct structure with a valid type and URL.
 *
 * @param media - Unknown media object to validate
 * @returns Normalized media object or undefined if invalid
 *
 * @example
 * ```typescript
 * const media = validateMedia(nodeData.media);
 * if (media) {
 *   await sendMessage(content, buttons, media);
 * }
 * ```
 */
export function validateMedia(media: unknown): ValidatedMedia | undefined {
  if (!media) return undefined;

  if (typeof media === "object" && media !== null && "type" in media && "url" in media) {
    const mediaObj = media as { type: unknown; url: unknown; mediaId?: unknown };
    if (mediaObj.type === "image" || mediaObj.type === "video") {
      if (typeof mediaObj.url === "string" && mediaObj.url.length > 0) {
        const result: ValidatedMedia = { type: mediaObj.type, url: mediaObj.url };
        if (typeof mediaObj.mediaId === "string" && mediaObj.mediaId.length > 0) {
          result.mediaId = mediaObj.mediaId;
        }
        return result;
      }
    }
  }

  return undefined;
}
