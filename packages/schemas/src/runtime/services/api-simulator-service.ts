import type { ChannelSessionRecord } from "../../channels";
import type {
  CreatePersonaRequest,
  CreateSimulatorSession,
  SimulatorInput,
  UpdatePersonaRequest,
} from "../../simulator";

export interface SimulatorSessionInfo {
  sessionId: string;
  clientId: string;
  journeyId: string;
  currentNodeId: string;
  status: string | null;
}

export interface SimulatorTimerRecord {
  id: string;
  edgeId: string;
  firesAt: Date;
  createdAt: Date;
  bullmqJobId: string | null;
}

export interface PersonaProfile {
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface Persona {
  id: string;
  organizationId: string;
  name: string;
  clientId: string | null;
  profile: PersonaProfile;
  userVars: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResetResult {
  tagsDeleted: number;
  crmStagesDeleted: number;
  sessionsDeleted: number;
  variablesReset: boolean;
}

export interface BulkCleanupResult {
  personasReset: number;
  anonymousClientsDeleted: number;
  totalTagsDeleted: number;
  totalSessionsDeleted: number;
}

export interface IApiSimulatorService {
  createSession(input: CreateSimulatorSession): Promise<SimulatorSessionInfo>;
  executeInput(sessionId: string, input: SimulatorInput): Promise<void>;
  getSessionRecord(sessionId: string): Promise<ChannelSessionRecord | null>;
  cleanupSession(sessionId: string): Promise<void>;
  updateSessionState(sessionId: string): Promise<void>;
  listActiveTimers(sessionId: string): Promise<SimulatorTimerRecord[]>;
  getActiveTimer(sessionId: string, edgeId: string): Promise<SimulatorTimerRecord | null>;
  getActiveSessionCount(): number;

  listPersonas(): Promise<Persona[]>;
  getPersona(id: string): Promise<Persona | null>;
  createPersona(input: CreatePersonaRequest): Promise<Persona>;
  updatePersona(id: string, input: UpdatePersonaRequest): Promise<Persona | null>;
  deletePersona(id: string): Promise<boolean>;
  resetPersonaData(id: string): Promise<ResetResult | null>;
  cleanupAllTestData(): Promise<BulkCleanupResult>;
}
