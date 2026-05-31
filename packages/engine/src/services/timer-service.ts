/**
 * Timer Service
 *
 * Manages scheduling and cancellation of timers for the engine.
 * Timers are associated with edges and trigger timeout events.
 *
 * Also supports plugin follow-up sequences where timers trigger message sends
 * rather than edge transitions.
 */

import type { createLogger } from "@journey/logger";
import type { EnhancedUserJourney, FollowUpSequence, JourneyEdgeData } from "@journey/schemas";
import { parsePluginId, type PluginFollowUpTimerContext } from "../plugins/types";
import type { SessionStateManager } from "../state/session-state-manager";
import type { MessagingAdapter, TimerService } from "../types";
import { isTimerEdge, scaleDuration } from "../utils";

/** Dependencies for creating a timer service */
export interface TimerServiceDeps {
  /** Session ID for timer scheduling */
  sessionId: string;

  /** Session object for reads */
  session: EnhancedUserJourney;

  /** State manager for centralized mutations */
  stateManager: SessionStateManager;

  /** Messaging adapter for timer operations */
  adapter: MessagingAdapter;

  /** Journey edges for node-based cancellation */
  getOutgoingEdges: (nodeId: string) => JourneyEdgeData[];

  /** Logger instance */
  log: ReturnType<typeof createLogger>;

  /** Optional scale factor for timer delays (1 = real time). */
  timerScale?: number;
}

/**
 * Create a timer service instance
 *
 * @param deps - Service dependencies
 * @returns TimerService implementation
 */
export function createTimerService(deps: TimerServiceDeps): TimerService {
  const { sessionId, session, stateManager, adapter, getOutgoingEdges, log, timerScale } = deps;
  const rawTimerScale = typeof timerScale === "number" ? timerScale : 1;
  const normalizedTimerScale = Number.isFinite(rawTimerScale) && rawTimerScale > 0 ? rawTimerScale : 1;
  const scaleDelay = (delayMs: number): number => {
    if (normalizedTimerScale === 1) return delayMs;
    return scaleDuration(delayMs, normalizedTimerScale, 1);
  };

  /** Map of timerId -> edgeId for tracking active edge timers */
  const timerMap = new Map<string, string>();

  /** Map of timerId -> context for tracking active plugin follow-up timers */
  const pluginFollowUpMap = new Map<string, PluginFollowUpTimerContext>();

  // Recover timerMap from session.pendingTimers on resume
  // This ensures getEdgeForTimer() works after session restoration
  if (session.pendingTimers && session.pendingTimers.length > 0) {
    const now = Date.now();
    let staleCount = 0;
    for (const timer of session.pendingTimers) {
      timerMap.set(timer.timerId, timer.targetEdgeId);
      // Check if timer was supposed to fire in the past (potentially stale)
      if (timer.triggersAt) {
        const triggersAtMs = new Date(timer.triggersAt).getTime();
        if (triggersAtMs < now) {
          staleCount++;
          log.warn(
            { timerId: timer.timerId, edgeId: timer.targetEdgeId, triggersAt: timer.triggersAt, overdueMs: now - triggersAtMs },
            "timer:recoveredPotentiallyStale"
          );
        }
      }
    }
    log.info({ recoveredTimers: session.pendingTimers.length, potentiallyStaleTimers: staleCount }, "timer:recoveredFromSession");
  }

  // Recover pluginFollowUpMap from session.pendingPluginFollowUps on resume
  if (session.pendingPluginFollowUps && session.pendingPluginFollowUps.length > 0) {
    const now = Date.now();
    let staleCount = 0;
    for (const pfu of session.pendingPluginFollowUps) {
      // Extract pluginIndex from pluginId if not directly available
      const pluginIndex = pfu.pluginIndex ?? parsePluginId(pfu.pluginId)?.pluginIndex ?? 0;
      if (!pfu.timerType) {
        throw new Error(`Missing timerType for plugin follow-up timer ${pfu.timerId}`);
      }
      pluginFollowUpMap.set(pfu.timerId, {
        pluginId: pfu.pluginId,
        parentNodeId: pfu.parentNodeId,
        pluginIndex,
        stepIndex: pfu.stepIndex,
        sequence: pfu.sequence,
        timerType: pfu.timerType,
      });
      // Check if plugin follow-up was supposed to fire in the past (potentially stale)
      if (pfu.triggersAt) {
        const triggersAtMs = new Date(pfu.triggersAt).getTime();
        if (triggersAtMs < now) {
          staleCount++;
          log.warn(
            { timerId: pfu.timerId, pluginId: pfu.pluginId, stepIndex: pfu.stepIndex, triggersAt: pfu.triggersAt, overdueMs: now - triggersAtMs },
            "timer:recoveredPluginFollowUpPotentiallyStale"
          );
        }
      }
    }
    log.info({ recoveredPluginFollowUps: session.pendingPluginFollowUps.length, potentiallyStaleFollowUps: staleCount }, "timer:recoveredPluginFollowUpsFromSession");
  }

  return {
    async scheduleTimer(delayMs: number, edgeId: string): Promise<string> {
      const scaledDelayMs = scaleDelay(delayMs);
      try {
        // Properly await the adapter to ensure timer is scheduled before continuing
        const timerId = await adapter.scheduleTimer(sessionId, scaledDelayMs, edgeId);

        // Only update in-memory state if adapter scheduling succeeded
        timerMap.set(timerId, edgeId);

        // Update session.pendingTimers via stateManager
        const triggersAt = new Date(Date.now() + scaledDelayMs).toISOString();
        stateManager.addPendingTimer({
          timerId,
          triggersAt,
          targetEdgeId: edgeId,
        });

        log.info({ delayMs: scaledDelayMs, edgeId, timerId, triggersAt }, "timer:scheduled");
        return timerId;
      } catch (error) {
        // Log the failure with context for debugging
        log.error(
          {
            delayMs: scaledDelayMs,
            edgeId,
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "timer:scheduleFailed"
        );
        // Re-throw to propagate to handler for proper error handling
        throw error;
      }
    },

    async cancelTimer(timerId: string): Promise<boolean> {
      const edgeId = timerMap.get(timerId);
      if (!edgeId) return false;

      let cancelled = false;
      try {
        // Pass edgeId and sessionId for robust cancellation (DB fallback)
        // Now properly await the cancellation
        cancelled = await adapter.cancelTimer(timerId, edgeId, sessionId);
      } catch (error) {
        // Log but continue cleanup even if adapter fails
        log.warn({ timerId, edgeId, error: error instanceof Error ? error.message : String(error) }, "timer:cancelAdapterError");
      }

      // Always clean up local state even if adapter fails
      timerMap.delete(timerId);
      stateManager.removePendingTimer(timerId);
      log.debug({ timerId, edgeId, cancelled }, "timer:cancelled");
      return cancelled;
    },

    async cancelTimersForNode(nodeId: string): Promise<void> {
      const outgoingEdges = getOutgoingEdges(nodeId);
      if (!outgoingEdges || outgoingEdges.length === 0) {
        return;
      }

      // Collect timer edge IDs to cancel
      const timerEdgeIds = new Set(outgoingEdges.filter(isTimerEdge).map((e) => e.id));
      if (timerEdgeIds.size === 0) {
        return;
      }

      // Collect timers to cancel first (avoid mutation during iteration)
      const timersToCancel: Array<{ timerId: string; edgeId: string }> = [];
      timerMap.forEach((edgeId, timerId) => {
        if (timerEdgeIds.has(edgeId)) {
          timersToCancel.push({ timerId, edgeId });
        }
      });

      // Now cancel all collected timers - await all in parallel
      await Promise.all(
        timersToCancel.map(async ({ timerId, edgeId }) => {
          try {
            await adapter.cancelTimer(timerId, edgeId, sessionId);
          } catch (error) {
            // Log but continue cleanup - state consistency is more important
            log.warn({ nodeId, timerId, edgeId, error: error instanceof Error ? error.message : String(error) }, "timer:cancelForNodeAdapterError");
          }
          timerMap.delete(timerId);
          log.debug({ nodeId, timerId, edgeId }, "timer:cancelledForNode");
        })
      );

      // Single array mutation for pendingTimers via stateManager
      stateManager.removePendingTimersByEdges(timerEdgeIds);
    },

    /**
     * Mark a timer as fired (cleanup timerMap entry after timeout event)
     * Call this when a timeout event is processed to prevent memory leak
     */
    markTimerFired(timerId: string): void {
      const edgeId = timerMap.get(timerId);
      if (edgeId) {
        timerMap.delete(timerId);
        // Remove from session.pendingTimers via stateManager
        stateManager.removePendingTimer(timerId);
        log.debug({ timerId, edgeId }, "timer:fired");
      }
    },

    getEdgeForTimer(timerId: string): string | undefined {
      return timerMap.get(timerId);
    },

    /**
     * Clear all timers from the internal map
     * Call this when destroying the engine to prevent memory leaks
     */
    clearAll(): void {
      const timerCount = timerMap.size;
      const pluginFollowUpCount = pluginFollowUpMap.size;
      timerMap.clear();
      pluginFollowUpMap.clear();
      stateManager.clearAllPendingTimers();
      stateManager.clearAllPendingPluginFollowUps();
      log.debug({ clearedTimerCount: timerCount, clearedPluginFollowUpCount: pluginFollowUpCount }, "timer:clearedAll");
    },

    // =========================================================================
    // PLUGIN FOLLOW-UP METHODS
    // =========================================================================

    async schedulePluginFollowUpTimer(
      pluginId: string,
      parentNodeId: string,
      stepIndex: number,
      delayMs: number,
      sequence: FollowUpSequence,
      timerType: "send" | "response" = "send"
    ): Promise<string> {
      // Extract pluginIndex from synthetic pluginId (format: {parentNodeId}-plugin-{index})
      const parsed = parsePluginId(pluginId);
      const pluginIndex = parsed?.pluginIndex ?? 0;

      // Use different edge ID format for response timers to distinguish them
      const edgePrefix = timerType === "response" ? "followup-response" : "followup-plugin";
      const pluginFollowUpEdgeId = `${edgePrefix}:${pluginId}:${stepIndex}`;
      const scaledDelayMs = scaleDelay(delayMs);
      const timerId = await adapter.scheduleTimer(sessionId, scaledDelayMs, pluginFollowUpEdgeId);

      // Store context in plugin follow-up map (includes pluginIndex and timerType)
      pluginFollowUpMap.set(timerId, { pluginId, parentNodeId, pluginIndex, stepIndex, sequence, timerType });

      // Update session.pendingPluginFollowUps via stateManager
      const triggersAt = new Date(Date.now() + scaledDelayMs).toISOString();
      stateManager.addPendingPluginFollowUp({
        timerId,
        pluginId,
        parentNodeId,
        pluginIndex,
        stepIndex,
        sequence,
        triggersAt,
        timerType,
      });

      log.info(
        {
          delayMs: scaledDelayMs,
          pluginId,
          parentNodeId,
          pluginIndex,
          stepIndex,
          timerId,
          triggersAt,
          timerType,
          totalSteps: sequence.steps.length,
        },
        "timer:pluginFollowUpScheduled"
      );

      return timerId;
    },

    getPluginFollowUpContext(timerId: string): PluginFollowUpTimerContext | undefined {
      return pluginFollowUpMap.get(timerId);
    },

    hasPluginFollowUp(timerId: string): boolean {
      return pluginFollowUpMap.has(timerId);
    },

    markPluginFollowUpFired(timerId: string): void {
      const context = pluginFollowUpMap.get(timerId);
      if (context) {
        pluginFollowUpMap.delete(timerId);
        stateManager.removePendingPluginFollowUp(timerId);
        log.debug({ timerId, pluginId: context.pluginId, stepIndex: context.stepIndex }, "timer:pluginFollowUpFired");
      }
    },

    async cancelPluginFollowUpsForNode(parentNodeId: string): Promise<void> {
      // Collect plugin follow-up timers for this parent node
      const toCancel: Array<{ timerId: string; context: PluginFollowUpTimerContext }> = [];
      pluginFollowUpMap.forEach((context, timerId) => {
        if (context.parentNodeId === parentNodeId) {
          toCancel.push({ timerId, context });
        }
      });

      if (toCancel.length === 0) return;

      // Cancel all collected timers in parallel
      await Promise.all(
        toCancel.map(async ({ timerId, context }) => {
          try {
            // Use correct edge ID prefix based on timer type (send vs response)
            const edgePrefix = context.timerType === "response" ? "followup-response" : "followup-plugin";
            await adapter.cancelTimer(timerId, `${edgePrefix}:${context.pluginId}:${context.stepIndex}`, sessionId);
          } catch (error) {
            log.warn(
              { parentNodeId, timerId, error: error instanceof Error ? error.message : String(error) },
              "timer:cancelPluginFollowUpAdapterError"
            );
          }
          pluginFollowUpMap.delete(timerId);
          log.debug({ parentNodeId, timerId, pluginId: context.pluginId, stepIndex: context.stepIndex }, "timer:pluginFollowUpCancelledForNode");
        })
      );

      // Single array mutation for pendingPluginFollowUps via stateManager
      stateManager.removePendingPluginFollowUpsByParentNode(parentNodeId);

      log.info({ parentNodeId, cancelledCount: toCancel.length }, "timer:pluginFollowUpsCancelledForNode");
    },

    async cancelAllPluginFollowUps(): Promise<void> {
      // Collect all plugin follow-up timers
      const toCancel = Array.from(pluginFollowUpMap.entries());

      if (toCancel.length === 0) return;

      // Cancel all plugin follow-up timers in parallel via adapter
      await Promise.all(
        toCancel.map(async ([timerId, context]) => {
          try {
            // Use correct edge ID prefix based on timer type (send vs response)
            const edgePrefix = context.timerType === "response" ? "followup-response" : "followup-plugin";
            await adapter.cancelTimer(timerId, `${edgePrefix}:${context.pluginId}:${context.stepIndex}`, sessionId);
          } catch (error) {
            log.warn(
              { timerId, pluginId: context.pluginId, error: error instanceof Error ? error.message : String(error) },
              "timer:cancelAllPluginFollowUpsAdapterError"
            );
          }
          pluginFollowUpMap.delete(timerId);
        })
      );

      // Clear session.pendingPluginFollowUps via stateManager
      stateManager.clearAllPendingPluginFollowUps();

      log.info({ cancelledCount: toCancel.length }, "timer:allPluginFollowUpsCancelled");
    },

    shouldCancelPluginFollowUpsOnResponse(parentNodeId: string): boolean {
      const result = this.getPluginFollowUpResponseBehavior(parentNodeId);
      if (!result) return true; // Default: cancel if no active follow-up
      // Cancel if behavior is "cancel" or "exit"
      return result.behavior === "cancel" || result.behavior === "exit";
    },

    getPluginFollowUpResponseBehavior(parentNodeId: string): {
      behavior: "cancel" | "continue" | "exit";
      exitTargetNodeId?: string;
    } | null {
      for (const [, context] of pluginFollowUpMap) {
        if (context.parentNodeId === parentNodeId) {
          const currentStep = context.sequence.steps[context.stepIndex];

          // Step-level onResponse takes priority
          if (currentStep?.onResponse) {
            return {
              behavior: currentStep.onResponse,
              exitTargetNodeId: currentStep.onResponse === "exit"
                ? context.sequence.exitPath?.nodeId
                : undefined,
            };
          }

          // Fall back to sequence-level cancelOnAnyResponse
          return {
            behavior: context.sequence.cancelOnAnyResponse === false ? "continue" : "cancel",
          };
        }
      }
      return null; // No active follow-up for this node
    },
  };
}
