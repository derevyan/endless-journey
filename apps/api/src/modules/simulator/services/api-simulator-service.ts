import type { DbClient } from "@journey/db";
import type {
  ChannelSessionRecord,
  CreatePersonaRequest,
  CreateSimulatorSession,
  IApiSimulatorService,
  Persona,
  ResetResult,
  SimulatorInput,
  SimulatorSessionInfo,
  SimulatorTimerRecord,
  UpdatePersonaRequest,
  BulkCleanupResult,
} from "@journey/schemas";
import { NotFoundError } from "@journey/schemas";

import type { ServiceContainer } from "../../../services/service-container";
import type { IEventPublisher } from "../../../services/interfaces";
import { cleanupAllTestData, resetPersonaData } from "./cleanup-service";
import { createPersona, deletePersona, getPersona, listPersonas, updatePersona } from "./persona-service";
import {
  cleanupSession as cleanupSimulatorSession,
  createSimulatorSession,
  getActiveSessionCount,
  getSimulatorSession,
  updateSimulatorSessionState,
} from "./session-manager";
import type { SimulatorServiceContext } from "./service-context";
import { getActiveTimer, listActiveTimers } from "./timer-service";

type SimulatorServiceDependencies = Omit<ServiceContainer, "simulator">;

/**
 * Creates a proxy that throws clear errors when simulator methods are called
 * within the simulator context (preventing circular dependency issues).
 */
function createCircularDependencyGuard(): IApiSimulatorService {
  return new Proxy({} as IApiSimulatorService, {
    get(_, prop) {
      return () => {
        throw new Error(
          `simulator.${String(prop)} cannot be called within simulator context - circular dependency`
        );
      };
    },
  });
}

export class ApiSimulatorService implements IApiSimulatorService {
  private readonly ctx: SimulatorServiceContext;
  private readonly services: ServiceContainer;
  private readonly systemServices: ServiceContainer;

  constructor(
    db: DbClient,
    organizationId: string,
    publisher: IEventPublisher,
    services: SimulatorServiceDependencies,
    systemServices: ServiceContainer
  ) {
    this.ctx = { db, organizationId, publisher };
    // Use error-throwing proxy to prevent circular dependencies with clear error messages.
    // The session-manager and engine factory never access services.simulator,
    // but if they did accidentally, this would throw a clear error instead of silently no-op.
    const simulatorGuard = createCircularDependencyGuard();
    this.services = { ...services, simulator: simulatorGuard };
    this.systemServices = { ...systemServices, simulator: simulatorGuard };
  }

  createSession(input: CreateSimulatorSession): Promise<SimulatorSessionInfo> {
    return createSimulatorSession(this.ctx, this.services, this.systemServices, input);
  }

  async executeInput(sessionId: string, input: SimulatorInput): Promise<void> {
    const sessionData = await getSimulatorSession(this.ctx, this.services, this.systemServices, sessionId);
    if (!sessionData) {
      throw new NotFoundError("Session", sessionId);
    }

    await sessionData.adapter.handleInput(input);
    await updateSimulatorSessionState(this.systemServices, sessionId);
  }

  async getSessionRecord(sessionId: string): Promise<ChannelSessionRecord | null> {
    const session = await this.systemServices.channel.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    const journeyOrgId = await this.systemServices.channel.getJourneyOrganizationId(session.journeyId);
    if (!journeyOrgId || journeyOrgId !== this.ctx.organizationId) {
      return null;
    }

    return session;
  }

  async cleanupSession(sessionId: string): Promise<void> {
    const session = await this.getSessionRecord(sessionId);
    if (!session) {
      return;
    }

    await cleanupSimulatorSession(sessionId);
  }

  updateSessionState(sessionId: string): Promise<void> {
    return updateSimulatorSessionState(this.systemServices, sessionId);
  }

  async listActiveTimers(sessionId: string): Promise<SimulatorTimerRecord[]> {
    const timers = await listActiveTimers(this.ctx, sessionId);
    return timers.map((timer) => ({
      id: timer.id,
      edgeId: timer.edgeId,
      firesAt: timer.firesAt,
      createdAt: timer.createdAt,
      bullmqJobId: timer.bullmqJobId,
    }));
  }

  async getActiveTimer(sessionId: string, edgeId: string): Promise<SimulatorTimerRecord | null> {
    const timer = await getActiveTimer(this.ctx, sessionId, edgeId);
    return timer ?? null; // Convert undefined → null for interface consistency
  }

  getActiveSessionCount(): number {
    return getActiveSessionCount();
  }

  listPersonas(): Promise<Persona[]> {
    return listPersonas(this.ctx);
  }

  getPersona(id: string): Promise<Persona | null> {
    return getPersona(this.ctx, id);
  }

  createPersona(input: CreatePersonaRequest): Promise<Persona> {
    return createPersona(this.ctx, input);
  }

  updatePersona(id: string, input: UpdatePersonaRequest): Promise<Persona | null> {
    return updatePersona(this.ctx, id, input);
  }

  deletePersona(id: string): Promise<boolean> {
    return deletePersona(this.ctx, id);
  }

  resetPersonaData(id: string): Promise<ResetResult | null> {
    return resetPersonaData(this.ctx, id);
  }

  cleanupAllTestData(): Promise<BulkCleanupResult> {
    return cleanupAllTestData(this.ctx);
  }
}
