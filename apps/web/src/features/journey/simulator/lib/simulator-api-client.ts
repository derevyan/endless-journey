/**
 * Simulator API Client
 *
 * Clean API abstraction for simulator backend communication.
 * Extracts HTTP logic from the React hook for better testability and separation of concerns.
 *
 * @module features/simulator/lib/simulator-api-client
 */

import { createLogger } from "@journey/logger";
import { API_URL } from "@/shared/lib/app-config";

const log = createLogger("simulator-api");

// =============================================================================
// TYPES
// =============================================================================

export interface CreateSessionRequest {
  journeyId: string;
  startNodeId?: string;
  personaId?: string; // If provided, reuse persona's client
  clientProfile?: {
    firstName?: string;
    lastName?: string;
  };
}

// =============================================================================
// PERSONA TYPES
// =============================================================================

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
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaRequest {
  name: string;
  profile?: PersonaProfile;
  userVars?: Record<string, unknown>;
}

export interface UpdatePersonaRequest {
  name?: string;
  profile?: PersonaProfile;
  userVars?: Record<string, unknown>;
}

export interface ResetPersonaResponse {
  success: boolean;
  tagsDeleted: number;
  crmStagesDeleted: number;
  crmActivitiesDeleted: number;
  sessionsDeleted: number;
  variablesReset: boolean;
}

export interface CleanupAllResponse {
  success: boolean;
  personasReset: number;
  anonymousClientsDeleted: number;
  totalTagsDeleted: number;
  totalSessionsDeleted: number;
}

export interface CreateSessionResponse {
  sessionId: string;
  clientId: string;
  journeyId: string;
  currentNodeId: string;
  status: string;
}

export type SimulatorInputEvent =
  | { type: "text"; text: string }
  | { type: "button_click"; buttonId: string };

export interface ExecuteEventRequest {
  sessionId: string;
  event: SimulatorInputEvent;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Custom error class for simulator API errors.
 * Includes HTTP status code for better error handling.
 */
export class SimulatorApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "SimulatorApiError";
  }
}

// =============================================================================
// HTTP CLIENT
// =============================================================================

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * Generic HTTP request helper with error handling.
 * All simulator API calls flow through this function.
 */
async function request<T>(
  method: HttpMethod,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const url = `${API_URL}/api/simulator${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: response.statusText,
    }));
    const message = errorData.error || `API error: ${response.status}`;

    log.error(
      { status: response.status, endpoint, message },
      "simulatorApi:requestFailed"
    );

    throw new SimulatorApiError(response.status, message);
  }

  // DELETE requests don't return a body
  if (method === "DELETE") {
    return undefined as T;
  }

  return response.json();
}

// =============================================================================
// API CLIENT
// =============================================================================

/**
 * Simulator API client.
 * Provides typed methods for all simulator backend endpoints.
 */
export const simulatorApi = {
  /**
   * Create a new simulator session.
   * Starts a test journey with the specified configuration.
   */
  createSession: (data: CreateSessionRequest): Promise<CreateSessionResponse> =>
    request<CreateSessionResponse>("POST", "/sessions", data),

  /**
   * Delete (stop) a simulator session.
   * Cleans up all associated resources on the backend.
   */
  deleteSession: (sessionId: string): Promise<void> =>
    request<void>("DELETE", `/sessions/${sessionId}`),

  /**
   * Execute an event in a simulator session.
   * Sends user input (text or button click) to the engine.
   */
  executeEvent: (data: ExecuteEventRequest): Promise<void> =>
    request<void>("POST", "/execute", data),

  /**
   * Skip a timer edge immediately.
   * Forces the timer to fire without waiting for the duration.
   */
  skipTimer: (edgeId: string, sessionId: string): Promise<void> =>
    request<void>("POST", `/timers/${edgeId}/skip`, { sessionId }),

  // ===========================================================================
  // PLAYBACK MODE (IMPERSONATE)
  // ===========================================================================

  /**
   * Set playback mode for a session.
   * Enables or disables read-only playback mode to prevent message sending during impersonate.
   */
  setPlaybackMode: (sessionId: string, enabled: boolean): Promise<{ success: boolean; playbackMode: boolean }> =>
    request<{ success: boolean; playbackMode: boolean }>("POST", `/sessions/${sessionId}/playback`, {
      enabled,
    }),

  /**
   * Get playback mode status for a session.
   * Returns whether the session is in playback mode (impersonate).
   */
  getPlaybackMode: (sessionId: string): Promise<{ playbackMode: boolean; startedAt?: string; userId?: string }> =>
    request<{ playbackMode: boolean; startedAt?: string; userId?: string }>("GET", `/sessions/${sessionId}/playback`),

  // ===========================================================================
  // PERSONA API
  // ===========================================================================

  /**
   * List all personas for the current organization.
   */
  listPersonas: (): Promise<{ personas: Persona[] }> =>
    request<{ personas: Persona[] }>("GET", "/personas"),

  /**
   * Get a single persona by ID.
   */
  getPersona: (id: string): Promise<{ persona: Persona }> =>
    request<{ persona: Persona }>("GET", `/personas/${id}`),

  /**
   * Create a new persona.
   */
  createPersona: (data: CreatePersonaRequest): Promise<{ persona: Persona }> =>
    request<{ persona: Persona }>("POST", "/personas", data),

  /**
   * Update an existing persona.
   */
  updatePersona: (id: string, data: UpdatePersonaRequest): Promise<{ persona: Persona }> =>
    request<{ persona: Persona }>("PUT", `/personas/${id}`, data),

  /**
   * Delete a persona and its associated client.
   */
  deletePersona: (id: string): Promise<void> =>
    request<void>("DELETE", `/personas/${id}`),

  /**
   * Reset persona data (clear tags, CRM, sessions but keep client).
   */
  resetPersona: (id: string): Promise<ResetPersonaResponse> =>
    request<ResetPersonaResponse>("POST", `/personas/${id}/reset`),

  /**
   * Bulk cleanup all test data for organization.
   */
  cleanupAllTestData: (): Promise<CleanupAllResponse> =>
    request<CleanupAllResponse>("POST", "/cleanup"),
};

/**
 * Helper to check if an error is a SimulatorApiError.
 * Useful for type narrowing in catch blocks.
 */
export function isSimulatorApiError(error: unknown): error is SimulatorApiError {
  return error instanceof SimulatorApiError;
}
