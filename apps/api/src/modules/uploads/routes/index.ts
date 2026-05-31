/**
 * Upload Routes
 *
 * Handles file uploads for media attachments (images and videos).
 * Files are stored in MinIO (S3-compatible storage).
 * Media metadata is tracked in database for gallery/reuse.
 *
 * @module modules/uploads/routes
 */

import { z } from "zod";
import { createLogger, serializeError } from "@journey/logger";
import {
  isUuid,
  type JourneyIdOrSlug,
  createJourneyIdOrSlug,
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateQuery } from "../../../lib/zod-validator";
import { getRequestId } from "../../../lib/request-logger";
import { deleteFile, getFileSizeLimit, getMediaTypeFromMime, isAllowedFileType, uploadFile } from "../../../lib/storage";
import { createServicesFromContext } from "../../../services";

const log = createLogger("uploads");

function parseJourneyIdOrSlug(value: string): JourneyIdOrSlug {
  try {
    return createJourneyIdOrSlug(value);
  } catch (error) {
    throw new BadRequestError("Invalid journeyId", { journeyId: value }, error);
  }
}

export const uploads = createProtectedRouter({
  defaultPermission: { resource: "upload", action: "read" },
});

const UploadQuerySchema = z.object({
  journeyId: z.string().min(1),
});

// =============================================================================
// TYPES
// =============================================================================

interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  filename: string;
  createdAt: string;
}

interface UploadResponse {
  url: string;
  type: "image" | "video";
  filename: string;
}

interface ErrorResponse {
  error: string;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/uploads
 *
 * Upload a media file (image or video) to a specific journey.
 * Expects multipart/form-data with a 'file' field.
 * Query param: journeyId (required)
 *
 * Supported formats:
 * - Images: JPEG, PNG, GIF, WebP (max 10MB)
 * - Videos: MP4, WebM (max 300MB)
 *
 * Returns:
 * - url: Public URL to access the file
 * - type: "image" or "video"
 * - filename: Original filename
 */
uploads.post(
  "/",
  protect({ permission: { resource: "upload", action: "create" } }),
  async (c) => {
    const requestId = getRequestId(c) ?? crypto.randomUUID();
    const requestLog = log.child({ requestId });

    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const queryResult = validateQuery(c, UploadQuerySchema);
    if (!queryResult.success) {
      return queryResult.response;
    }
    const { journeyId } = queryResult.data;

    // Verify journey belongs to organization (works for both UUID and slug IDs)
    const journey = await services.journey.getJourneyById(parseJourneyIdOrSlug(journeyId), organization.id);
    if (!journey) {
      requestLog.warn({ journeyId, organizationId: organization.id }, "uploads:journeyAccessDenied");
      throw new NotFoundError("Journey", journeyId);
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      requestLog.warn("uploads:noFile");
      throw new BadRequestError("No file provided");
    }

    const filename = file.name;
    const mimeType = file.type;

    requestLog.info({ filename, mimeType, size: file.size, journeyId }, "uploads:received");

    // Validate file type
    if (!isAllowedFileType(mimeType)) {
      requestLog.warn({ mimeType }, "uploads:invalidType");
      throw new BadRequestError(`Invalid file type: ${mimeType}. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM`);
    }

    // Check file size
    const mediaType = getMediaTypeFromMime(mimeType);
    if (!mediaType) {
      requestLog.warn({ mimeType }, "uploads:unknownMediaType");
      throw new BadRequestError(`Unknown media type for: ${mimeType}`);
    }

    const sizeLimit = getFileSizeLimit(mediaType);
    if (file.size > sizeLimit) {
      const limitMB = sizeLimit / (1024 * 1024);
      requestLog.warn({ size: file.size, limit: sizeLimit }, "uploads:fileTooLarge");
      throw new BadRequestError(`File too large. Maximum size for ${mediaType}s is ${limitMB}MB`);
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to MinIO
    const result = await uploadFile(buffer, filename, mimeType);

    // Save media metadata to database for journey gallery
    // Only save if journeyId is a valid UUID (custom journeys use slug IDs which can't be stored)
    if (isUuid(journeyId)) {
      try {
        await services.upload.saveJourneyMedia({
          journeyId,
          uploadedBy: user.id,
          type: result.type,
          url: result.url,
          filename: result.filename,
          key: result.key,
          size: file.size,
          mimeType,
        });
        requestLog.debug({ journeyId, uploadedBy: user.id, key: result.key }, "uploads:dbSaved");
      } catch (dbError) {
        // Log but don't fail - file is already uploaded
        requestLog.warn({ err: serializeError(dbError) }, "uploads:dbSaveFailed");
      }
    } else {
      requestLog.debug({ journeyId }, "uploads:skippedDbSave:nonUuidJourney");
    }

    requestLog.info({ url: result.url, type: result.type, filename: result.filename, journeyId }, "uploads:success");

    return c.json<UploadResponse>({
      url: result.url,
      type: result.type,
      filename: result.filename,
    });
  }
);

/**
 * GET /api/uploads
 *
 * List media files for a specific journey (gallery).
 * Query param: journeyId (required)
 * Returns most recent files first.
 */
uploads.get("/", async (c) => {
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, UploadQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }
  const { journeyId } = queryResult.data;

  // Verify journey belongs to organization (works for both UUID and slug IDs)
  const journey = await services.journey.getJourneyById(parseJourneyIdOrSlug(journeyId), organization.id);
  if (!journey) {
    log.warn({ journeyId, organizationId: organization.id }, "uploads:list:accessDenied");
    throw new NotFoundError("Journey", journeyId);
  }

  // For non-UUID journey IDs (custom journeys with slug IDs), return empty gallery
  // since we can't store media associations for them (DB requires UUID)
  if (!isUuid(journeyId)) {
    log.debug({ journeyId }, "uploads:list:emptyForNonUuid");
    return c.json({ media: [] });
  }

  const media = await services.upload.listJourneyMedia(journeyId, 50);

  const items: MediaItem[] = media.map((m) => ({
    id: m.id,
    type: m.type,
    url: m.url,
    filename: m.filename,
    createdAt: m.createdAt?.toISOString() || new Date().toISOString(),
  }));

  log.debug({ journeyId, count: items.length }, "uploads:list");
  return c.json({ media: items });
});

/**
 * GET /api/uploads/:id/usage
 *
 * Check if a media file is in use in its journey.
 */
uploads.get("/:id/usage", async (c) => {
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const mediaId = c.req.param("id");

  // Find the media item
  const media = await services.upload.getJourneyMediaById(mediaId);

  if (!media) {
    throw new NotFoundError("Media", mediaId);
  }

  // Verify the media's journey belongs to the organization
  // media.journeyId is always a UUID from the database
  const journey = await services.journey.getJourneyById(parseJourneyIdOrSlug(media.journeyId), organization.id);
  if (!journey) {
    log.warn({ mediaId, journeyId: media.journeyId, organizationId: organization.id }, "uploads:checkUsage:accessDenied");
    throw new NotFoundError("Media", mediaId);
  }

  const inUse = await services.upload.isMediaUsedInJourney(media.journeyId, media.url);

  log.debug({ mediaId, journeyId: media.journeyId, inUse }, "uploads:checkUsage");
  return c.json({ inUse, usedIn: inUse ? ["Current Journey"] : [] });
});

/**
 * DELETE /api/uploads/:id
 *
 * Delete a media file from storage and database.
 * Pass ?force=true to delete even if in use.
 */
uploads.delete(
  "/:id",
  protect({ permission: { resource: "upload", action: "delete" } }),
  async (c) => {
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const mediaId = c.req.param("id");
    const force = c.req.query("force") === "true";

    // Find the media item
    const media = await services.upload.getJourneyMediaById(mediaId);

    if (!media) {
      throw new NotFoundError("Media", mediaId);
    }

    // Verify the media's journey belongs to the organization
    // media.journeyId is always a UUID from the database
    const journey = await services.journey.getJourneyById(parseJourneyIdOrSlug(media.journeyId), organization.id);
    if (!journey) {
      log.warn({ mediaId, journeyId: media.journeyId, organizationId: organization.id }, "uploads:delete:accessDenied");
      throw new NotFoundError("Media", mediaId);
    }

    // Check if in use (unless force=true)
    if (!force) {
      const inUse = await services.upload.isMediaUsedInJourney(media.journeyId, media.url);
      if (inUse) {
        throw new ConflictError("Media is in use");
      }
    }

    // Delete from storage
    try {
      await deleteFile(media.key);
    } catch (storageError) {
      log.warn({ key: media.key, err: serializeError(storageError) }, "uploads:delete:storageFailed");
      // Continue to delete from DB even if storage delete fails
    }

    // Delete from database
    await services.upload.deleteJourneyMediaById(mediaId);

    log.info({ mediaId, journeyId: media.journeyId, organizationId: organization.id, force }, "uploads:delete:success");
    return c.json({ success: true });
  }
);

/**
 * GET /api/uploads/config
 *
 * Get upload configuration (allowed types, size limits).
 * Useful for client-side validation before upload.
 */
uploads.get("/config", (c) => {
  return c.json({
    allowedTypes: {
      image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      video: ["video/mp4", "video/webm"],
    },
    maxSize: {
      image: 10 * 1024 * 1024, // 10MB
      video: 300 * 1024 * 1024, // 300MB
    },
  });
});

// =============================================================================
// AVATAR UPLOAD
// =============================================================================

/** Allowed avatar image types */
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Max avatar size: 5MB */
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

interface AvatarUploadResponse {
  url: string;
}

/**
 * POST /api/uploads/avatar
 *
 * Upload an avatar/logo image for user profile or organisation.
 * Expects multipart/form-data with a 'file' field.
 *
 * Supported formats: JPEG, PNG, GIF, WebP (max 5MB)
 *
 * Returns:
 * - url: Public URL to access the avatar
 */
uploads.post("/avatar", async (c) => {
  const requestId = crypto.randomUUID();
  const requestLog = log.child({ requestId });

  const user = c.get("authUser");

  // Parse multipart form data
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    requestLog.warn("uploads:avatar:noFile");
    throw new BadRequestError("No file provided");
  }

  const filename = file.name;
  const mimeType = file.type;

  requestLog.info({ filename, mimeType, size: file.size, userId: user.id }, "uploads:avatar:received");

  // Validate file type (images only)
  if (!AVATAR_ALLOWED_TYPES.includes(mimeType)) {
    requestLog.warn({ mimeType }, "uploads:avatar:invalidType");
    throw new BadRequestError(`Invalid file type: ${mimeType}. Allowed: JPEG, PNG, GIF, WebP`);
  }

  // Check file size
  if (file.size > AVATAR_MAX_SIZE) {
    const limitMB = AVATAR_MAX_SIZE / (1024 * 1024);
    requestLog.warn({ size: file.size, limit: AVATAR_MAX_SIZE }, "uploads:avatar:fileTooLarge");
    throw new BadRequestError(`File too large. Maximum size is ${limitMB}MB`);
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to MinIO with avatars/ prefix
  const result = await uploadFile(buffer, filename, mimeType, "avatars");

  requestLog.info({ url: result.url, filename: result.filename, userId: user.id }, "uploads:avatar:success");

  return c.json<AvatarUploadResponse>({
    url: result.url,
  });
});
