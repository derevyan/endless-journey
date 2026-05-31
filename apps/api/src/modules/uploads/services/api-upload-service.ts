import type { DbClient } from "@journey/db";
import type { IApiUploadService, SaveJourneyMediaParams } from "@journey/schemas";

import {
  deleteJourneyMediaById,
  getJourneyMediaById,
  isMediaUsedInJourney,
  listJourneyMedia,
  saveJourneyMedia,
} from "./upload-service";
import type { UploadServiceContext } from "./service-context";

export class ApiUploadService implements IApiUploadService {
  private readonly ctx: UploadServiceContext;

  constructor(db: DbClient, organizationId: string) {
    this.ctx = { db, organizationId };
  }

  saveJourneyMedia(params: SaveJourneyMediaParams): Promise<void> {
    return saveJourneyMedia(this.ctx, params);
  }

  listJourneyMedia(journeyId: string, limit?: number) {
    return listJourneyMedia(this.ctx, journeyId, limit);
  }

  getJourneyMediaById(mediaId: string) {
    return getJourneyMediaById(this.ctx, mediaId);
  }

  deleteJourneyMediaById(mediaId: string): Promise<void> {
    return deleteJourneyMediaById(this.ctx, mediaId);
  }

  isMediaUsedInJourney(journeyId: string, mediaUrl: string): Promise<boolean> {
    return isMediaUsedInJourney(this.ctx, journeyId, mediaUrl);
  }
}
