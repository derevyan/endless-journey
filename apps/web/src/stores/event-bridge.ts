/**
 * Event Bridge
 *
 * Bridges backend SSE events to the frontend store event bus.
 * Transforms sync events from the server into store events for real-time updates.
 *
 * This enables collaborative features and real-time sync by routing
 * backend events through the existing store event system.
 *
 * Event flow:
 * Backend SSE → EventProvider → EventDispatcher → EventBridge → StoreEventBus → Stores
 *
 * @module stores/event-bridge
 */

import { createLogger } from "@journey/logger";

import { storeEventBus, type StoreEvent } from "./store-event-bus";
import { eventDispatcher } from "@/shared/lib/events";
import type { FrontendEvent } from "@/shared/lib/events/types";

const log = createLogger("event-bridge");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration for the event bridge
 */
export interface EventBridgeConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Filter to only bridge specific event types */
  filter?: (event: FrontendEvent) => boolean;
}

/**
 * Metrics for the event bridge
 */
export interface EventBridgeMetrics {
  /** Total events received from dispatcher */
  eventsReceived: number;
  /** Total events bridged to store bus */
  eventsBridged: number;
  /** Events filtered out */
  eventsFiltered: number;
  /** Transform errors */
  transformErrors: number;
}

// =============================================================================
// EVENT TRANSFORMERS
// =============================================================================

/**
 * Extract custom metadata field safely
 */
function getCustomField(event: FrontendEvent, field: string): string {
  const custom = event.metadata?.custom;
  if (custom && typeof custom === "object" && field in custom) {
    const value = custom[field];
    return typeof value === "string" ? value : String(value ?? "");
  }
  return "";
}

/**
 * Transform a sync event from the backend to a store event
 *
 * Returns null if the event should not be bridged to the store bus.
 */
function transformToStoreEvent(event: FrontendEvent): StoreEvent | null {
  // Only handle sync-related events from the backend
  switch (event.type) {
    // Session events - broadcast to stores for real-time sync
    case "session.started":
      return {
        type: "sync:session.started",
        payload: {
          sessionId: event.sessionId ?? "",
          journeyId: event.journeyId ?? "",
        },
      };

    case "session.event":
      return {
        type: "sync:session.event",
        payload: {
          sessionId: event.sessionId ?? "",
          eventType: getCustomField(event, "eventType"),
          data: event.payload,
        },
      };

    // Journey save events - notify stores when journey is saved by another user
    case "journey.created":
    case "journey.updated":
      return {
        type: "sync:journey.saved",
        payload: {
          journeyId: event.journeyId ?? "",
          savedBy: event.performedBy ?? "unknown",
          timestamp: event.timestamp ?? new Date().toISOString(),
        },
      };

    // Node events - could trigger canvas updates
    // Note: Web app extends schema events with full node objects via WebSpecificEvents
    case "node.created": {
      const nodeData = event.payload as { id?: string; type?: string; position?: { x: number; y: number } } | undefined;
      return {
        type: "node:added",
        payload: {
          nodeId: event.metadata?.nodeId ?? nodeData?.id ?? "",
          nodeType: nodeData?.type ?? "unknown",
          position: nodeData?.position,
        },
      };
    }

    case "node.updated":
      return {
        type: "node:updated",
        payload: {
          nodeId: event.metadata?.nodeId ?? "",
          updates: (event.payload as Record<string, unknown>) ?? {},
        },
      };

    case "node.deleted":
      return {
        type: "node:deleted",
        payload: {
          nodeId: event.metadata?.nodeId ?? "",
        },
      };

    // Edge events
    case "edge.created": {
      const edgeData = event.payload as { id?: string; source?: string; target?: string; sourceHandle?: string; targetHandle?: string } | undefined;
      return {
        type: "edge:added",
        payload: {
          edgeId: edgeData?.id ?? "",
          source: edgeData?.source ?? "",
          target: edgeData?.target ?? "",
          sourceHandle: edgeData?.sourceHandle,
          targetHandle: edgeData?.targetHandle,
        },
      };
    }

    case "edge.deleted": {
      const edgePayload = event.payload as { edgeId?: string } | undefined;
      return {
        type: "edge:deleted",
        payload: {
          edgeId: edgePayload?.edgeId ?? "",
        },
      };
    }

    // ==========================================================================
    // WORKFLOW EVENTS - Real-time workflow execution updates
    // ==========================================================================

    case "workflow.started": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        workflowName?: string;
        startNodeId?: string;
      } | undefined;
      return {
        type: "sync:workflow.started",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          workflowName: payload?.workflowName,
          startNodeId: payload?.startNodeId ?? "",
        },
      };
    }

    case "workflow.step.started": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        nodeId?: string;
        nodeType?: string;
        nodeName?: string;
      } | undefined;
      return {
        type: "sync:workflow.step.started",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          nodeId: payload?.nodeId ?? "",
          nodeType: payload?.nodeType ?? "",
          nodeName: payload?.nodeName,
        },
      };
    }

    case "workflow.step.completed": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        nodeId?: string;
        nodeType?: string;
        nodeName?: string;
        outHandle?: string;
        durationMs?: number;
        output?: Record<string, unknown>;
      } | undefined;
      return {
        type: "sync:workflow.step.completed",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          nodeId: payload?.nodeId ?? "",
          nodeType: payload?.nodeType ?? "",
          nodeName: payload?.nodeName,
          outHandle: payload?.outHandle,
          durationMs: payload?.durationMs,
          output: payload?.output,
        },
      };
    }

    case "workflow.step.error": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        nodeId?: string;
        nodeType?: string;
        nodeName?: string;
        errorMessage?: string;
      } | undefined;
      return {
        type: "sync:workflow.step.error",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          nodeId: payload?.nodeId ?? "",
          nodeType: payload?.nodeType ?? "",
          nodeName: payload?.nodeName,
          errorMessage: payload?.errorMessage ?? "",
        },
      };
    }

    case "workflow.completed": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        durationMs?: number;
        nodesExecuted?: number;
        success?: boolean;
      } | undefined;
      return {
        type: "sync:workflow.completed",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          durationMs: payload?.durationMs,
          nodesExecuted: payload?.nodesExecuted,
          success: payload?.success ?? true,
        },
      };
    }

    case "workflow.error": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        errorMessage?: string;
      } | undefined;
      return {
        type: "sync:workflow.error",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          errorMessage: payload?.errorMessage ?? "",
        },
      };
    }

    case "workflow.paused": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        pausedAtNodeId?: string;
        pauseReason?: string;
      } | undefined;
      return {
        type: "sync:workflow.paused",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          pausedAtNodeId: payload?.pausedAtNodeId ?? "",
          pauseReason: payload?.pauseReason,
        },
      };
    }

    case "workflow.resumed": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        resumedAtNodeId?: string;
        pauseDurationMs?: number;
      } | undefined;
      return {
        type: "sync:workflow.resumed",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          resumedAtNodeId: payload?.resumedAtNodeId ?? "",
          pauseDurationMs: payload?.pauseDurationMs,
        },
      };
    }

    case "workflow.guard.blocked": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        nodeId?: string;
        blockedBy?: string;
        blockedMessage?: string;
      } | undefined;
      return {
        type: "sync:workflow.guard.blocked",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          nodeId: payload?.nodeId ?? "",
          blockedBy: payload?.blockedBy ?? "",
          blockedMessage: payload?.blockedMessage,
        },
      };
    }

    case "workflow.approval.requested": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        nodeId?: string;
        approvalMessage?: string;
      } | undefined;
      return {
        type: "sync:workflow.approval.requested",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          nodeId: payload?.nodeId ?? "",
          approvalMessage: payload?.approvalMessage,
        },
      };
    }

    case "workflow.approval.response": {
      const payload = event.payload as {
        workflowId?: string;
        workflowKey?: string;
        nodeId?: string;
        approved?: boolean;
        respondedBy?: string;
      } | undefined;
      return {
        type: "sync:workflow.approval.response",
        payload: {
          workflowId: payload?.workflowId ?? "",
          workflowKey: payload?.workflowKey ?? "",
          nodeId: payload?.nodeId ?? "",
          approved: payload?.approved ?? false,
          respondedBy: payload?.respondedBy,
        },
      };
    }

    default:
      // Non-sync events are handled by other handlers (query invalidation, notifications)
      return null;
  }
}

// =============================================================================
// EVENT BRIDGE CLASS
// =============================================================================

/**
 * Event bridge that connects the event dispatcher to the store event bus
 */
class EventBridge {
  private unsubscribe: (() => void) | null = null;
  private config: EventBridgeConfig = {};
  private metrics: EventBridgeMetrics = {
    eventsReceived: 0,
    eventsBridged: 0,
    eventsFiltered: 0,
    transformErrors: 0,
  };

  /**
   * Start bridging events from the dispatcher to the store bus
   */
  start(config: EventBridgeConfig = {}): void {
    if (this.unsubscribe) {
      log.warn({}, "eventBridge:alreadyStarted");
      return;
    }

    this.config = config;

    // Register as a global handler to receive all events
    this.unsubscribe = eventDispatcher.registerGlobal({
      handler: (event) => this.handleEvent(event),
      // Use low priority so query invalidation and notifications run first
      priority: -100,
    });

    log.info({ debug: config.debug }, "eventBridge:started");
  }

  /**
   * Stop bridging events
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      log.info({}, "eventBridge:stopped");
    }
  }

  /**
   * Handle an incoming event from the dispatcher
   */
  private handleEvent(event: FrontendEvent): void {
    this.metrics.eventsReceived++;

    // Apply filter if configured
    if (this.config.filter && !this.config.filter(event)) {
      this.metrics.eventsFiltered++;
      if (this.config.debug) {
        log.debug({ eventType: event.type }, "eventBridge:filtered");
      }
      return;
    }

    try {
      // Transform the event to a store event
      const storeEvent = transformToStoreEvent(event);

      if (storeEvent) {
        // Emit to store event bus
        storeEventBus.emit(storeEvent);
        this.metrics.eventsBridged++;

        if (this.config.debug) {
          log.debug(
            { fromType: event.type, toType: storeEvent.type },
            "eventBridge:bridged"
          );
        }
      }
    } catch (error) {
      this.metrics.transformErrors++;
      log.error(
        { eventType: event.type, error },
        "eventBridge:transformError"
      );
    }
  }

  /**
   * Get bridge metrics
   */
  getMetrics(): EventBridgeMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      eventsReceived: 0,
      eventsBridged: 0,
      eventsFiltered: 0,
      transformErrors: 0,
    };
  }

  /**
   * Check if bridge is running
   */
  isRunning(): boolean {
    return this.unsubscribe !== null;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global event bridge instance
 *
 * Usage:
 * ```typescript
 * // Start bridging (typically in EventProvider)
 * eventBridge.start({ debug: true });
 *
 * // Stop bridging
 * eventBridge.stop();
 *
 * // Check metrics
 * console.log(eventBridge.getMetrics());
 * ```
 */
export const eventBridge = new EventBridge();

// =============================================================================
// REACT HOOK
// =============================================================================

/**
 * Hook to manage event bridge lifecycle
 *
 * @example
 * ```tsx
 * function App() {
 *   useEventBridge({ debug: true });
 *   return <div>...</div>;
 * }
 * ```
 */
export function useEventBridge(config?: EventBridgeConfig): void {
  // Using inline import to avoid circular dependency issues
   
  const { useEffect } = require("react");

  useEffect(() => {
    eventBridge.start(config);
    return () => eventBridge.stop();
  }, [config]);
}
