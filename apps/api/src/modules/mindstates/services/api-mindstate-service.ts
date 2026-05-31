import type { DbClient } from "@journey/db";
import type {
  AnalysisTrigger,
  AtomicSaveMindstateInput,
  AtomicSaveMindstateResult,
  ClientMindstate,
  CreateMindstateDefinition,
  IApiMindstateService,
  MindstateAnalysisLogEntry,
  MindstateAnalysisResult,
  MindstateDefinition,
  MindstateDefinitionVersion,
  MindstateQuery,
  PreviewMindstateAnalysisInput,
  PreviewMindstateAnalysisResult,
  StateParameterValue,
  UpdateMindstateDefinition,
  VersionedMindstateData,
} from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";
import * as analysisService from "./analysis-service";
import * as clientService from "./client-mindstate-service";
import * as definitionService from "./definition-service";
import * as versionService from "./definition-version-service";
import * as parameterService from "./parameter-service";
import type { MindstateServiceContext } from "./service-context";

export class ApiMindstateService implements IApiMindstateService {
  private readonly ctx: MindstateServiceContext;

  constructor(db: DbClient, organizationId: string, publisher: IEventPublisher) {
    this.ctx = { db, organizationId, publisher };
  }

  listDefinitions(): Promise<MindstateDefinition[]> {
    return definitionService.listDefinitions(this.ctx);
  }

  ensureDefaultMindstate(): Promise<boolean> {
    return definitionService.ensureDefaultMindstate(this.ctx);
  }

  getDefinition(key: string): Promise<MindstateDefinition | null> {
    return definitionService.getDefinition(this.ctx, key);
  }

  getDefinitionById(id: string): Promise<MindstateDefinition | null> {
    return definitionService.getDefinitionById(this.ctx, id);
  }

  createDefinition(
    data: CreateMindstateDefinition,
    performedBy?: string
  ): Promise<MindstateDefinition> {
    return definitionService.createDefinition(this.ctx, data, performedBy);
  }

  updateDefinition(
    key: string,
    data: UpdateMindstateDefinition,
    performedBy?: string
  ): Promise<MindstateDefinition | null> {
    return definitionService.updateDefinition(this.ctx, key, data, performedBy);
  }

  deleteDefinition(key: string, performedBy?: string): Promise<boolean> {
    return definitionService.deleteDefinition(this.ctx, key, performedBy);
  }

  previewAnalyzeMessage(config: PreviewMindstateAnalysisInput): Promise<PreviewMindstateAnalysisResult> {
    return analysisService.previewAnalyzeMessage(config);
  }

  listVersions(definitionId: string): Promise<MindstateDefinitionVersion[]> {
    return versionService.listVersions(this.ctx, definitionId);
  }

  getVersion(definitionId: string, versionId: string): Promise<VersionedMindstateData | null> {
    return versionService.getVersion(this.ctx, definitionId, versionId);
  }

  deleteVersion(definitionId: string, versionId: string): Promise<boolean> {
    return versionService.deleteVersion(this.ctx, definitionId, versionId);
  }

  saveVersionAtomic(
    definitionId: string,
    userId: string,
    data: AtomicSaveMindstateInput
  ): Promise<AtomicSaveMindstateResult> {
    return versionService.saveVersionAtomic(this.ctx, definitionId, userId, data);
  }

  listClientMindstates(clientId: string): Promise<ClientMindstate[]> {
    return clientService.listClientMindstates(this.ctx, clientId);
  }

  getOrCreateClientMindstate(clientId: string, key: string): Promise<ClientMindstate> {
    return clientService.getOrCreateClientMindstate(this.ctx, clientId, key);
  }

  analyzeMessage(
    mindstateId: string,
    message: string,
    trigger?: AnalysisTrigger,
    sessionId?: string
  ): Promise<MindstateAnalysisResult> {
    return analysisService.analyzeMessage(this.ctx, mindstateId, message, trigger, sessionId);
  }

  getAnalysisHistory(mindstateId: string, limit: number): Promise<MindstateAnalysisLogEntry[]> {
    return analysisService.getAnalysisHistory(this.ctx, mindstateId, limit);
  }

  getParameterValue(
    clientId: string,
    key: string,
    parameterName: string
  ): Promise<StateParameterValue | null> {
    return parameterService.getParameterValue(this.ctx, clientId, key, parameterName);
  }

  getParameterValues(
    clientId: string,
    queries: MindstateQuery[]
  ): Promise<Map<string, StateParameterValue>> {
    return parameterService.getParameterValues(this.ctx, clientId, queries);
  }

  getMindstateContext(
    clientId: string,
    definitionKeys: string[]
  ): Promise<Record<string, Record<string, StateParameterValue>>> {
    return parameterService.getMindstateContext(this.ctx, clientId, definitionKeys);
  }
}
