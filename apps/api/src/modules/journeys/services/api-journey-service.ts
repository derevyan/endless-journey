import type { DbClient } from "@journey/db";
import type {
  AtomicSaveInput,
  IApiJourneyService,
  JourneyConfigRecord,
  JourneyDeactivationResult,
  JourneyIdOrSlug,
  JourneyVersion,
  SaveVersionInput,
  UpdateJourneyInput,
  VersionedJourneyData,
  JourneyAtomicSaveResult,
  JourneyConfig,
} from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";
import {
  createJourney,
  deactivateJourney,
  deleteJourney,
  getJourneyById,
  getOrganizationJourneys,
  reactivateJourney,
  updateJourney,
} from "./journey-service";
import { deleteVersion, getVersion, listVersions, saveVersion, saveVersionAtomic } from "./version-service";
import type { JourneyServiceContext } from "./service-context";

export class ApiJourneyService implements IApiJourneyService {
  private readonly ctx: JourneyServiceContext;

  constructor(db: DbClient, publisher: IEventPublisher) {
    // Use minimal sessionQueryContext to avoid circular dependency
    // (previously channelContext required journeyService: this which caused self-reference)
    this.ctx = {
      db,
      publisher,
      sessionQueryContext: { db },
    };
  }

  async getOrganizationJourneys(organizationId: string): Promise<JourneyConfigRecord[]> {
    return getOrganizationJourneys(this.ctx, organizationId);
  }

  async getJourneyById(journeyIdOrSlug: JourneyIdOrSlug, organizationId: string): Promise<JourneyConfigRecord | null> {
    return getJourneyById(this.ctx, journeyIdOrSlug, organizationId);
  }

  async createJourney(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      configuration: JourneyConfig;
      defaultPipelineId?: string | null;
    }
  ): Promise<JourneyConfigRecord> {
    return createJourney(this.ctx, organizationId, userId, data);
  }

  async updateJourney(
    journeyIdOrSlug: JourneyIdOrSlug,
    organizationId: string,
    data: UpdateJourneyInput
  ): Promise<JourneyConfigRecord | null> {
    return updateJourney(this.ctx, journeyIdOrSlug, organizationId, data);
  }

  async deleteJourney(
    journeyIdOrSlug: JourneyIdOrSlug,
    organizationId: string,
    performedBy?: string
  ): Promise<boolean> {
    return deleteJourney(this.ctx, journeyIdOrSlug, organizationId, performedBy);
  }

  async deactivateJourney(
    journeyIdOrSlug: JourneyIdOrSlug,
    organizationId: string,
    mode: "pause" | "terminate" | "complete",
    performedBy?: string
  ): Promise<JourneyDeactivationResult | null> {
    return deactivateJourney(this.ctx, journeyIdOrSlug, organizationId, mode, performedBy);
  }

  async reactivateJourney(
    journeyIdOrSlug: JourneyIdOrSlug,
    organizationId: string,
    performedBy?: string
  ): Promise<JourneyDeactivationResult | null> {
    return reactivateJourney(this.ctx, journeyIdOrSlug, organizationId, performedBy);
  }

  async listVersions(journeyId: string, organizationId: string): Promise<JourneyVersion[]> {
    return listVersions(this.ctx, journeyId, organizationId);
  }

  async saveVersion(
    journeyId: string,
    organizationId: string,
    userId: string,
    data: SaveVersionInput
  ): Promise<JourneyVersion> {
    return saveVersion(this.ctx, journeyId, organizationId, userId, data);
  }

  async getVersion(
    journeyId: string,
    versionId: string,
    organizationId: string
  ): Promise<VersionedJourneyData | null> {
    return getVersion(this.ctx, journeyId, versionId, organizationId);
  }

  async deleteVersion(journeyId: string, versionId: string, organizationId: string): Promise<boolean> {
    return deleteVersion(this.ctx, journeyId, versionId, organizationId);
  }

  async saveVersionAtomic(
    journeyId: string,
    organizationId: string,
    userId: string,
    data: AtomicSaveInput
  ): Promise<JourneyAtomicSaveResult> {
    return saveVersionAtomic(this.ctx, journeyId, organizationId, userId, data);
  }
}
