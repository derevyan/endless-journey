/**
 * Test utilities for API integration tests
 *
 * These tests make real HTTP requests to the running API server.
 * Make sure the server is running on localhost:3001 before running tests.
 *
 * @module api/tests/helpers
 */

import "dotenv/config";

import type { ServiceContainer } from "../../services";
import { createApp } from "../../app";
import { clearServiceFactoryOverride, setServiceFactoryOverride } from "../../services";
import { createTestServices } from "../../services/test-helpers";

// =============================================================================
// CONFIGURATION
// =============================================================================

export const API_BASE_URL = process.env.API_URL || "http://localhost:3001";

// =============================================================================
// MOCK USERS (must match what's defined in the API)
// =============================================================================

export const MOCK_USERS: Record<string, { id: string; name: string; email: string }> = {
  "user-demo": { id: "user-demo", name: "Demo User", email: "demo@journey.app" },
  "user-arina": { id: "user-arina", name: "Arina", email: "arina@journey.app" },
};

// =============================================================================
// TYPE DEFINITIONS FOR API RESPONSES
// =============================================================================

export interface HealthResponse {
  status: "ok" | "degraded";
  database: "connected" | "disconnected";
  environment: string;
  timestamp: string;
}

export interface UserResponse {
  user: { id: string; name: string; email: string } | null;
  isMockUser?: boolean;
}

export interface JourneyItem {
  id: string;
  name: string;
  description?: string;
  status?: string;
  configuration?: unknown;
}

export interface JourneysListResponse {
  journeys: JourneyItem[];
}

export interface JourneyResponse {
  journey: JourneyItem;
}

export interface ErrorResponse {
  error: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface OrganizationsListResponse {
  organizations: OrganizationResponse[];
}

export interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface OrganizationMembersResponse {
  members: OrganizationMember[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Helper to create request headers with mock user
 */
export function mockUserHeaders(userId: string): Record<string, string> {
  return {
    "X-Mock-User-Id": userId,
    "Content-Type": "application/json",
  };
}

/**
 * Helper to make a request to the API server
 */
export async function request(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  const headers = options?.headers ?? {};
  const body = options?.body ? JSON.stringify(options.body) : undefined;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });

  return response;
}

/**
 * Helper to make an authenticated request as a mock user
 */
export async function authRequest(
  method: string,
  path: string,
  userId: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  return request(method, path, {
    ...options,
    headers: {
      ...mockUserHeaders(userId),
      ...options?.headers,
    },
  });
}

/**
 * Test journey configuration fixture
 * Conforms to JourneyConfigSchema for API validation
 */
const testNodeMetadata = {
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active" as const,
};

export const testJourneyConfig = {
  nodes: [
    {
      id: "start-node",
      type: "custom" as const, // ReactFlow node type
      data: {
        type: "start" as const, // Journey step type
        label: "Start",
        content: "Welcome to the journey",
      },
      position: { x: 0, y: 0 },
      metadata: testNodeMetadata,
    },
    {
      id: "message-node",
      type: "custom" as const,
      data: {
        type: "message" as const,
        label: "Welcome Message",
        content: "Hello!",
      },
      position: { x: 0, y: 100 },
      metadata: testNodeMetadata,
    },
    {
      id: "end-node",
      type: "custom" as const,
      data: {
        type: "end" as const,
        label: "End",
        content: "Thank you!",
      },
      position: { x: 0, y: 200 },
      metadata: testNodeMetadata,
    },
  ],
  edges: [
    { id: "e1", source: "start-node", target: "message-node" },
    { id: "e2", source: "message-node", target: "end-node" },
  ],
};

/**
 * Known test journey IDs from seed data
 */
export const TEST_JOURNEY_IDS = {
  SAAS_ONBOARDING: "a1b2c3d4-e5f6-4a7b-8c9d-ae1f2a3b4c5d",
  STARTER_TEMPLATE: "b2c3d4e5-f6a7-4b8c-9d0e-8f2a3b4c5d6e",
  ECU_COACHING: "c3d4e5f6-a7b8-4c9d-9e1f-2a3b4c5d6e7f",
};

/**
 * Known test user IDs from seed data
 */
export const TEST_USER_IDS = {
  DEMO: "user-demo",
  ARINA: "user-arina",
};

/**
 * Check if API server is reachable
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get server health info
 * Returns the health response, or null if not reachable
 */
export async function getServerHealthInfo(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      return (await response.json()) as HealthResponse;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sign in with email/password and return session cookies
 * Returns cookies as a string suitable for Cookie header
 */
export async function signIn(email: string, password: string): Promise<string> {
  // Use a cookie jar to track cookies across redirects
  const cookieJar: string[] = [];

  const response = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    // Important: allow redirects to follow cookie setting
    redirect: "follow",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sign in failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Extract cookies from Set-Cookie headers
  // Note: In Node.js fetch, Set-Cookie headers are available
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  
  for (const cookie of setCookieHeaders) {
    // Extract cookie name and value (before first semicolon)
    const cookiePart = cookie.split(";")[0].trim();
    if (cookiePart) {
      cookieJar.push(cookiePart);
    }
  }

  // Also try the manual approach if getSetCookie is not available
  if (cookieJar.length === 0) {
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        const cookiePart = value.split(";")[0].trim();
        if (cookiePart && !cookieJar.includes(cookiePart)) {
          cookieJar.push(cookiePart);
        }
      }
    });
  }

  if (cookieJar.length === 0) {
    throw new Error("No cookies received from sign-in response");
  }

  return cookieJar.join("; ");
}

/**
 * Make an authenticated request using session cookies
 */
export async function authCookieRequest(
  method: string,
  path: string,
  cookies: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Cookie: cookies,
    ...options?.headers,
  };
  const body = options?.body ? JSON.stringify(options.body) : undefined;

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  return response;
}

/**
 * Create an in-process API app with optional service overrides.
 * Useful for fast unit tests that don't hit a live server.
 */
export function createTestApp(options: { services?: Partial<ServiceContainer> } = {}) {
  const services = createTestServices(options.services);

  setServiceFactoryOverride(() => services);

  const app = createApp();

  return {
    app,
    services,
    cleanup: () => clearServiceFactoryOverride(),
  };
}
