/**
 * Storage Client for MinIO (S3-compatible)
 *
 * Provides file upload functionality using AWS S3 SDK with MinIO endpoint.
 *
 * @module lib/storage
 */

import { CreateBucketCommand, DeleteObjectCommand, HeadBucketCommand, PutBucketPolicyCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError } from "@journey/schemas";
import { appConfig } from "../config";

const log = createLogger("storage");

// =============================================================================
// CONFIGURATION
// =============================================================================

const MINIO_ENDPOINT = appConfig.storage.minio.endpoint;
const MINIO_ACCESS_KEY = appConfig.storage.minio.accessKey;
const MINIO_SECRET_KEY = appConfig.storage.minio.secretKey;
const MINIO_BUCKET = appConfig.storage.minio.bucket;

// =============================================================================
// S3 CLIENT
// =============================================================================

export const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  region: "us-east-1", // Required but ignored by MinIO
  forcePathStyle: true, // Required for MinIO
});

// =============================================================================
// TYPES
// =============================================================================

export type MediaType = "image" | "video";

export interface UploadResult {
  url: string;
  type: MediaType;
  filename: string;
  key: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determine media type from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

/**
 * Validate file type
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Videos
    "video/mp4",
    "video/webm",
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Get file size limit in bytes based on media type
 */
export function getFileSizeLimit(mediaType: MediaType): number {
  // 10MB for images, 300MB for videos
  return mediaType === "image" ? 10 * 1024 * 1024 : 300 * 1024 * 1024;
}

/**
 * Generate unique file key
 */
export function generateFileKey(filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const safeName = filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, "_") // Replace special chars
    .substring(0, 50); // Limit length
  return `${timestamp}-${random}-${safeName}${ext ? `.${ext}` : ""}`;
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(key: string): string {
  return `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${key}`;
}

// =============================================================================
// BUCKET OPERATIONS
// =============================================================================

/**
 * Set bucket policy to allow public read access
 */
async function setBucketPublicPolicy(): Promise<void> {
  const publicPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`],
      },
    ],
  };

  try {
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: MINIO_BUCKET,
        Policy: JSON.stringify(publicPolicy),
      })
    );
    log.info({ bucket: MINIO_BUCKET }, "storage:bucket:policySet");
  } catch (error) {
    log.error({ bucket: MINIO_BUCKET, err: serializeError(error) }, "storage:bucket:policyFailed");
    throw error;
  }
}

/**
 * Ensure the bucket exists, create if not
 */
export async function ensureBucket(): Promise<void> {
  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
    log.debug({ bucket: MINIO_BUCKET }, "storage:bucket:exists");
  } catch (error: unknown) {
    const err = error as { name?: string };
    // Create bucket if it doesn't exist
    if (err.name === "NotFound" || err.name === "NoSuchBucket") {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
        log.info({ bucket: MINIO_BUCKET }, "storage:bucket:created");

        // Set public read policy for the new bucket
        await setBucketPublicPolicy();
      } catch (createError) {
        log.error({ bucket: MINIO_BUCKET, err: serializeError(createError) }, "storage:bucket:createFailed");
        throw createError;
      }
    } else {
      log.error({ bucket: MINIO_BUCKET, err: serializeError(error) }, "storage:bucket:checkFailed");
      throw error;
    }
  }
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Upload a file to MinIO
 * @param buffer - File buffer to upload
 * @param filename - Original filename
 * @param mimeType - MIME type of the file
 * @param prefix - Optional prefix for the storage key (e.g., "avatars" for avatars/filename)
 */
export async function uploadFile(buffer: Buffer, filename: string, mimeType: string, prefix?: string): Promise<UploadResult> {
  const mediaType = getMediaTypeFromMime(mimeType);
  if (!mediaType) {
    throw new BadRequestError(`Unsupported file type: ${mimeType}`);
  }

  if (!isAllowedFileType(mimeType)) {
    throw new BadRequestError(`File type not allowed: ${mimeType}`);
  }

  // Skip size validation for avatar uploads (handled by caller)
  if (!prefix) {
    const sizeLimit = getFileSizeLimit(mediaType);
    if (buffer.length > sizeLimit) {
      const limitMB = sizeLimit / (1024 * 1024);
      throw new BadRequestError(`File too large. Maximum size for ${mediaType}s is ${limitMB}MB`);
    }
  }

  // Ensure bucket exists
  await ensureBucket();

  const baseKey = generateFileKey(filename);
  const key = prefix ? `${prefix}/${baseKey}` : baseKey;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const url = getPublicUrl(key);

    log.info({ key, filename, mimeType, size: buffer.length, url }, "storage:upload:success");

    return {
      url,
      type: mediaType,
      filename,
      key,
    };
  } catch (error) {
    log.error({ key, filename, mimeType, err: serializeError(error) }, "storage:upload:failed");
    throw error;
  }
}

/**
 * Delete a file from MinIO
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
      })
    );
    log.info({ key }, "storage:delete:success");
  } catch (error) {
    log.error({ key, err: serializeError(error) }, "storage:delete:failed");
    throw error;
  }
}
