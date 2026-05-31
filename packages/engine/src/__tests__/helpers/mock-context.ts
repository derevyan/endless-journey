/**
 * Mock Execution Context Factory
 *
 * Provides reusable mock implementation of ExecutionContext for testing handlers.
 * Combines session, node, services, and state management into a test-ready context.
 *
 * @example
 * ```ts
 * const context = createMockContext({
 *   node: { id: "msg-1", data: { type: "message", content: "Hello" } },
 *   edges: [{ id: "e1", source: "msg-1", target: "next" }],
 * });
 *
 * const result = await messageHandler.execute(context);
 * expect(result.action).toBe("wait");
 * ```
 */

import type { JourneyConfig, JourneyEdgeData, JourneyNodeData } from "@journey/schemas";
import { createSessionStateManager } from "../../state/session-state-manager";
import type { ClientData, EngineServices, ExecutionContext } from "../../types";
import { createStateMethods } from "../../utils";
import { createMockLogger, createMockServices } from "./mock-services";
import { createMockSession, type MockSessionOptions } from "./mock-session";

/**
 * Options for creating a mock execution context
 */
export interface MockContextOptions {
  /** Partial node data - will be merged with defaults */
  node?: Partial<JourneyNodeData>;
  /** Outgoing edges from the node */
  edges?: Partial<JourneyEdgeData>[];
  /** Service overrides */
  services?: Partial<EngineServices>;
  /** Session options */
  session?: MockSessionOptions;
  /** Client data */
  clientData?: ClientData;
  /** Organization ID */
  organizationId?: string;
  /** Full journey config (nodes and edges) */
  journey?: JourneyConfig;
}

/**
 * Create mock ExecutionContext for testing handlers
 *
 * Provides a complete context with all required fields and sensible defaults.
 * The context includes working state management (getState/setState).
 *
 * @param options - Configuration options
 * @returns ExecutionContext ready for handler testing
 */
export function createMockContext(options: MockContextOptions = {}): ExecutionContext {
  // Create session with options
  const session = createMockSession({
    currentNodeId: options.node?.id ?? "test-node",
    ...options.session,
  });

  // Build node with defaults
  const nodeData: JourneyNodeData = {
    id: options.node?.id ?? "test-node",
    type: "custom",
    position: { x: 0, y: 0 },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Test Node",
      content: "Test content",
      ...options.node?.data,
    },
    ...options.node,
  } as JourneyNodeData;

  // Create services with overrides
  const services = createMockServices(options.services as Partial<EngineServices>);

  // Build edges with defaults
  const outgoingEdges: JourneyEdgeData[] = (options.edges ?? []).map((edge) => ({
    id: edge.id ?? `edge-${Math.random().toString(36).slice(2)}`,
    source: edge.source ?? nodeData.id,
    target: edge.target ?? "next-node",
    edgeType: edge.edgeType ?? "default",
    ...edge,
  })) as JourneyEdgeData[];

  // Create state manager for centralized session mutations
  const stateManager = createSessionStateManager(session);

  // Create context with state management
  return {
    session,
    stateManager,
    node: nodeData,
    journey: options.journey ?? { nodes: [nodeData], edges: outgoingEdges },
    outgoingEdges,
    services,
    log: createMockLogger(),
    clientData: options.clientData ?? {
      id: session.userId,
      platform: "telegram",
    },
    organizationId: options.organizationId ?? "test-org",
    ...createStateMethods(session, nodeData.id, nodeData.data.type, stateManager),
  };
}

/**
 * Create a mock node for testing
 *
 * Utility for creating properly typed node objects.
 */
export function createMockNode(
  type: string,
  data: Record<string, unknown>,
  id?: string
): JourneyNodeData {
  return {
    id: id ?? `${type}-${Math.random().toString(36).slice(2)}`,
    type: "custom",
    position: { x: 0, y: 0 },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
    data: {
      type,
      schemaVersion: 1,
      label: `Test ${type}`,
      ...data,
    },
  } as JourneyNodeData;
}

/**
 * Create a mock edge for testing
 *
 * Utility for creating properly typed edge objects.
 */
export function createMockEdge(
  source: string,
  target: string,
  options: Partial<JourneyEdgeData> = {}
): JourneyEdgeData {
  return {
    id: options.id ?? `edge-${source}-${target}`,
    source,
    target,
    edgeType: options.edgeType ?? "default",
    ...options,
  } as JourneyEdgeData;
}
