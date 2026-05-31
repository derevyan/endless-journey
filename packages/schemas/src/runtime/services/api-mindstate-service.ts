import type {
  AnalysisTrigger,
  AgentInsight,
  ClientMindstate,
  CreateMindstateDefinition,
  MainAgent,
  MindstateQuery,
  MindstateDefinition,
  MindstateDefinitionVersion,
  AtomicSaveMindstateInput,
  AtomicSaveMindstateResult,
  PipelineMetrics,
  StateChange,
  StateParameterValue,
  StateParameter,
  SystemAgent,
  UpdateMindstateDefinition,
  VersionedMindstateData,
} from "../../mindstate";

export interface MindstateAnalysisResult {
  mindstateId: string;
  changes: StateChange[];
  newInsights: AgentInsight[];
  metrics: PipelineMetrics;
  responseMessage?: string;
}

export interface PreviewMindstateAnalysisInput {
  message: string;
  currentState: StateParameter[];
  systemAgents: SystemAgent[];
  mainAgent: MainAgent;
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface PreviewMindstateAnalysisResult {
  response: string;
  insights: AgentInsight[];
  stateChanges: StateChange[];
  updatedState: StateParameter[];
  metrics: PipelineMetrics;
}

export interface MindstateAnalysisLogEntry {
  id: string;
  trigger: AnalysisTrigger;
  changes: StateChange[];
  newInsights: AgentInsight[];
  metrics: PipelineMetrics | null;
  inputMessage: string | null;
  responseMessage: string | null;
  createdAt: Date | null;
}

export interface IApiMindstateService {
  listDefinitions(): Promise<MindstateDefinition[]>;
  ensureDefaultMindstate(): Promise<boolean>;
  getDefinition(key: string): Promise<MindstateDefinition | null>;
  getDefinitionById(id: string): Promise<MindstateDefinition | null>;
  createDefinition(data: CreateMindstateDefinition, performedBy?: string): Promise<MindstateDefinition>;
  updateDefinition(
    key: string,
    data: UpdateMindstateDefinition,
    performedBy?: string
  ): Promise<MindstateDefinition | null>;
  deleteDefinition(key: string, performedBy?: string): Promise<boolean>;
  previewAnalyzeMessage(config: PreviewMindstateAnalysisInput): Promise<PreviewMindstateAnalysisResult>;

  listVersions(definitionId: string): Promise<MindstateDefinitionVersion[]>;
  getVersion(definitionId: string, versionId: string): Promise<VersionedMindstateData | null>;
  deleteVersion(definitionId: string, versionId: string): Promise<boolean>;
  saveVersionAtomic(
    definitionId: string,
    userId: string,
    data: AtomicSaveMindstateInput
  ): Promise<AtomicSaveMindstateResult>;

  listClientMindstates(clientId: string): Promise<ClientMindstate[]>;
  getOrCreateClientMindstate(clientId: string, key: string): Promise<ClientMindstate>;
  analyzeMessage(
    mindstateId: string,
    message: string,
    trigger?: AnalysisTrigger,
    sessionId?: string
  ): Promise<MindstateAnalysisResult>;
  getAnalysisHistory(mindstateId: string, limit: number): Promise<MindstateAnalysisLogEntry[]>;

  getParameterValue(clientId: string, key: string, parameterName: string): Promise<StateParameterValue | null>;
  getParameterValues(clientId: string, queries: MindstateQuery[]): Promise<Map<string, StateParameterValue>>;
  getMindstateContext(clientId: string, definitionKeys: string[]): Promise<Record<string, Record<string, StateParameterValue>>>;
}
