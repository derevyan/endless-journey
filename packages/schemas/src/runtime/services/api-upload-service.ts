import type { MediaType } from "../../nodes";

export interface SaveJourneyMediaParams {
  journeyId: string;
  uploadedBy: string;
  type: MediaType;
  url: string;
  filename: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface JourneyMediaSummary {
  id: string;
  type: MediaType;
  url: string;
  filename: string;
  createdAt: Date;
}

export interface JourneyMediaRecord extends JourneyMediaSummary {
  journeyId: string;
  uploadedBy: string;
  key: string;
  size: number | null;
  mimeType: string | null;
}

export interface IApiUploadService {
  saveJourneyMedia(params: SaveJourneyMediaParams): Promise<void>;
  listJourneyMedia(journeyId: string, limit?: number): Promise<JourneyMediaSummary[]>;
  getJourneyMediaById(mediaId: string): Promise<JourneyMediaRecord | null>;
  deleteJourneyMediaById(mediaId: string): Promise<void>;
  isMediaUsedInJourney(journeyId: string, mediaUrl: string): Promise<boolean>;
}
