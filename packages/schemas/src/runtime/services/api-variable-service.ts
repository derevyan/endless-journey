import type { JourneyIdOrSlug } from "../../branded-ids";
import type { VariableOperation, VariableScope, GlobalVariable, JourneyVariable, UserVariable } from "../../variables";
import type { IVariableService } from "./variable-service";

export type VariableOperationTrigger = "journey" | "manual" | "automation" | "webhook";

export interface VariableOperationEventContext {
  organizationId: string;
  triggeredBy: VariableOperationTrigger;
  performedBy?: string;
  clientId?: string;
  sessionId?: string;
  journeyId?: string;
}

export interface IApiVariableService extends IVariableService {
  getGlobalVariables(): Promise<GlobalVariable[]>;
  getGlobalVariable(key: string): Promise<GlobalVariable | null>;
  setGlobalVariable(key: string, value: unknown, description?: string): Promise<GlobalVariable>;
  deleteGlobalVariable(key: string): Promise<boolean>;

  getJourneyVariables(journeyId: JourneyIdOrSlug): Promise<JourneyVariable[]>;
  getJourneyVariable(journeyId: JourneyIdOrSlug, key: string): Promise<JourneyVariable | null>;
  setJourneyVariable(journeyId: JourneyIdOrSlug, key: string, value: unknown, description?: string): Promise<JourneyVariable>;
  deleteJourneyVariable(journeyId: JourneyIdOrSlug, key: string): Promise<boolean>;

  getUserVariables(clientId: string): Promise<UserVariable[]>;
  getUserVariable(clientId: string, key: string): Promise<UserVariable | null>;
  setUserVariable(clientId: string, key: string, value: unknown, description?: string): Promise<UserVariable>;
  deleteUserVariable(clientId: string, key: string): Promise<boolean>;

  executeOperations(
    scope: VariableScope,
    scopeId: string,
    operations: VariableOperation[],
    context?: VariableOperationEventContext
  ): Promise<void>;

  getVariablesAsMap(scope: VariableScope, scopeId: string): Promise<Record<string, unknown>>;
}
