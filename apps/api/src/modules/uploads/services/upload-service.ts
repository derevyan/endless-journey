/**
 * Uploads Service
 *
 * Data access helpers for media uploads and gallery management.
 *
 * @module modules/uploads/services/upload-service
 */

import { journeyMedia, journeys } from "@journey/db/schema";
import type { JourneyMediaRecord, JourneyMediaSummary, SaveJourneyMediaParams } from "@journey/schemas";
import { desc, eq } from "drizzle-orm";

import { isRecord } from "../../../lib/type-guards";
import type { UploadServiceContext } from "./service-context";

function hasMedia(value: unknown): value is { media?: unknown } {
  return isRecord(value) && "media" in value;
}

export async function saveJourneyMedia(ctx: UploadServiceContext, params: SaveJourneyMediaParams): Promise<void> {
  await ctx.db.insert(journeyMedia).values({
    journeyId: params.journeyId,
    uploadedBy: params.uploadedBy,
    type: params.type,
    url: params.url,
    filename: params.filename,
    key: params.key,
    size: params.size,
    mimeType: params.mimeType,
  });
}

export async function listJourneyMedia(
  ctx: UploadServiceContext,
  journeyId: string,
  limit = 50
): Promise<JourneyMediaSummary[]> {
  return ctx.db
    .select({
      id: journeyMedia.id,
      type: journeyMedia.type,
      url: journeyMedia.url,
      filename: journeyMedia.filename,
      createdAt: journeyMedia.createdAt,
    })
    .from(journeyMedia)
    .where(eq(journeyMedia.journeyId, journeyId))
    .orderBy(desc(journeyMedia.createdAt))
    .limit(limit);
}

export async function getJourneyMediaById(
  ctx: UploadServiceContext,
  mediaId: string
): Promise<JourneyMediaRecord | null> {
  const [media] = await ctx.db.select().from(journeyMedia).where(eq(journeyMedia.id, mediaId)).limit(1);
  if (!media) return null;

  return {
    id: media.id,
    journeyId: media.journeyId,
    uploadedBy: media.uploadedBy,
    type: media.type,
    url: media.url,
    filename: media.filename,
    key: media.key,
    size: media.size ?? null,
    mimeType: media.mimeType ?? null,
    createdAt: media.createdAt,
  };
}

export async function deleteJourneyMediaById(ctx: UploadServiceContext, mediaId: string): Promise<void> {
  await ctx.db.delete(journeyMedia).where(eq(journeyMedia.id, mediaId));
}

export async function isMediaUsedInJourney(
  ctx: UploadServiceContext,
  journeyId: string,
  mediaUrl: string
): Promise<boolean> {
  const [journey] = await ctx.db
    .select({ configuration: journeys.configuration })
    .from(journeys)
    .where(eq(journeys.id, journeyId))
    .limit(1);

  if (!journey) return false;

  const config = journey.configuration;
  if (!config?.nodes) return false;

  for (const node of config.nodes) {
    const data = node.data;
    if (!hasMedia(data)) continue;
    const mediaValue = data.media;
    if (!isRecord(mediaValue)) continue;
    if (mediaValue.url === mediaUrl) return true;
  }

  return false;
}
