/**
 * Lifecycle Hook Types
 *
 * Types used for node activation/deactivation lifecycle hooks.
 */

import type { createLogger } from "@journey/logger";
import type { JourneyConfig, JourneyNodeData, NodeType } from "@journey/schemas";

import type { EngineServices } from "../types";

/**
 * Context passed to lifecycle hooks.
 */
export interface ActivationContext {
  /** Journey being activated/deactivated */
  journeyId: string;
  journey: JourneyConfig;
  organizationId?: string;

  /** Node being activated/deactivated */
  node: JourneyNodeData;

  /** Engine services available during lifecycle */
  services: EngineServices;

  /** Logger for lifecycle events */
  log: ReturnType<typeof createLogger>;
}

/**
 * Lifecycle hook interface for node handlers.
 */
export interface LifecycleHooks {
  /**
   * Called when journey is activated.
   * Use for resource setup (register webhooks, warm connections).
   */
  onActivate?(context: ActivationContext): Promise<void>;

  /**
   * Called when journey is deactivated.
   * Use for resource cleanup (unregister webhooks, close connections).
   */
  onDeactivate?(context: ActivationContext): Promise<void>;
}

/**
 * Result of a lifecycle hook invocation.
 */
export interface LifecycleResult {
  nodeId: string;
  nodeType: NodeType;
  hook: "onActivate" | "onDeactivate";
  success: boolean;
  error?: Error;
  durationMs: number;
}
