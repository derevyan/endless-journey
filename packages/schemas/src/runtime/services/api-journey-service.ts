import type { JourneyIdOrSlug } from "../../branded-ids";
import type {
  AtomicSaveInput,
  JourneyAtomicSaveResult,
  JourneyConfig,
  JourneyConfigRecord,
  JourneyDeactivationResult,
  JourneyVersion,
  SaveVersionInput,
  UpdateJourneyInput,
  VersionedJourneyData,
} from "../../journey";

export interface IApiJourneyService {
  getOrganizationJourneys(organizationId: string): Promise<JourneyConfigRecord[]>;
  getJourneyById(journeyIdOrSlug: JourneyIdOrSlug, organizationId: string): Promise<JourneyConfigRecord | null>;
  createJourney(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      configuration: JourneyConfig;
      defaultPipelineId?: string | null;
    }
  ): Promise<JourneyConfigRecord>;
  updateJourney(
    journeyIdOrSlug: JourneyIdOrSlug,
    organizationId: string,
    data: UpdateJourneyInput
  ): Promise<JourneyConfigRecord | null>;
  deleteJourney(journeyIdOrSlug: JourneyIdOrSlug, organizationId: string, performedBy?: string): Promise<boolean>;
  deactivateJourney(
    journeyIdOrSlug: JourneyIdOrSlug,
    organizationId: string,
    mode: "pause" | "terminate" | "complete",
    performedBy?: string
  ): Promise<JourneyDeactivationResult | null>;
  reactivateJourney(
    journeyIdOrSlug: JourneyIdOrSlug,
    organizationId: string,
    performedBy?: string
  ): Promise<JourneyDeactivationResult | null>;

  listVersions(journeyId: string, organizationId: string): Promise<JourneyVersion[]>;
  saveVersion(journeyId: string, organizationId: string, userId: string, data: SaveVersionInput): Promise<JourneyVersion>;
  getVersion(journeyId: string, versionId: string, organizationId: string): Promise<VersionedJourneyData | null>;
  deleteVersion(journeyId: string, versionId: string, organizationId: string): Promise<boolean>;
  saveVersionAtomic(
    journeyId: string,
    organizationId: string,
    userId: string,
    data: AtomicSaveInput
  ): Promise<JourneyAtomicSaveResult>;
}
